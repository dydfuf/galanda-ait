import { Effect, Layer, Schema } from "effect";
import {
  TripRoomRepository,
  type CreateRoomParams,
  type UpdateRoomParams,
} from "../../core/ports/trip-room-repository.ts";
import { TravelDateSchema, TripRoomSchema } from "../../core/domain/room.ts";
import {
  RevisionSchema,
} from "../../core/domain/ids.ts";
import {
  NotFoundError,
  RepositoryError,
  RevisionConflictError,
} from "../../core/domain/errors.ts";
import type { TripPlan, TripRoom } from "../../core/domain/room.ts";
import type { Revision, TripId } from "../../core/domain/ids.ts";

const STORAGE_KEY = "galanda_rooms_v1";

const addDays = (date: string, days: number): string | undefined => {
  if (!Schema.is(TravelDateSchema)(date)) return undefined;
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  const result = value.toISOString().slice(0, 10);
  return Schema.is(TravelDateSchema)(result) ? result : undefined;
};

const normalizeLegacyRooms = (value: unknown): unknown => {
  if (!Array.isArray(value)) return value;
  return value.map((candidate) => {
    if (!candidate || typeof candidate !== "object") return candidate;
    const room = candidate as Record<string, unknown>;
    const legacyStart = typeof room.startDate === "string" ? room.startDate : undefined;
    const plans = Array.isArray(room.plans)
      ? room.plans.map((candidatePlan) => {
          if (!candidatePlan || typeof candidatePlan !== "object") return candidatePlan;
          const plan = candidatePlan as Record<string, unknown>;
          if (!Array.isArray(plan.routes)) return plan;
          let cursor = legacyStart;
          const routes = plan.routes.flatMap((candidateStay) => {
            if (!candidateStay || typeof candidateStay !== "object") return [];
            const stay = candidateStay as Record<string, unknown>;
            if (typeof stay.arrivalDate === "string" && typeof stay.departureDate === "string") {
              cursor = stay.departureDate;
              return [stay];
            }
            if (!cursor || typeof stay.nights !== "number" || stay.nights <= 0) return [];
            const departureDate = addDays(cursor, stay.nights);
            if (!departureDate) return [];
            const normalized = {
              city: typeof stay.city === "string" ? stay.city : "",
              arrivalDate: cursor,
              departureDate,
            };
            cursor = departureDate;
            return [normalized];
          });
          const accommodations = Array.isArray(plan.accommodations)
            ? plan.accommodations.map((item) =>
                item && typeof item === "object" && (item as Record<string, unknown>).nights === null
                  ? { ...(item as Record<string, unknown>), nights: 0 }
                  : item
              )
            : plan.accommodations;
          return { ...plan, routes, accommodations };
        })
      : room.plans;
    const { startDate: _startDate, endDate: _endDate, ...currentRoom } = room;
    return { ...currentRoom, plans };
  });
};

const getStorage = (): Storage | null => {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }
  if (typeof localStorage !== "undefined") {
    return localStorage;
  }
  return null;
};

const loadRooms = (
  operation: string = "loadRooms"
): Effect.Effect<unknown, RepositoryError> =>
  Effect.try({
    try: () => {
      const storage = getStorage();
      if (!storage) return [];
      const raw = storage.getItem(STORAGE_KEY);
      if (raw === null) {
        return [];
      }
      return JSON.parse(raw);
    },
    catch: (cause) =>
      new RepositoryError({
        operation,
        message:
          cause instanceof Error
            ? cause.message
            : "여행방 저장 데이터를 읽지 못했습니다.",
      }),
  });

const decodeRooms = (
  value: unknown,
  operation: string = "decodeRooms"
): Effect.Effect<ReadonlyArray<TripRoom>, RepositoryError> =>
  Schema.decodeUnknownEffect(
    Schema.Array(TripRoomSchema)
  )(normalizeLegacyRooms(value)).pipe(
    Effect.mapError(
      () =>
        new RepositoryError({
          operation,
          message: "저장된 여행방 데이터가 올바른 형식이 아닙니다.",
        })
    )
  );

const saveRooms = (
  rooms: ReadonlyArray<TripRoom>,
  operation: string = "saveRooms"
): Effect.Effect<void, RepositoryError> =>
  Effect.try({
    try: () => {
      const storage = getStorage();
      if (storage) {
        storage.setItem(STORAGE_KEY, JSON.stringify(rooms));
      }
    },
    catch: (cause) =>
      new RepositoryError({
        operation,
        message:
          cause instanceof Error
            ? cause.message
            : "여행방 데이터를 저장하지 못했습니다.",
      }),
  });

