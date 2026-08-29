import { and, desc, eq, lt, or } from "drizzle-orm";
import { Effect, Layer, Schema } from "effect";
import {
  NotFoundError,
  RepositoryError,
  RevisionConflictError,
  StateConflictError,
} from "../../../core/domain/errors.ts";
import {
  ExplorePlanListingSchema,
  type ExplorePlanListing,
} from "../../../core/domain/explore-plan.ts";
import {
  ParticipantIdSchema,
  PlanIdSchema,
  RevisionSchema,
  TripIdSchema,
  type ExploreListingId,
  type PlanId,
  type TripId,
} from "../../../core/domain/ids.ts";
import {
  ExplorePlanRepository,
  type ExploreListingCursor,
  type ExplorePlanListingRecord,
} from "../../../core/ports/explore-plan-repository.ts";
import { Database } from "./database.ts";
import {
  explorePlanListings,
  type ExplorePlanListingRow,
} from "./schema/explore-plan.ts";
import { tripRooms } from "./schema/trip-room.ts";

const databaseEffect = <A>(
  operation: string,
  run: () => PromiseLike<A>
): Effect.Effect<A, RepositoryError> =>
  Effect.tryPromise({
    try: run,
    catch: (cause) =>
      new RepositoryError({
        operation,
        message:
          cause instanceof Error
            ? cause.message
            : "Explore 저장소 요청에 실패했습니다.",
      }),
  });

const malformed = (operation: string) =>
  new RepositoryError({
    operation,
    message: "저장된 Explore listing 데이터 형식이 올바르지 않습니다.",
  });

/**
 * row → domain record decode.
 *
 * - timestamps는 ISO string으로 정규화한다.
 * - lifecycle envelope는 Effect Schema로 decode한다(malformed → RepositoryError,
 *   빈/fallback data로 숨기지 않는다).
 * - snapshot의 `sourcePlanRevision`과 row column이 일치하는지 검증한다.
 *   불일치는 손상된 저장 상태이므로 RepositoryError로 실패한다.
 * - server-only source reference는 domain record에 담되 public envelope과
 *   분리해서 반환한다.
 */
const decodeRecord = (
  row: ExplorePlanListingRow,
  operation: string
): Effect.Effect<ExplorePlanListingRecord, RepositoryError> =>
  Effect.gen(function* () {
    const listing: ExplorePlanListing = yield* Schema.decodeUnknownEffect(
      ExplorePlanListingSchema
    )({
      listingId: row.id,
      status: row.status,
      listingRevision: row.listingRevision,
      listedAt: row.listedAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      unlistedAt: row.unlistedAt ? row.unlistedAt.toISOString() : undefined,
      snapshot: row.snapshot,
    }).pipe(Effect.mapError(() => malformed(operation)));

    // snapshot/source revision consistency: 두 값이 다르면 저장 상태가 손상된 것.
    if (listing.snapshot.sourcePlanRevision !== row.sourcePlanRevision) {
      return yield* Effect.fail(malformed(operation));
    }

    return {
      listing,
      sourceTripId: TripIdSchema.make(row.sourceTripId),
      sourcePlanId: PlanIdSchema.make(row.sourcePlanId),
      sourceAuthorParticipantId: ParticipantIdSchema.make(
        row.sourceAuthorParticipantId
      ),
    } satisfies ExplorePlanListingRecord;
  });

const toValues = (record: ExplorePlanListingRecord) => {
  const { listing } = record;
  return {
    id: listing.listingId,
    sourceTripId: record.sourceTripId,
    sourcePlanId: record.sourcePlanId,
    sourceAuthorParticipantId: record.sourceAuthorParticipantId,
    snapshot: listing.snapshot,
    status: listing.status,
    listingRevision: listing.listingRevision,
    sourcePlanRevision: listing.snapshot.sourcePlanRevision,
    listedAt: new Date(listing.listedAt),
    updatedAt: new Date(listing.updatedAt),
    unlistedAt: listing.unlistedAt ? new Date(listing.unlistedAt) : null,
  };
};

export const ExplorePlanRepositoryLive: Layer.Layer<
  ExplorePlanRepository,
  never,
  Database
