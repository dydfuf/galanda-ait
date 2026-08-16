import { Effect, Layer, Schema } from "effect";
import { TripRoomRepository } from "../../core/ports/trip-room-repository.ts";
import { TripRoomSchema } from "../../core/domain/room.ts";
import {
  TripIdSchema,
  PlanIdSchema,
  RevisionSchema,
  UserIdSchema,
} from "../../core/domain/ids.ts";
import { ConflictError, NotFoundError } from "../../core/domain/errors.ts";
import type { TripRoom } from "../../core/domain/room.ts";
import type { PlanId, Revision, TripId } from "../../core/domain/ids.ts";

const STORAGE_KEY = "galanda_rooms_v1";

const SEED_ROOMS: ReadonlyArray<TripRoom> = [
  {
    id: TripIdSchema.make("room-jeju-2026"),
    title: "2026 봄 제주 힐링 여행",
    destination: "제주도",
    startDate: "2026-04-10",
    endDate: "2026-04-13",
    revision: RevisionSchema.make(1),
    members: [
      { id: UserIdSchema.make("user-local-host"), name: "김호스트", role: "HOST" },
      { id: UserIdSchema.make("user-friend-1"), name: "이친구", role: "MEMBER" },
      { id: UserIdSchema.make("user-friend-2"), name: "박여행", role: "MEMBER" },
    ],
    plans: [
      {
        id: PlanIdSchema.make("plan-1"),
        title: "1안: 해변 카페 & 오름 투어",
        status: "VOTING",
        voteCount: 3,
        places: [
          { id: "place-1", name: "함덕 해수욕장", category: "명소", address: "제주시 조천읍" },
          { id: "place-2", name: "델문도 카페", category: "카페", address: "제주시 조천읍 함덕리" },
        ],
      },
      {
        id: PlanIdSchema.make("plan-2"),
        title: "2안: 서귀포 자연 휴양림 & 흑돼지 코스",
        status: "DRAFT",
        voteCount: 1,
        places: [
          { id: "place-3", name: "서귀포 자연휴양림", category: "명소", address: "서귀포시 1100로" },
        ],
      },
    ],
    confirmedPlanId: undefined,
  },
];

const loadFromStorage = (): ReadonlyArray<unknown> => {
  if (typeof window === "undefined" || !window.localStorage) return SEED_ROOMS;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_ROOMS));
    return SEED_ROOMS;
  }
  try {
    return JSON.parse(raw);
  } catch {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_ROOMS));
    return SEED_ROOMS;
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
      return SEED_ROOMS;
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
});
