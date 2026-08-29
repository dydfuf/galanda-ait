import { and, desc, eq, inArray, lt, min, or } from "drizzle-orm";
import { Effect, Layer, Schema } from "effect";
import { RepositoryError } from "../../../core/domain/errors.ts";
import {
  ExplorePlanListingSchema,
  type ExplorePlanListing,
} from "../../../core/domain/explore-plan.ts";
import type { ExploreListingId, ParticipantId } from "../../../core/domain/ids.ts";
import {
  ExploreSaveRepository,
  type SavedListingCursor,
  type SavedListingEntry,
} from "../../../core/ports/explore-save-repository.ts";
import { Database } from "./database.ts";
import { explorePlanListings } from "./schema/explore-plan.ts";
import { explorePlanSaves } from "./schema/explore-save.ts";

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
            : "Explore 저장 저장소 요청에 실패했습니다.",
      }),
  });

const malformed = (operation: string) =>
  new RepositoryError({
    operation,
    message: "저장된 Explore listing 데이터 형식이 올바르지 않습니다.",
  });

/**
 * joined listing row → public envelope decode.
 *
 * saved-list는 현재 listing을 read-through하므로 listing 컬럼을 그대로 decode한다.
 * malformed는 fallback 없이 RepositoryError로 실패한다. source private reference는
 * select하지 않으므로 결과에 애초에 존재하지 않는다.
 */
const decodeListing = (
  row: {
    readonly id: string;
    readonly status: string;
    readonly listingRevision: number;
    readonly sourcePlanRevision: number;
    readonly snapshot: unknown;
    readonly listedAt: Date;
    readonly updatedAt: Date;
    readonly unlistedAt: Date | null;
  },
  operation: string
): Effect.Effect<ExplorePlanListing, RepositoryError> =>
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

    if (listing.snapshot.sourcePlanRevision !== row.sourcePlanRevision) {
      return yield* Effect.fail(malformed(operation));
    }

    return listing;
  });

const participantIdList = (
  participantIds: ReadonlyArray<ParticipantId>
): string[] => [...new Set(participantIds.map((id) => id as string))];

export const ExploreSaveRepositoryLive: Layer.Layer<
  ExploreSaveRepository,
  never,
  Database
