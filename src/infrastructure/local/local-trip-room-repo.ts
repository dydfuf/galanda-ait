import { Effect, Layer, Schema } from "effect";
import {
  TripRoomRepository,
  type CreateRoomParams,
  type UpdateRoomParams,
} from "../../core/ports/trip-room-repository.ts";
import { TripRoomSchema } from "../../core/domain/room.ts";
import {
  TripIdSchema,
  RevisionSchema,
  UserIdSchema,
} from "../../core/domain/ids.ts";
import { ConflictError, NotFoundError } from "../../core/domain/errors.ts";
import type {
  PlanMemberOpinion,
  TripMember,
  TripPlan,
  TripRoom,
} from "../../core/domain/room.ts";
import type { PlanId, Revision, TripId } from "../../core/domain/ids.ts";

const STORAGE_KEY = "galanda_rooms_v1";

const loadFromStorage = (): ReadonlyArray<unknown> => {
  if (typeof window === "undefined" || !window.localStorage) return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveToStorage = (rooms: ReadonlyArray<TripRoom>): void => {
  if (typeof window !== "undefined" && window.localStorage) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rooms));
  }
};

const decodeRooms = (
  raw: unknown
): Effect.Effect<ReadonlyArray<TripRoom>, never> =>
  Effect.sync(() => {
    try {
      return Schema.decodeUnknownSync(Schema.Array(TripRoomSchema))(raw);
    } catch {
      return [];
    }
  });

