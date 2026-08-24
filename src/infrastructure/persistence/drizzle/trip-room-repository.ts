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
import {
  tripRooms,
  type NewTripRoomRow,
  type TripRoomRow,
} from "./schema/trip-room.ts";
import { participantAliases } from "./schema/participant.ts";

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
                plans: [],
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
    };
  })
);
