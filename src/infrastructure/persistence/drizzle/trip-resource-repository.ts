import { and, count, desc, eq, sql } from "drizzle-orm";
import { Effect, Layer, Schema } from "effect";
import { NotFoundError, RepositoryError, RevisionConflictError, ValidationError } from "../../../core/domain/errors.ts";
import type { Revision, TripId } from "../../../core/domain/ids.ts";
import { RESOURCE_LIMIT, TripResourceSchema } from "../../../core/domain/trip-resource.ts";
import { TripResourceRepository } from "../../../core/ports/trip-resource-repository.ts";
import type { DatabaseHandle } from "./database.ts";
import { tripResources, type TripResourceRow } from "./schema/trip-resource.ts";
import { tripRooms } from "./schema/trip-room.ts";

const databaseEffect = <A>(operation: string, run: () => PromiseLike<A>) =>
  Effect.tryPromise({
    try: run,
    catch: () => new RepositoryError({ operation, message: "여행 자료를 불러오거나 저장하지 못했습니다." }),
  });

const decode = (row: TripResourceRow) => Schema.decodeUnknownSync(TripResourceSchema)({
  ...row,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
  processedAt: row.processedAt?.toISOString() ?? null,
});

const scope = (tripId: TripId, id: string) =>
  and(eq(tripResources.tripId, tripId), eq(tripResources.id, id));

export const makeDrizzleTripResourceRepository = (db: DatabaseHandle): typeof TripResourceRepository.Service => {
  const get: typeof TripResourceRepository.Service.get = (tripId, id) => Effect.gen(function* () {
    const resource = yield* databaseEffect("tripResources.get", async () => {
      const [row] = await db.select().from(tripResources).where(scope(tripId, id)).limit(1);
      return row ? decode(row) : undefined;
    });
    if (!resource) return yield* Effect.fail(new NotFoundError({ entity: "TripResource", id }));
    return resource;
  });

  const conflict = (tripId: TripId, id: string, expectedRevision: Revision) => Effect.gen(function* () {
    const current = yield* get(tripId, id);
    return yield* Effect.fail(new RevisionConflictError({
      message: "다른 멤버가 자료를 변경했어요. 최신 자료를 확인해주세요.",
      expectedRevision,
      actualRevision: current.revision,
    }));
  });

  return {
    get,
    list: (tripId) => databaseEffect("tripResources.list", async () => {
      const rows = await db.select().from(tripResources).where(eq(tripResources.tripId, tripId))
        .orderBy(desc(tripResources.createdAt), desc(tripResources.id)).limit(RESOURCE_LIMIT);
      return rows.map(decode);
    }),
    create: (input) => Effect.gen(function* () {
      const result = yield* databaseEffect("tripResources.create", () => db.transaction(async (tx) => {
        const [room] = await tx.select({ id: tripRooms.id }).from(tripRooms)
          .where(eq(tripRooms.id, input.tripId)).for("update").limit(1);
        if (!room) return { _tag: "NotFound" } as const;
        const [total] = await tx.select({ count: count() }).from(tripResources)
          .where(eq(tripResources.tripId, input.tripId));
        if (!total || !Number.isInteger(total.count) || total.count < 0) throw new Error("Invalid resource count");
        if (total.count >= RESOURCE_LIMIT) return { _tag: "Limit" } as const;
        const [row] = await tx.insert(tripResources).values(input).returning();
        if (!row) throw new Error("Missing inserted resource");
        return { _tag: "Created", resource: decode(row) } as const;
      }));
      if (result._tag === "NotFound") return yield* Effect.fail(new NotFoundError({ entity: "TripRoom", id: input.tripId }));
      if (result._tag === "Limit") return yield* Effect.fail(new ValidationError({ message: `한 여행에는 자료를 ${RESOURCE_LIMIT}개까지 저장할 수 있어요.` }));
      return result.resource;
    }),
    saveResult: (tripId, id, expectedRevision, result) => Effect.gen(function* () {
      const resource = yield* databaseEffect("tripResources.saveResult", async () => {
        const [row] = await db.update(tripResources).set({
          places: result.places,
          processedAt: new Date(result.processedAt),
          linkStatus: result.linkStatus,
          updatedAt: sql`now()`,
          revision: sql`${tripResources.revision} + 1`,
        }).where(and(scope(tripId, id), eq(tripResources.revision, expectedRevision))).returning();
        return row ? decode(row) : undefined;
      });
      return resource ?? (yield* conflict(tripId, id, expectedRevision));
    }),
    remove: (tripId, id, expectedRevision) => Effect.gen(function* () {
      const rows = yield* databaseEffect("tripResources.remove", () => db.delete(tripResources)
        .where(and(scope(tripId, id), eq(tripResources.revision, expectedRevision)))
        .returning({ id: tripResources.id }));
      if (!rows.length) return yield* conflict(tripId, id, expectedRevision);
    }),
  };
};

export const DrizzleTripResourceRepositoryLive = (db: DatabaseHandle) =>
  Layer.succeed(TripResourceRepository, makeDrizzleTripResourceRepository(db));