> = Layer.effect(
  ExploreSaveRepository,
  Effect.gen(function* () {
    const { db } = yield* Database;

    const isSavedByAny = (
      participantIds: ReadonlyArray<ParticipantId>,
      listingId: ExploreListingId
    ) =>
      databaseEffect("isExploreListingSaved", () =>
        db
          .select({ listingId: explorePlanSaves.listingId })
          .from(explorePlanSaves)
          .where(
            and(
              inArray(
                explorePlanSaves.participantId,
                participantIdList(participantIds)
              ),
              eq(explorePlanSaves.listingId, listingId)
            )
          )
          .limit(1)
      ).pipe(Effect.map((rows) => rows.length > 0));

    return {
      save: ({ participantId, participantIds, listingId, savedAt }) =>
        Effect.gen(function* () {
          // alias 집합 중 이미 저장돼 있으면 새 row를 만들지 않는다(논리적 중복 방지).
          const alreadySaved = yield* isSavedByAny(participantIds, listingId);
          if (alreadySaved) {
            return { saved: true } as const;
          }

          // canonical participant로만 insert. race/재시도는 composite PK
          // uniqueness가 보호하므로 ON CONFLICT DO NOTHING으로 idempotent하게 흡수한다.
          yield* databaseEffect("saveExploreListing", () =>
            db
              .insert(explorePlanSaves)
              .values({
                participantId,
                listingId,
                savedAt: new Date(savedAt),
              })
              .onConflictDoNothing({
                target: [
                  explorePlanSaves.participantId,
                  explorePlanSaves.listingId,
                ],
              })
          );
          return { saved: true } as const;
        }),

      unsave: ({ participantIds, listingId }) =>
        Effect.gen(function* () {
          // alias 집합 전체에서 삭제. 대상이 없어도 성공(반복 안전).
          yield* databaseEffect("unsaveExploreListing", () =>
            db
              .delete(explorePlanSaves)
              .where(
                and(
                  inArray(
                    explorePlanSaves.participantId,
                    participantIdList(participantIds)
                  ),
                  eq(explorePlanSaves.listingId, listingId)
                )
              )
          );
          return { saved: false } as const;
        }),

      isSaved: ({ participantIds, listingId }) =>
        isSavedByAny(participantIds, listingId),

      listSaved: ({ participantIds, limit, cursor }) =>
        Effect.gen(function* () {
          const participantFilter = inArray(
            explorePlanSaves.participantId,
            participantIdList(participantIds)
          );

          // --- alias dedupe subquery -----------------------------------------
          // canonical과 alias가 같은 listing을 각각 저장했으면 alias 집합 조회 시
          // 같은 listing에 대한 row가 여러 개 나온다. listing당 하나의 논리적
          // 항목만 남기기 위해 listing_id로 grouping하고, 대표 savedAt으로
          // 가장 오래된(원래) 저장 시각 MIN(saved_at)을 선택한다. 이후 pagination은
          // 이 deduped tuple 위에서만 수행한다(중복 카드/cursor 오염 방지).
          const deduped = db
            .select({
              listingId: explorePlanSaves.listingId,
              savedAt: min(explorePlanSaves.savedAt).as("saved_at"),
            })
            .from(explorePlanSaves)
            .where(participantFilter)
            .groupBy(explorePlanSaves.listingId)
            .as("deduped_saves");

          // keyset predicate는 deduped tuple (saved_at, listing_id)에 대해 동작한다.
          // order (saved_at DESC, listing_id DESC) 아래에서
          // (saved_at, listing_id) < (cursor.savedAt, cursor.listingId)와 동치.
          const keyset = cursor
            ? or(
                lt(deduped.savedAt, new Date(cursor.savedAt)),
                and(
                  eq(deduped.savedAt, new Date(cursor.savedAt)),
                  lt(deduped.listingId, cursor.listingId)
                )
              )
            : undefined;

          // 현재 LISTED listing만 read-through join(UNLISTED/deleted 제외).
          const listedFilter = eq(explorePlanListings.status, "LISTED");
          const where = keyset
            ? and(listedFilter, keyset)
            : listedFilter;

          const rows = yield* databaseEffect("listSavedExploreListings", () =>
            db
              .select({
                savedAt: deduped.savedAt,
                id: explorePlanListings.id,
                status: explorePlanListings.status,
                listingRevision: explorePlanListings.listingRevision,
                sourcePlanRevision: explorePlanListings.sourcePlanRevision,
                snapshot: explorePlanListings.snapshot,
                listedAt: explorePlanListings.listedAt,
                updatedAt: explorePlanListings.updatedAt,
                unlistedAt: explorePlanListings.unlistedAt,
              })
              // 외부 pagination은 dedupe 이후에 일어난다(subquery join).
              .from(deduped)
              .innerJoin(
                explorePlanListings,
                eq(deduped.listingId, explorePlanListings.id)
              )
              .where(where)
              .orderBy(desc(deduped.savedAt), desc(deduped.listingId))
              // limit+1로 다음 페이지 존재 여부를 판단한다.
              .limit(limit + 1)
          );

          const hasMore = rows.length > limit;
          const pageRows = hasMore ? rows.slice(0, limit) : rows;

          const page: SavedListingEntry[] = yield* Effect.forEach(
            pageRows,
            (row) =>
              Effect.gen(function* () {
                // min(saved_at)은 타입상 nullable이지만, listing과 inner join된
                // grouped row에는 항상 대표 saved_at이 존재한다. null이면(비정상)
                // fallback 없이 malformed로 실패한다.
                const savedAtValue = row.savedAt;
                if (savedAtValue == null) {
                  return yield* Effect.fail(
                    malformed("listSavedExploreListings.decode")
                  );
                }
                const listing = yield* decodeListing(
                  row,
                  "listSavedExploreListings.decode"
                );
                const savedAt =
                  savedAtValue instanceof Date
                    ? savedAtValue.toISOString()
                    : new Date(savedAtValue).toISOString();
                return { savedAt, listing } satisfies SavedListingEntry;
              })
          );

          const last = page[page.length - 1];
          const nextCursor: SavedListingCursor | undefined =
            hasMore && last
              ? { savedAt: last.savedAt, listingId: last.listing.listingId }
              : undefined;

          return { page, nextCursor };
        }),
    };
  })
);
