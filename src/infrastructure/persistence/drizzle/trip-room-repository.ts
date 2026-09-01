import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { Effect, Layer, Schema } from "effect";
import {
  NotFoundError,
  RepositoryError,
  RevisionConflictError,
} from "../../../core/domain/errors.ts";
import {
  RevisionSchema,
  ParticipantIdSchema,
  type Revision,
  type TripId,
} from "../../../core/domain/ids.ts";
import {
  TripRoomSchema,
  type TripPlan,
  type TripRoom,
} from "../../../core/domain/room.ts";
import { mergeParticipantIdentityInRoom } from "../../../core/domain/room-transitions.ts";
import {
  TripRoomRepository,
  type CreateRoomParams,
  type UpdateRoomParams,
} from "../../../core/ports/trip-room-repository.ts";
import { Database, type DatabaseHandle } from "./database.ts";
import { tripRooms, type NewTripRoomRow, type TripRoomRow } from "./schema/trip-room.ts";
import { explorePlanListings } from "./schema/explore-plan.ts";
import { participantAliases } from "./schema/participant.ts";
import { confirmedItineraries, itineraryRevisions } from "./schema/confirmed-itinerary.ts";
import {
  ConfirmedItinerarySchema,
  type ConfirmedItinerary,
} from "../../../core/domain/confirmed-itinerary.ts";
import type {
  DeletePlanAndAutoUnlistParams,
} from "../../../core/ports/trip-room-repository.ts";

type RoomChanges = Partial<
  Pick<
    NewTripRoomRow,
    "title" | "destination" | "members" | "plans" | "confirmedPlanId"
  >
>;

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
            : "데이터베이스 요청에 실패했습니다.",
      }),
  });

const decodeRoom = (
  row: TripRoomRow,
  operation: string
): Effect.Effect<TripRoom, RepositoryError> =>
  Schema.decodeUnknownEffect(TripRoomSchema)({
    ...row,
    confirmedPlanId: row.confirmedPlanId ?? undefined,
  }).pipe(
    Effect.mapError(
      () =>
        new RepositoryError({
          operation: `${operation}.decode`,
          message: "저장된 여행방 데이터 형식이 올바르지 않습니다.",
        })
    )
  );

const resolveParticipantAliases = (
  db: DatabaseHandle,
  rooms: ReadonlyArray<TripRoom>,
  operation: string
): Effect.Effect<ReadonlyArray<TripRoom>, RepositoryError> =>
  Effect.gen(function* () {
    const ids = [
      ...new Set(
        rooms.flatMap((room) => [
          ...room.members.map(({ id }) => id),
          ...room.plans.flatMap((plan) => [
            ...(plan.authorId ? [plan.authorId] : []),
            ...(plan.memberOpinions ?? []).map(({ userId }) => userId),
          ]),
        ])
      ),
    ];
    if (ids.length === 0) return rooms;

    const aliases = yield* databaseEffect(`${operation}.aliases`, () =>
      db
        .select({
          aliasParticipantId: participantAliases.aliasParticipantId,
          canonicalParticipantId: participantAliases.canonicalParticipantId,
        })
        .from(participantAliases)
        .where(inArray(participantAliases.aliasParticipantId, ids))
    );
    const groups = new Map<string, Array<typeof ParticipantIdSchema.Type>>();
    for (const alias of aliases) {
      const canonical = ParticipantIdSchema.make(alias.canonicalParticipantId);
      const group = groups.get(canonical) ?? [canonical];
      group.push(ParticipantIdSchema.make(alias.aliasParticipantId));
      groups.set(canonical, group);
    }

    return rooms.map((room) =>
      [...groups.entries()].reduce(
        (current, [canonical, participantIds]) =>
          mergeParticipantIdentityInRoom(
            current,
            ParticipantIdSchema.make(canonical),
            participantIds
          ),
        room
      )
    );
  });

