import {
  and,
  desc,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  max,
  min,
  or,
  sql,
} from "drizzle-orm";
import { Effect, Layer, Schema } from "effect";
import {
  ExploreListingUnavailableError,
  NotFoundError,
  RepositoryError,
} from "../../../core/domain/errors.ts";
import {
  ExplorePlanListingSchema,
  type ExplorePlanListing,
} from "../../../core/domain/explore-plan.ts";
import type { ExploreListingId, ParticipantId } from "../../../core/domain/ids.ts";
import {
  ExploreSaveRepository,
  type SavedListingEntry,
} from "../../../core/ports/explore-save-repository.ts";
import type { DatabaseHandle } from "./database.ts";
import { Database } from "./database.ts";
import { explorePlanListings } from "./schema/explore-plan.ts";
import { participantAliases, participants } from "./schema/participant.ts";
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

const participantIdList = (
  participantIds: ReadonlyArray<ParticipantId>
): string[] => [...new Set(participantIds.map((id) => id as string))];

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

type SaveQueryExecutor = Pick<DatabaseHandle, "select">;

const eligibleSaveCount = async (
  queryable: SaveQueryExecutor,
  listingId: ExploreListingId,
  asOf?: Date
): Promise<number> => {
  const canonicalId = sql`coalesce(${participantAliases.canonicalParticipantId}, ${explorePlanSaves.participantId})`;
  const filters = [
    eq(explorePlanSaves.listingId, listingId),
    isNotNull(participants.authUserId),
    ...(asOf
      ? [
          gt(
            explorePlanSaves.savedAt,
            new Date(asOf.getTime() - 30 * 24 * 60 * 60 * 1000)
          ),
          lte(explorePlanSaves.savedAt, asOf),
          or(
            isNull(explorePlanSaves.unsavedAt),
            gt(explorePlanSaves.unsavedAt, asOf)
          ),
        ]
      : [isNull(explorePlanSaves.unsavedAt)]),
  ];
  const [row] = await queryable
    .select({
      saveCount: sql<number>`count(distinct ${canonicalId})::int`,
    })
    .from(explorePlanSaves)
    .leftJoin(
      participantAliases,
      eq(
        participantAliases.aliasParticipantId,
        explorePlanSaves.participantId
      )
    )
    .innerJoin(participants, eq(participants.id, canonicalId))
    .where(and(...filters));

  const count = Number(row?.saveCount ?? 0);
  if (!Number.isInteger(count) || count < 0) {
    throw new Error("Invalid Explore save count.");
  }
  return count;
};

const activeSaveExists = async (
  queryable: SaveQueryExecutor,
  participantIds: ReadonlyArray<ParticipantId>,
  listingId: ExploreListingId
): Promise<boolean> => {
  const ids = participantIdList(participantIds);
  if (ids.length === 0) return false;
  const rows = await queryable
    .select({ listingId: explorePlanSaves.listingId })
    .from(explorePlanSaves)
    .where(
      and(
        inArray(explorePlanSaves.participantId, ids),
        eq(explorePlanSaves.listingId, listingId),
        isNull(explorePlanSaves.unsavedAt)
      )
    )
    .limit(1);
  return rows.length > 0;
};

export const ExploreSaveRepositoryLive: Layer.Layer<
  ExploreSaveRepository,
  never,
  Database