export const LocalTripRoomRepositoryLayer = Layer.succeed(TripRoomRepository, {
  getRooms: () =>
    Effect.gen(function* () {
      const raw = loadFromStorage();
      return yield* decodeRooms(raw);
    }),

  getRoom: (roomId: TripId) =>
    Effect.gen(function* () {
      const raw = loadFromStorage();
      const rooms = yield* decodeRooms(raw);
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
      const raw = loadFromStorage();
      const rooms = yield* decodeRooms(raw);

      const now = new Date();
      const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      const defaultStartDate = now.toISOString().split("T")[0];
      const defaultEndDate = threeDaysLater.toISOString().split("T")[0];

      const hostUser: TripMember = params.hostUser ?? {
        id: UserIdSchema.make("user-local-me"),
        name: "나",
        role: "HOST",
      };

      const newRoom: TripRoom = {
        id: TripIdSchema.make(`room-${Date.now()}`),
        title: params.title.trim(),
        destination: params.destination?.trim() || "여행지",
        startDate: params.startDate || defaultStartDate,
        endDate: params.endDate || defaultEndDate,
        revision: RevisionSchema.make(1),
        members: [hostUser],
        plans: [],
        confirmedPlanId: undefined,
      };

      const nextRooms = [newRoom, ...rooms];
      saveToStorage(nextRooms);

      return newRoom;
    }),

  updateRoom: (
    roomId: TripId,
    params: UpdateRoomParams,
    expectedRevision: Revision
  ) =>
    Effect.gen(function* () {
      const raw = loadFromStorage();
      const rooms = yield* decodeRooms(raw);
      const index = rooms.findIndex((r) => r.id === roomId);
      if (index === -1) {
        return yield* Effect.fail(
          new NotFoundError({ entity: "TripRoom", id: roomId })
        );
      }

      const room = rooms[index];
      if (room.revision !== expectedRevision) {
        return yield* Effect.fail(
          new ConflictError({
            message: "다른 사용자가 이미 방 정보를 수정했습니다.",
            expectedRevision,
            actualRevision: room.revision,
          })
        );
      }

      const updatedRoom: TripRoom = {
        ...room,
        title: params.title !== undefined ? params.title.trim() : room.title,
        destination:
          params.destination !== undefined
            ? params.destination.trim()
            : room.destination,
        startDate: params.startDate ?? room.startDate,
        endDate: params.endDate ?? room.endDate,
        revision: RevisionSchema.make(room.revision + 1),
      };

      const nextRooms = [
        ...rooms.slice(0, index),
        updatedRoom,
        ...rooms.slice(index + 1),
      ];
      saveToStorage(nextRooms);

      return updatedRoom;
    }),

  createPlan: (roomId: TripId, plan: TripPlan, expectedRevision: Revision) =>
    Effect.gen(function* () {
      const raw = loadFromStorage();
      const rooms = yield* decodeRooms(raw);
      const index = rooms.findIndex((r) => r.id === roomId);
      if (index === -1) {
        return yield* Effect.fail(
          new NotFoundError({ entity: "TripRoom", id: roomId })
        );
      }

      const room = rooms[index];
      if (room.revision !== expectedRevision) {
        return yield* Effect.fail(
          new ConflictError({
            message: "다른 사용자가 이미 방 정보를 수정했습니다.",
            expectedRevision,
            actualRevision: room.revision,
          })
        );
      }

      const updatedPlans = [...room.plans, plan];
      const updatedRoom: TripRoom = {
        ...room,
        revision: RevisionSchema.make(room.revision + 1),
        plans: updatedPlans,
      };

      const nextRooms = [
        ...rooms.slice(0, index),
        updatedRoom,
        ...rooms.slice(index + 1),
      ];
      saveToStorage(nextRooms);

      return updatedRoom;
    }),

  updatePlan: (roomId: TripId, plan: TripPlan, expectedRevision: Revision) =>
    Effect.gen(function* () {
      const raw = loadFromStorage();
      const rooms = yield* decodeRooms(raw);
      const index = rooms.findIndex((r) => r.id === roomId);
      if (index === -1) {
        return yield* Effect.fail(
          new NotFoundError({ entity: "TripRoom", id: roomId })
        );
      }

      const room = rooms[index];
      if (room.revision !== expectedRevision) {
        return yield* Effect.fail(
          new ConflictError({
            message: "다른 사용자가 이미 방 정보를 수정했습니다.",
            expectedRevision,
            actualRevision: room.revision,
          })
        );
      }

      const planIndex = room.plans.findIndex((p) => p.id === plan.id);
      if (planIndex === -1) {
        return yield* Effect.fail(
          new NotFoundError({ entity: "TripPlan", id: plan.id })
        );
      }

      const updatedPlans = [
        ...room.plans.slice(0, planIndex),
        plan,
        ...room.plans.slice(planIndex + 1),
      ];

      const updatedRoom: TripRoom = {
        ...room,
        revision: RevisionSchema.make(room.revision + 1),
        plans: updatedPlans,
      };

      const nextRooms = [
        ...rooms.slice(0, index),
        updatedRoom,
        ...rooms.slice(index + 1),
      ];
      saveToStorage(nextRooms);

      return updatedRoom;
    }),

  deletePlan: (roomId: TripId, planId: PlanId, expectedRevision: Revision) =>
    Effect.gen(function* () {
      const raw = loadFromStorage();
      const rooms = yield* decodeRooms(raw);
      const index = rooms.findIndex((r) => r.id === roomId);
      if (index === -1) {
        return yield* Effect.fail(
          new NotFoundError({ entity: "TripRoom", id: roomId })
        );
      }

      const room = rooms[index];
      if (room.revision !== expectedRevision) {
        return yield* Effect.fail(
          new ConflictError({
            message: "다른 사용자가 이미 방 정보를 수정했습니다.",
            expectedRevision,
            actualRevision: room.revision,
          })
        );
      }

      const updatedPlans = room.plans.filter((p) => p.id !== planId);
      const updatedRoom: TripRoom = {
        ...room,
        revision: RevisionSchema.make(room.revision + 1),
        plans: updatedPlans,
        confirmedPlanId:
          room.confirmedPlanId === planId ? undefined : room.confirmedPlanId,
      };

      const nextRooms = [
        ...rooms.slice(0, index),
        updatedRoom,
        ...rooms.slice(index + 1),
      ];
      saveToStorage(nextRooms);

      return updatedRoom;
    }),

  confirmPlan: (roomId: TripId, planId: PlanId, expectedRevision: Revision) =>
    Effect.gen(function* () {
      const raw = loadFromStorage();
      const rooms = yield* decodeRooms(raw);
      const index = rooms.findIndex((r) => r.id === roomId);
      if (index === -1) {
        return yield* Effect.fail(
          new NotFoundError({ entity: "TripRoom", id: roomId })
        );
      }

      const room = rooms[index];
      if (room.revision !== expectedRevision) {
        return yield* Effect.fail(
          new ConflictError({
            message: "다른 사용자가 이미 방 정보를 수정했습니다.",
            expectedRevision,
            actualRevision: room.revision,
          })
        );
      }

      const targetPlan = room.plans.find((p) => p.id === planId);
      if (!targetPlan) {
        return yield* Effect.fail(
          new NotFoundError({ entity: "TripPlan", id: planId })
        );
      }

      const updatedPlans = room.plans.map((p) =>
        p.id === planId ? { ...p, status: "CONFIRMED" as const } : p
      );

      const updatedRoom: TripRoom = {
        ...room,
        revision: RevisionSchema.make(room.revision + 1),
        plans: updatedPlans,
        confirmedPlanId: planId,
      };

      const nextRooms = [
        ...rooms.slice(0, index),
        updatedRoom,
        ...rooms.slice(index + 1),
      ];
      saveToStorage(nextRooms);

      return updatedRoom;
    }),

  setPlanOpinion: (
    roomId: TripId,
    planId: PlanId,
    opinion: PlanMemberOpinion,
    expectedRevision: Revision
  ) =>
    Effect.gen(function* () {
      const raw = loadFromStorage();
      const rooms = yield* decodeRooms(raw);
      const index = rooms.findIndex((r) => r.id === roomId);
      if (index === -1) {
        return yield* Effect.fail(
          new NotFoundError({ entity: "TripRoom", id: roomId })
        );
      }

      const room = rooms[index];
      if (room.revision !== expectedRevision) {
        return yield* Effect.fail(
          new ConflictError({
            message: "다른 사용자가 이미 방 정보를 수정했습니다.",
            expectedRevision,
            actualRevision: room.revision,
          })
        );
      }

      const planIndex = room.plans.findIndex((p) => p.id === planId);
      if (planIndex === -1) {
        return yield* Effect.fail(
          new NotFoundError({ entity: "TripPlan", id: planId })
        );
      }

      const plan = room.plans[planIndex];
      const existingOpinions = plan.memberOpinions ?? [];
      const opinionIndex = existingOpinions.findIndex(
        (o) => o.userId === opinion.userId
      );

      let nextOpinions: ReadonlyArray<PlanMemberOpinion>;
      if (opinionIndex >= 0) {
        nextOpinions = [
          ...existingOpinions.slice(0, opinionIndex),
          opinion,
          ...existingOpinions.slice(opinionIndex + 1),
        ];
      } else {
        nextOpinions = [...existingOpinions, opinion];
      }

      const voteCount = nextOpinions.filter((o) => o.reaction === "LIKE").length;

      const updatedPlan: TripPlan = {
        ...plan,
        memberOpinions: nextOpinions,
        voteCount,
      };

      const updatedPlans = [
        ...room.plans.slice(0, planIndex),
        updatedPlan,
        ...room.plans.slice(planIndex + 1),
      ];

      const updatedRoom: TripRoom = {
        ...room,
        revision: RevisionSchema.make(room.revision + 1),
        plans: updatedPlans,
      };

      const nextRooms = [
        ...rooms.slice(0, index),
        updatedRoom,
        ...rooms.slice(index + 1),
      ];
      saveToStorage(nextRooms);

      return updatedRoom;
    }),

  joinRoom: (roomId: TripId, member: TripMember) =>
    Effect.gen(function* () {
      const raw = loadFromStorage();
      const rooms = yield* decodeRooms(raw);
      const index = rooms.findIndex((r) => r.id === roomId);
      if (index === -1) {
        return yield* Effect.fail(
          new NotFoundError({ entity: "TripRoom", id: roomId })
        );
      }

      const room = rooms[index];
      const alreadyMember = room.members.some((m) => m.id === member.id);

      if (alreadyMember) {
        return room;
      }

      const updatedRoom: TripRoom = {
        ...room,
        members: [...room.members, member],
      };

      const nextRooms = [
        ...rooms.slice(0, index),
        updatedRoom,
        ...rooms.slice(index + 1),
      ];
      saveToStorage(nextRooms);

      return updatedRoom;
    }),
});