const findRoom = (
  db: DatabaseHandle,
  roomId: TripId,
  operation: string
): Effect.Effect<TripRoom, NotFoundError | RepositoryError> =>
  Effect.gen(function* () {
    const [row] = yield* databaseEffect(operation, () =>
      db.select().from(tripRooms).where(eq(tripRooms.id, roomId)).limit(1)
    );
    if (!row) {
      return yield* Effect.fail(
        new NotFoundError({ entity: "TripRoom", id: roomId })
      );
    }
    const room = yield* decodeRoom(row, operation);
    return (yield* resolveParticipantAliases(db, [room], operation))[0];
  });

const findRevision = (
  db: DatabaseHandle,
  roomId: TripId,
  operation: string
): Effect.Effect<Revision | undefined, RepositoryError> =>
  databaseEffect(operation, async () => {
    const [row] = await db
      .select({ revision: tripRooms.revision })
      .from(tripRooms)
      .where(eq(tripRooms.id, roomId))
      .limit(1);
    return row ? RevisionSchema.make(row.revision) : undefined;
  });

const compareAndSet = (
  db: DatabaseHandle,
  roomId: TripId,
  expectedRevision: Revision,
  changes: RoomChanges,
  operation: string
): Effect.Effect<TripRoom, NotFoundError | RevisionConflictError | RepositoryError> =>
  Effect.gen(function* () {
    const [row] = yield* databaseEffect(operation, () =>
      db
        .update(tripRooms)
        .set({
          ...changes,
          revision: sql`${tripRooms.revision} + 1`,
          updatedAt: sql`now()`,
        })
        .where(
          and(
            eq(tripRooms.id, roomId),
            eq(tripRooms.revision, expectedRevision)
          )
        )
        .returning()
    );

    if (row) {
      const room = yield* decodeRoom(row, operation);
      return (yield* resolveParticipantAliases(db, [room], operation))[0];
    }

    const actualRevision = yield* findRevision(
      db,
      roomId,
      `${operation}.findRevision`
    );
    if (actualRevision === undefined) {
      return yield* Effect.fail(
        new NotFoundError({ entity: "TripRoom", id: roomId })
      );
    }
    return yield* Effect.fail(
      new RevisionConflictError({
        message: "다른 사용자가 이미 방 정보를 수정했습니다.",
        expectedRevision,
        actualRevision,
      })
    );
  });

export const TripRoomRepositoryLive: Layer.Layer<
  TripRoomRepository,
  never,
  Database