> = Layer.effect(
  ExplorePlanRepository,
  Effect.gen(function* () {
    const { db } = yield* Database;

    const selectById = (listingId: ExploreListingId) =>
      db
        .select()
        .from(explorePlanListings)
        .where(eq(explorePlanListings.id, listingId))
        .limit(1);

    return {
      create: (record) =>
        Effect.gen(function* () {
          // 최초 게시 INSERT는 source room deletion/update와 반드시 serialize돼야
          // 한다. delete path(deletePlanAndAutoUnlist)는 같은 transaction에서
          // trip_rooms row를 CAS-UPDATE(=row lock)한 뒤 그 plan의 LISTED listing을
          // UNLISTED로 전이한다. 그런데 listing row가 아직 없으면 그 UNLISTED
          // UPDATE는 0 rows에 매칭돼 no-op이 되고, 이후 create가 삭제된 source에
          // 대한 LISTED listing을 INSERT하면 "source 삭제 → UNLISTED" invariant가
          // 깨진다(concurrent first-list race, RAON-244/DISC-10).
          //
          // 이를 막기 위해 INSERT를 하나의 transaction으로 감싸고, 같은 trip_rooms
          // row를 `SELECT ... FOR UPDATE`로 잠근 뒤(=delete path의 room CAS와
          // 동일 row 경합) source plan이 여전히 기대한 revision으로 존재하는지
          // 재검증한 다음에만 INSERT한다.
          // - delete가 먼저 커밋되면 lock 획득 후 plan이 사라져 fail-closed.
          // - create가 먼저 커밋되면 delete의 room CAS가 이후 진행되며 이제
          //   존재하는 LISTED row를 UNLISTED로 전이한다.
          const { sourceTripId, sourcePlanId } = record;
          const expectedSourceRevision =
            record.listing.snapshot.sourcePlanRevision;

          const result = yield* databaseEffect("createExploreListing", () =>
            db.transaction(async (tx) => {
              // source room row를 잠근다. delete path의 room CAS UPDATE와 같은
              // row를 두고 경합하므로 두 transaction이 순서대로 직렬화된다.
              const [sourceRoom] = await tx
                .select({ plans: tripRooms.plans })
                .from(tripRooms)
                .where(eq(tripRooms.id, sourceTripId))
                .for("update")
                .limit(1);

              // source room 자체가 사라졌으면 게시할 source가 없다(fail-closed).
              if (!sourceRoom) {
                return { _tag: "SourceGone" } as const;
              }

              // 잠근 상태에서 최신 room을 읽어 source plan이 기대 revision으로
              // 여전히 존재하는지 재검증한다. 삭제/revision 변경이면 fail-closed.
              const plans = (sourceRoom.plans ?? []) as ReadonlyArray<{
                readonly id?: string;
                readonly revision?: number;
              }>;
              const sourcePlan = plans.find((plan) => plan.id === sourcePlanId);
              if (
                !sourcePlan ||
                sourcePlan.revision !== expectedSourceRevision
              ) {
                return { _tag: "SourceGone" } as const;
              }

              // 최초 게시 INSERT. concurrent first-list(같은 source plan을 두
              // 요청/기기/재시도가 동시에 게시)에서는 use case의 findBySource
              // 선검사가 두 caller 모두에게 "없음"으로 보여 둘 다 여기까지 온다.
              // 그때 loser의 INSERT는 unique index(source_trip_id, source_plan_id)를
              // 위반한다. 이를 raw 예외(→ RepositoryError → 503)로 흘리지 않고
              // `ON CONFLICT DO NOTHING`으로 흡수한 뒤, 이미 존재하는 listing을
              // 다시 읽어 sequential findBySource 경로와 동일한 typed 의미로
              // 되돌린다(LISTED → idempotent 반환, UNLISTED → StateConflict).
              const inserted = await tx
                .insert(explorePlanListings)
                .values(toValues(record))
                .onConflictDoNothing({
                  target: [
                    explorePlanListings.sourceTripId,
                    explorePlanListings.sourcePlanId,
                  ],
                })
                .returning({ id: explorePlanListings.id });

              if (inserted.length > 0) {
                return { _tag: "Inserted" } as const;
              }

              // conflict: winner가 이미 같은 source에 대한 listing을 만들었다.
              // 같은 tx(=source room lock 하)에서 기존 row를 읽어 상태에 따라
              // idempotent 반환/StateConflict로 분기한다.
              const [existing] = await tx
                .select()
                .from(explorePlanListings)
                .where(
                  and(
                    eq(explorePlanListings.sourceTripId, sourceTripId),
                    eq(explorePlanListings.sourcePlanId, sourcePlanId)
                  )
                )
                .limit(1);
              return { _tag: "Conflict", row: existing } as const;
            })
          );

          // source가 lock 하에서 사라졌거나 변경됐으면 "게시할 source 없음"으로
          // fail-closed한다. use case의 source 부재 처리(NotFound TripPlan)와 동일
          // 의미를 유지하고, 삭제된 plan에 대한 LISTED listing을 만들지 않는다.
          if (result._tag === "SourceGone") {
            return yield* Effect.fail(
              new NotFoundError({ entity: "TripPlan", id: sourcePlanId })
            );
          }

          if (result._tag === "Conflict") {
            // conflict인데 row를 다시 못 읽는 경우는 손상된 상태다(fallback 없음).
            if (!result.row) {
              return yield* Effect.fail(malformed("createExploreListing"));
            }
            const existing = yield* decodeRecord(
              result.row,
              "createExploreListing.decode"
            );
            // 이미 LISTED면 이 시도는 benign한 concurrent first-list다.
            // sequential findBySource(LISTED) 경로와 동일하게 기존 immutable
            // listing을 그대로 반환한다(live sync/재INSERT 없음).
            if (existing.listing.status === "LISTED") {
              return existing.listing;
            }
            // UNLISTED면 use case의 findBySource(UNLISTED) 분기와 동일한 typed
            // 의미(명시적 재게시 요구)를 CAS-race 이후에도 유지한다.
            return yield* Effect.fail(
              new StateConflictError({
                message:
                  "이미 게시가 중단된 여행안입니다. 다시 노출하려면 재게시를 사용하세요.",
              })
            );
          }

          return record.listing;
        }),

      getById: (listingId) =>
        Effect.gen(function* () {
          const [row] = yield* databaseEffect("getExploreListing", () =>
            selectById(listingId)
          );
          return row
            ? yield* decodeRecord(row, "getExploreListing.decode")
            : undefined;
        }),

      findBySource: (sourceTripId: TripId, sourcePlanId: PlanId) =>
        Effect.gen(function* () {
          const [row] = yield* databaseEffect("findExploreListingBySource", () =>
            db
              .select()
              .from(explorePlanListings)
              .where(
                and(
                  eq(explorePlanListings.sourceTripId, sourceTripId),
                  eq(explorePlanListings.sourcePlanId, sourcePlanId)
                )
              )
              .limit(1)
          );
          return row
            ? yield* decodeRecord(row, "findExploreListingBySource.decode")
            : undefined;
        }),

      compareAndSet: ({ record, expectedListingRevision }) =>
        Effect.gen(function* () {
          const { listing } = record;
          const result = yield* databaseEffect(
            "compareAndSetExploreListing",
            () =>
              db.transaction(async (tx) => {
                const [updated] = await tx
                  .update(explorePlanListings)
                  .set({
                    snapshot: listing.snapshot,
                    status: listing.status,
                    listingRevision: listing.listingRevision,
                    sourcePlanRevision: listing.snapshot.sourcePlanRevision,
                    listedAt: new Date(listing.listedAt),
                    updatedAt: new Date(listing.updatedAt),
                    unlistedAt: listing.unlistedAt
                      ? new Date(listing.unlistedAt)
                      : null,
                  })
                  .where(
                    and(
                      eq(explorePlanListings.id, listing.listingId),
                      eq(
                        explorePlanListings.listingRevision,
                        expectedListingRevision
                      )
                    )
                  )
                  .returning({
                    revision: explorePlanListings.listingRevision,
                  });
                if (updated) {
                  return { _tag: "Updated" } as const;
                }
                const [current] = await tx
                  .select({ revision: explorePlanListings.listingRevision })
                  .from(explorePlanListings)
                  .where(eq(explorePlanListings.id, listing.listingId))
                  .limit(1);
                return current
                  ? ({ _tag: "Conflict", revision: current.revision } as const)
                  : ({ _tag: "NotFound" } as const);
              })
          );

          if (result._tag === "NotFound") {
            return yield* Effect.fail(
              new NotFoundError({
                entity: "ExplorePlanListing",
                id: listing.listingId,
              })
            );
          }
          if (result._tag === "Conflict") {
            return yield* Effect.fail(
              new RevisionConflictError({
                message: "다른 요청이 이미 Explore listing 상태를 변경했습니다.",
                expectedRevision: expectedListingRevision,
                actualRevision: RevisionSchema.make(result.revision),
              })
            );
          }
          return listing;
        }),

      listListed: ({ limit, cursor }) =>
        Effect.gen(function* () {
          const listedFilter = eq(explorePlanListings.status, "LISTED");
          // keyset predicate: (listed_at, id) < (cursor.listedAt, cursor.id)
          // under (listed_at DESC, id DESC) ordering. tuple-equivalent so no
          // duplicate/gap across pages.
          const where = cursor
            ? and(
                listedFilter,
                or(
                  lt(explorePlanListings.listedAt, new Date(cursor.listedAt)),
                  and(
                    eq(
                      explorePlanListings.listedAt,
                      new Date(cursor.listedAt)
                    ),
                    lt(explorePlanListings.id, cursor.listingId)
                  )
                )
              )
            : listedFilter;

          const rows = yield* databaseEffect("listExploreListings", () =>
            db
              .select()
              .from(explorePlanListings)
              .where(where)
              .orderBy(desc(explorePlanListings.listedAt), desc(explorePlanListings.id))
              // limit+1로 다음 페이지 존재 여부를 판단한다.
              .limit(limit + 1)
          );

          const hasMore = rows.length > limit;
          const pageRows = hasMore ? rows.slice(0, limit) : rows;
          const records = yield* Effect.forEach(pageRows, (row) =>
            decodeRecord(row, "listExploreListings.decode")
          );
          const page = records.map((record) => record.listing);

          const last = page[page.length - 1];
          const nextCursor: ExploreListingCursor | undefined =
            hasMore && last
              ? { listedAt: last.listedAt, listingId: last.listingId }
              : undefined;

          return { page, nextCursor };
        }),
    };
  })
);