const mutateRoom = (
  roomId: TripId,
  expectedRevision: Revision | undefined,
  operation: string,
  updater: (room: TripRoom) => TripRoom | Effect.Effect<TripRoom, NotFoundError>
): Effect.Effect<TripRoom, NotFoundError | RevisionConflictError | RepositoryError> =>
  Effect.gen(function* () {
    const stored = yield* loadRooms(operation);
    const rooms = yield* decodeRooms(stored, `${operation}.decode`);
    const index = rooms.findIndex((r) => r.id === roomId);
    if (index === -1) {
      return yield* Effect.fail(
        new NotFoundError({ entity: "TripRoom", id: roomId })
      );
    }

    const room = rooms[index];
    if (expectedRevision !== undefined && room.revision !== expectedRevision) {
      return yield* Effect.fail(
        new RevisionConflictError({
          message: "다른 사용자가 이미 방 정보를 수정했습니다.",
          expectedRevision,
          actualRevision: room.revision,
        })
      );
    }

    const updatedResult = updater(room);
    const updatedRoom = Effect.isEffect(updatedResult)
      ? yield* updatedResult
      : updatedResult;

    const nextRooms = [
      ...rooms.slice(0, index),
      updatedRoom,
      ...rooms.slice(index + 1),
    ];
    yield* saveRooms(nextRooms, `${operation}.save`);

    return updatedRoom;
  });

export const LocalTripRoomRepositoryLayer: Layer.Layer<TripRoomRepository> =
  Layer.succeed(TripRoomRepository, {
    getRooms: (participantIds) =>
      Effect.gen(function* () {
        const stored = yield* loadRooms("getRooms");
        const rooms = yield* decodeRooms(stored, "getRooms.decode");
        return rooms.filter((room) =>
          room.members.some(({ id }) => participantIds.includes(id))
        );
      }),

    getRoom: (roomId: TripId) =>
      Effect.gen(function* () {
        const stored = yield* loadRooms("getRoom");
        const rooms = yield* decodeRooms(stored, "getRoom.decode");
        const room = rooms.find((r) => r.id === roomId);
        if (!room) {
          return yield* Effect.fail(
            new NotFoundError({ entity: "TripRoom", id: roomId })
          );
        }
        return room;
      }),

    createRoom: (params: CreateRoomParams) =>
      Effect.gen(function* () {
        const stored = yield* loadRooms("createRoom");
        const rooms = yield* decodeRooms(stored, "createRoom.decode");

        const newRoom: TripRoom = {
          id: params.id,
          title: params.title.trim(),
          destination: params.destination?.trim() || "여행지",
          revision: RevisionSchema.make(1),
          members: [params.hostUser],
          plans: [],
          confirmedPlanId: undefined,
        };

        const nextRooms = [newRoom, ...rooms];
        yield* saveRooms(nextRooms, "createRoom.save");

        return newRoom;
      }),

    updateRoom: (
      roomId: TripId,
      params: UpdateRoomParams,
      expectedRevision: Revision
    ) =>
      mutateRoom(roomId, expectedRevision, "updateRoom", (room) => ({
        ...room,
        title: params.title !== undefined ? params.title.trim() : room.title,
        destination:
          params.destination !== undefined
            ? params.destination.trim()
            : room.destination,
        revision: RevisionSchema.make(room.revision + 1),
      })),

    createPlan: (roomId: TripId, plan: TripPlan, expectedRevision: Revision) =>
      mutateRoom(roomId, expectedRevision, "createPlan", (room) => ({
        ...room,
        revision: RevisionSchema.make(room.revision + 1),
        plans: [...room.plans, plan],
      })),

    updatePlan: (roomId: TripId, plan: TripPlan, expectedRevision: Revision) =>
      mutateRoom(roomId, expectedRevision, "updatePlan", (room) => {
        const planIndex = room.plans.findIndex((p) => p.id === plan.id);
        if (planIndex === -1) {
          return Effect.fail(
            new NotFoundError({ entity: "TripPlan", id: plan.id })
          );
        }
        return {
          ...room,
          revision: RevisionSchema.make(room.revision + 1),
          plans: [
            ...room.plans.slice(0, planIndex),
            plan,
            ...room.plans.slice(planIndex + 1),
          ],
        };
      }),

    saveRoom: (room: TripRoom, expectedRevision: Revision) =>
      mutateRoom(room.id, expectedRevision, "saveRoom", () => ({
        ...room,
        revision: RevisionSchema.make(expectedRevision + 1),
      })),
  });