> = Layer.effect(
  TripRoomRepository,
  Effect.gen(function* () {
    const { db } = yield* Database;

    return {
      getRooms: (participantIds) =>
        Effect.gen(function* () {
          if (participantIds.length === 0) return [];
          const rows = yield* databaseEffect("getRooms", () =>
            db
              .select()
              .from(tripRooms)
              .where(
                or(
                  ...participantIds.map(
                    (id) =>
                      sql`${tripRooms.members} @> ${JSON.stringify([{ id }])}::jsonb`
                  )
                )
              )
              .orderBy(desc(tripRooms.createdAt))
          );
          const rooms = yield* Effect.all(
            rows.map((row) => decodeRoom(row, "getRooms"))
          );
          return yield* resolveParticipantAliases(db, rooms, "getRooms");
        }),

      getRoomOverviewRecords: (participantIds) =>
        Effect.gen(function* () {
          if (participantIds.length === 0) return [];
          const rows = yield* databaseEffect("getRoomOverviewRecords", () =>
            db
              .select()
              .from(tripRooms)
              .where(
                or(
                  ...participantIds.map(
                    (id) =>
                      sql`${tripRooms.members} @> ${JSON.stringify([{ id }])}::jsonb`
                  )
                )
              )
              .orderBy(desc(tripRooms.createdAt))
          );
          if (rows.length === 0) return [];

          const rooms = yield* Effect.all(
            rows.map((row) => decodeRoom(row, "getRoomOverviewRecords"))
          );
          const resolvedRooms = yield* resolveParticipantAliases(
            db,
            rooms,
            "getRoomOverviewRecords"
          );

          const roomIds = rows.map((r) => r.id);
          const itineraryRows = yield* databaseEffect(
            "getRoomOverviewRecords.itineraries",
            () =>
              db
                .select()
                .from(confirmedItineraries)
                .where(inArray(confirmedItineraries.tripId, roomIds))
          );

          const itineraryMap = new Map<string, ConfirmedItinerary>();
          if (itineraryRows.length > 0) {
            const itineraryIds = itineraryRows.map((i) => i.id);
            const revisionRows = yield* databaseEffect(
              "getRoomOverviewRecords.revisions",
              () =>
                db
                  .select()
                  .from(itineraryRevisions)
                  .where(inArray(itineraryRevisions.itineraryId, itineraryIds))
            );

            const revisionMap = new Map<string, (typeof revisionRows)[0]>();
            for (const rev of revisionRows) {
              const itin = itineraryRows.find((i) => i.id === rev.itineraryId);
              if (itin && itin.currentRevision === rev.revision) {
                revisionMap.set(rev.itineraryId, rev);
              }
            }

            for (const itin of itineraryRows) {
              const rev = revisionMap.get(itin.id);
              if (rev) {
                const decoded = yield* Schema.decodeUnknownEffect(ConfirmedItinerarySchema)({
                  ...itin,
                  createdAt: itin.createdAt.toISOString(),
                  snapshot: rev.snapshot,
                  changes: rev.changes,
                  changedBy: rev.changedBy,
                  changedAt: rev.createdAt.toISOString(),
                }).pipe(
                  Effect.mapError(
                    () =>
                      new RepositoryError({
                        operation: "getRoomOverviewRecords.decodeItinerary",
                        message: "확정 일정 형식이 올바르지 않습니다.",
                      })
                  )
                );
                itineraryMap.set(itin.tripId, decoded);
              }
            }
          }

          return resolvedRooms.map((room, idx) => {
            const row = rows[idx];
            return {
              room,
              roomCreatedAt: row.createdAt.toISOString(),
              roomUpdatedAt: row.updatedAt.toISOString(),
              currentItinerary: itineraryMap.get(room.id) ?? null,
            };
          });
        }),

      getRoom: (roomId: TripId) => findRoom(db, roomId, "getRoom"),

      createRoom: (params: CreateRoomParams) =>
        Effect.gen(function* () {
          const [row] = yield* databaseEffect("createRoom", () =>
            db
              .insert(tripRooms)
              .values({
                id: params.id,
                title: params.title.trim(),
                destination: params.destination?.trim() || "여행지",
                members: [params.hostUser],
                plans: params.initialPlan ? [params.initialPlan] : [],
              })
              .onConflictDoNothing({ target: tripRooms.id })
              .returning()
          );
          if (row) return yield* decodeRoom(row, "createRoom");

          const actualRevision = yield* findRevision(
            db,
            params.id,
            "createRoom.findRevision"
          );
          if (actualRevision === undefined) {
            return yield* Effect.fail(
              new RepositoryError({
                operation: "createRoom",
                message: "중복된 여행방의 revision을 조회하지 못했습니다.",
              })
            );
          }
          return yield* Effect.fail(
            new RepositoryError({
              operation: "createRoom",
              message: "같은 ID의 여행방이 이미 존재합니다.",
            })
          );
        }),

      updateRoom: (
        roomId: TripId,
        params: UpdateRoomParams,
        expectedRevision: Revision
      ) =>
        compareAndSet(
          db,
          roomId,
          expectedRevision,
          {
            ...(params.title === undefined
              ? {}
              : { title: params.title.trim() }),
            ...(params.destination === undefined
              ? {}
              : { destination: params.destination.trim() }),
          },
          "updateRoom"
        ),

      createPlan: (
        roomId: TripId,
        plan: TripPlan,
        expectedRevision: Revision
      ) =>
        Effect.gen(function* () {
          const room = yield* findRoom(db, roomId, "createPlan.findRoom");
          return yield* compareAndSet(
            db,
            roomId,
            expectedRevision,
            { plans: [...room.plans, plan] },
            "createPlan"
          );
        }),

      updatePlan: (
        roomId: TripId,
        plan: TripPlan,
        expectedRevision: Revision
      ) =>
        Effect.gen(function* () {
          const room = yield* findRoom(db, roomId, "updatePlan.findRoom");
          if (room.revision !== expectedRevision) {
            return yield* Effect.fail(
              new RevisionConflictError({
                message: "다른 사용자가 이미 방 정보를 수정했습니다.",
                expectedRevision,
                actualRevision: room.revision,
              })
            );
          }
          const planIndex = room.plans.findIndex(({ id }) => id === plan.id);
          if (planIndex === -1) {
            return yield* Effect.fail(
              new NotFoundError({ entity: "TripPlan", id: plan.id })
            );
          }
          return yield* compareAndSet(
            db,
            roomId,
            expectedRevision,
            {
              plans: [
                ...room.plans.slice(0, planIndex),
                plan,
                ...room.plans.slice(planIndex + 1),
              ],
            },
            "updatePlan"
          );
        }),

      saveRoom: (room: TripRoom, expectedRevision: Revision) =>
        compareAndSet(
          db,
          room.id,
          expectedRevision,
          {
            title: room.title,
            destination: room.destination,
            members: room.members,
            plans: room.plans,
            confirmedPlanId: room.confirmedPlanId ?? null,
          },
          "saveRoom"
        ),

      deletePlanAndAutoUnlist: ({
        room,
        sourcePlanId,
        expectedRevision,
        unlistedAt,
      }: DeletePlanAndAutoUnlistParams) =>
        Effect.gen(function* () {
          const unlistedAtDate = new Date(unlistedAt);
          // room CAS와 listing auto-unlist를 하나의 transaction으로 묶는다.
          // 어느 write가 실패하든 함께 rollback되어 partial state가 남지 않는다.
          const result = yield* databaseEffect(
            "deletePlanAndAutoUnlist",
            () =>
              db.transaction(async (tx) => {
                const [updatedRoom] = await tx
                  .update(tripRooms)
                  .set({
                    title: room.title,
                    destination: room.destination,
                    members: room.members,
                    plans: room.plans,
                    confirmedPlanId: room.confirmedPlanId ?? null,
                    revision: sql`${tripRooms.revision} + 1`,
                    updatedAt: sql`now()`,
                  })
                  .where(
                    and(
                      eq(tripRooms.id, room.id),
                      eq(tripRooms.revision, expectedRevision)
                    )
                  )
                  .returning();

                // room CAS miss: listing을 건드리지 않고 현재 revision을 조회해
                // NotFound/Conflict를 구분한다.
                if (!updatedRoom) {
                  const [current] = await tx
                    .select({ revision: tripRooms.revision })
                    .from(tripRooms)
                    .where(eq(tripRooms.id, room.id))
                    .limit(1);
                  return current
                    ? ({ _tag: "Conflict", revision: current.revision } as const)
                    : ({ _tag: "NotFound" } as const);
                }

                // room CAS 성공: 같은 source plan의 LISTED listing만 UNLISTED로
                // 전이한다. 매칭이 없거나 이미 UNLISTED면 no-op(idempotent).
                // listing_revision은 DB에서 atomically +1, updated_at/unlisted_at는
                // 서버 시각으로 갱신하되 listed_at/snapshot/source revision은 보존한다.
                await tx
                  .update(explorePlanListings)
                  .set({
                    status: "UNLISTED",
                    listingRevision: sql`${explorePlanListings.listingRevision} + 1`,
                    updatedAt: unlistedAtDate,
                    unlistedAt: unlistedAtDate,
                  })
                  .where(
                    and(
                      eq(explorePlanListings.sourceTripId, room.id),
                      eq(explorePlanListings.sourcePlanId, sourcePlanId),
                      eq(explorePlanListings.status, "LISTED")
                    )
                  );

                return { _tag: "Updated", row: updatedRoom } as const;
              })
          );

          if (result._tag === "NotFound") {
            return yield* Effect.fail(
              new NotFoundError({ entity: "TripRoom", id: room.id })
            );
          }
          if (result._tag === "Conflict") {
            return yield* Effect.fail(
              new RevisionConflictError({
                message: "다른 사용자가 이미 방 정보를 수정했습니다.",
                expectedRevision,
                actualRevision: RevisionSchema.make(result.revision),
              })
            );
          }

          const decoded = yield* decodeRoom(
            result.row,
            "deletePlanAndAutoUnlist"
          );
          return (yield* resolveParticipantAliases(
            db,
            [decoded],
            "deletePlanAndAutoUnlist"
          ))[0];
        }),
    };
  })
);