> = Layer.effect(
  ExploreSaveRepository,
  Effect.gen(function* () {
    const { db } = yield* Database;

    return {
      save: ({ participantId, participantIds, listingId, savedAt }) =>
        Effect.gen(function* () {
          const result = yield* databaseEffect("saveExploreListing", () =>
            db.transaction(async (tx) => {
              const [listing] = await tx
                .select({ status: explorePlanListings.status })
                .from(explorePlanListings)
                .where(eq(explorePlanListings.id, listingId))
                .for("update")
                .limit(1);

              if (!listing) return { _tag: "NotFound" } as const;
              if (listing.status !== "LISTED") {
                return { _tag: "Unavailable" } as const;
              }

              const alreadySaved = await activeSaveExists(
                tx,
                participantIds,
                listingId
              );
              if (!alreadySaved) {
                const [cycle] = await tx
                  .select({ maxCycle: max(explorePlanSaves.saveCycle) })
                  .from(explorePlanSaves)
                  .where(
                    and(
                      inArray(
                        explorePlanSaves.participantId,
                        participantIdList(participantIds)
                      ),
                      eq(explorePlanSaves.listingId, listingId)
                    )
                  );
                const nextCycle = Number(cycle?.maxCycle ?? 0) + 1;
                if (!Number.isInteger(nextCycle) || nextCycle < 1) {
                  throw new Error("Invalid Explore save cycle.");
                }
                await tx
                  .insert(explorePlanSaves)
                  .values({
                    participantId,
                    listingId,
                    saveCycle: nextCycle,
                    savedAt: new Date(savedAt),
                    unsavedAt: null,
                  })
                  .onConflictDoNothing({
                    target: [
                      explorePlanSaves.participantId,
                      explorePlanSaves.listingId,
                      explorePlanSaves.saveCycle,
                    ],
                  });
              }

              return {
                _tag: "Saved",
                saveCount: await eligibleSaveCount(tx, listingId),
              } as const;
            })
          );

          if (result._tag === "NotFound") {
            return yield* Effect.fail(
              new NotFoundError({ entity: "ExplorePlanListing", id: listingId })
            );
          }
          if (result._tag === "Unavailable") {
            return yield* Effect.fail(new ExploreListingUnavailableError());
          }
          return { saved: true, saveCount: result.saveCount } as const;
        }),

      unsave: ({ participantIds, listingId, unsavedAt }) =>
        Effect.gen(function* () {
          const result = yield* databaseEffect("unsaveExploreListing", () =>
            db.transaction(async (tx) => {
              const [listing] = await tx
                .select({ status: explorePlanListings.status })
                .from(explorePlanListings)
                .where(eq(explorePlanListings.id, listingId))
                .for("update")
                .limit(1);

              const ids = participantIdList(participantIds);
              if (ids.length > 0) {
                await tx
                  .update(explorePlanSaves)
                  .set({ unsavedAt: new Date(unsavedAt) })
                  .where(
                    and(
                      inArray(explorePlanSaves.participantId, ids),
                      eq(explorePlanSaves.listingId, listingId),
                      isNull(explorePlanSaves.unsavedAt)
                    )
                  );
              }

              if (!listing || listing.status !== "LISTED") {
                return { saveCount: 0 } as const;
              }
              return {
                saveCount: await eligibleSaveCount(tx, listingId),
              } as const;
            })
          );
          return { saved: false, saveCount: result.saveCount } as const;
        }),

      isSaved: ({ participantIds, listingId }) =>
        Effect.gen(function* () {
          const [listing] = yield* databaseEffect("getExploreSaveState", () =>
            db
              .select({ status: explorePlanListings.status })
              .from(explorePlanListings)
              .where(eq(explorePlanListings.id, listingId))
              .limit(1)
          );
          const saved = yield* databaseEffect("getExploreSaveState", () =>
            activeSaveExists(db, participantIds, listingId)
          );
          const saveCount =
            listing?.status === "LISTED"
              ? yield* databaseEffect("getExploreSaveState", () =>
                  eligibleSaveCount(db, listingId)
                )
              : 0;
          return { saved, saveCount } as const;
        }),

      listSaved: ({ participantIds, limit, cursor }) =>
        Effect.gen(function* () {
          const ids = participantIdList(participantIds);
          if (ids.length === 0) {
            return { page: [], nextCursor: undefined };
          }

          const deduped = db
            .select({
              listingId: explorePlanSaves.listingId,
              savedAt: min(explorePlanSaves.savedAt).as("saved_at"),
            })
            .from(explorePlanSaves)
            .where(
              and(
                inArray(explorePlanSaves.participantId, ids),
                isNull(explorePlanSaves.unsavedAt)
              )
            )
            .groupBy(explorePlanSaves.listingId)
            .as("deduped_saves");
          const keyset = cursor
            ? or(
                lt(deduped.savedAt, new Date(cursor.savedAt)),
                and(
                  eq(deduped.savedAt, new Date(cursor.savedAt)),
                  lt(deduped.listingId, cursor.listingId)
                )
              )
            : undefined;
          const currentCount = sql<number>`(
            select count(distinct coalesce(alias.canonical_participant_id, active_save.participant_id))::int
            from "explore_plan_saves" as active_save
            left join "participant_alias" as alias
              on alias.alias_participant_id = active_save.participant_id
            inner join "participant" as canonical
              on canonical.id = coalesce(alias.canonical_participant_id, active_save.participant_id)
            where active_save.listing_id = "explore_plan_listings"."id"
              and active_save.unsaved_at is null
              and canonical.auth_user_id is not null
          )`;
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
                saveCount: currentCount,
              })
              .from(deduped)
              .innerJoin(
                explorePlanListings,
                eq(deduped.listingId, explorePlanListings.id)
              )
              .where(and(eq(explorePlanListings.status, "LISTED"), keyset))
              .orderBy(desc(deduped.savedAt), desc(deduped.listingId))
              .limit(limit + 1)
          );

          const hasMore = rows.length > limit;
          const pageRows = hasMore ? rows.slice(0, limit) : rows;
          const page: SavedListingEntry[] = yield* Effect.forEach(
            pageRows,
            (row) =>
              Effect.gen(function* () {
                if (row.savedAt == null) {
                  return yield* Effect.fail(
                    malformed("listSavedExploreListings.decode")
                  );
                }
                const saveCount = Number(row.saveCount);
                if (!Number.isInteger(saveCount) || saveCount < 0) {
                  return yield* Effect.fail(
                    malformed("listSavedExploreListings.decode")
                  );
                }
                const listing = yield* decodeListing(
                  row,
                  "listSavedExploreListings.decode"
                );
                return {
                  savedAt: row.savedAt.toISOString(),
                  listing,
                  saveCount,
                } satisfies SavedListingEntry;
              })
          );

          const last = page[page.length - 1];
          return {
            page,
            nextCursor:
              hasMore && last
                ? {
                    savedAt: last.savedAt,
                    listingId: last.listing.listingId,
                  }
                : undefined,
          };
        }),
    };
  })
);
