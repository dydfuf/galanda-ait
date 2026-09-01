import { describe, it, expect, beforeEach } from "vitest";
import { Effect, Layer } from "effect";
import { createTripRoom } from "../create-room.ts";
import { createPlan } from "../save-plan.ts";
import { TripRoomRepository, type CreateRoomParams } from "../../ports/trip-room-repository.ts";
import { SessionService } from "../../ports/session.ts";
import { IdGenerator } from "../../ports/id-generator.ts";
import { IdGeneratorLive, createTestIdGenerator } from "../../../infrastructure/id-generator.ts";
import { LocalTripRoomRepositoryLayer } from "../../../infrastructure/local/local-trip-room-repo.ts";
import { TripIdSchema, RevisionSchema, UserIdSchema } from "../../domain/ids.ts";
import type { TripRoom, UserSession } from "../../domain/room.ts";

describe("Application / Effect Boundary: IdGenerator & Clock", () => {
  const aliceSession: UserSession = {
    participantId: UserIdSchema.make("user-alice"),
    participantIds: [UserIdSchema.make("user-alice")],
    accountType: "REGISTERED",
    name: "앨리스",
    isAuthenticated: true,
  };

  const createSessionLayer = (session: UserSession = aliceSession): Layer.Layer<SessionService> =>
    Layer.succeed(SessionService, {
      getCurrentSession: () => Effect.succeed(session),
      getCurrentUser: () => Effect.succeed(session),
    });

  const createInMemoryRepo = (initialRooms: TripRoom[] = []): Layer.Layer<TripRoomRepository> => {
    let rooms: TripRoom[] = [...initialRooms];
    return Layer.succeed(TripRoomRepository, {
      getRoom: (roomId) => {
        const found = rooms.find((r) => r.id === roomId);
        return found ? Effect.succeed(found) : Effect.die("not found in test");
      },
      getRooms: () => Effect.succeed(rooms),
      getRoomOverviewRecords: () => Effect.die("not implemented"),
      createRoom: (params: CreateRoomParams) => {
        const room: TripRoom = {
          id: params.id,
          title: params.title,
          destination: params.destination ?? "여행지",
          revision: RevisionSchema.make(1),
          members: [params.hostUser],
          plans: [],
          confirmedPlanId: undefined,
        };
        rooms = [room, ...rooms];
        return Effect.succeed(room);
      },
      updateRoom: () => Effect.die("not implemented"),
      createPlan: (roomId, plan, expectedRevision) => {
        const idx = rooms.findIndex((r) => r.id === roomId);
        const updated: TripRoom = {
          ...rooms[idx],
          plans: [...rooms[idx].plans, plan],
          revision: RevisionSchema.make(expectedRevision + 1),
        };
        rooms = [...rooms.slice(0, idx), updated, ...rooms.slice(idx + 1)];
        return Effect.succeed(updated);
      },
      updatePlan: () => Effect.die("not implemented"),
      saveRoom: (nextRoom, expectedRevision) => {
        const idx = rooms.findIndex((room) => room.id === nextRoom.id);
        const updated: TripRoom = {
          ...nextRoom,
          revision: RevisionSchema.make(expectedRevision + 1),
        };
        rooms = [...rooms.slice(0, idx), updated, ...rooms.slice(idx + 1)];
        return Effect.succeed(updated);
      },
      deletePlanAndAutoUnlist: ({ room: nextRoom, expectedRevision }) => {
        const idx = rooms.findIndex((room) => room.id === nextRoom.id);
        const updated: TripRoom = {
          ...nextRoom,
          revision: RevisionSchema.make(expectedRevision + 1),
        };
        rooms = [...rooms.slice(0, idx), updated, ...rooms.slice(idx + 1)];
        return Effect.succeed(updated);
      },
    });
  };

  describe("1. createTripRoom 고정 ID 테스트", () => {
    it("Test IdGenerator에서 제공한 고정 tripId를 방의 ID로 사용한다", async () => {
      const fixedIdGenerator = createTestIdGenerator({ tripId: "trip-test-001" });
      const testEnv = Layer.merge(
        Layer.merge(createInMemoryRepo(), createSessionLayer()),
        fixedIdGenerator
      );

      const program = createTripRoom({
        title: "도쿄 맛집 탐방",
        destination: "도쿄",
      }).pipe(Effect.provide(testEnv));

      const room = await Effect.runPromise(program);

      expect(room.id).toBe("trip-test-001");
      expect(room.title).toBe("도쿄 맛집 탐방");
    });
  });

  describe("3. Repository가 ID를 재생성하지 않는지 검증 (Input ID = Stored ID = Returned ID)", () => {
    let memoryStore: Record<string, string> = {};

    beforeEach(() => {
      memoryStore = {};
      const mockStorage: Storage = {
        getItem: (key: string) => memoryStore[key] ?? null,
        setItem: (key: string, value: string) => {
          memoryStore[key] = value;
        },
        removeItem: (key: string) => {
          delete memoryStore[key];
        },
        clear: () => {
          memoryStore = {};
        },
        key: (index: number) => Object.keys(memoryStore)[index] ?? null,
        length: Object.keys(memoryStore).length,
      };

      Object.defineProperty(globalThis, "localStorage", {
        value: mockStorage,
        writable: true,
        configurable: true,
      });
    });

    it("LocalTripRoomRepository는 전달받은 ID를 변경 없이 그대로 저장하고 반환한다", async () => {
      const fixedIdGenerator = createTestIdGenerator({ tripId: "trip-preserved-999" });
      const testEnv = Layer.merge(
        Layer.merge(LocalTripRoomRepositoryLayer, createSessionLayer()),
        fixedIdGenerator
      );

      const program = createTripRoom({
        title: "오사카 여행",
        destination: "오사카",
      }).pipe(Effect.provide(testEnv));

      const room = await Effect.runPromise(program);

      // Returned ID 검증
      expect(room.id).toBe("trip-preserved-999");

      // Stored ID 검증 (LocalStorage에 실제로 저장된 데이터 확인)
      const storedJson = memoryStore["galanda_rooms_v1"];
      expect(storedJson).toBeDefined();
      const parsed = JSON.parse(storedJson!);
      expect(parsed[0].id).toBe("trip-preserved-999");
    });
  });

  describe("4. createPlan IdGenerator 적용 검증", () => {
    it("플랜 생성 시 IdGenerator에서 제공한 고정 planId를 할당한다", async () => {
      const sampleRoom: TripRoom = {
        id: TripIdSchema.make("room-plan-test"),
        title: "플랜 테스트 방",
        destination: "서울",
        revision: RevisionSchema.make(1),
        members: [{ id: aliceSession.participantId, name: aliceSession.name, role: "HOST" }],
        plans: [],
        confirmedPlanId: undefined,
      };

      const fixedIdGenerator = createTestIdGenerator({ planId: "plan-test-001" });
      const testEnv = Layer.merge(
        Layer.merge(createInMemoryRepo([sampleRoom]), createSessionLayer()),
        fixedIdGenerator
      );

      const program = createPlan({
        roomId: sampleRoom.id,
        title: "알찬 3박 4일 코스",
        baseHeadcount: 2,
        routes: [{ city: "서울", arrivalDate: "2026-09-01", departureDate: "2026-09-04" }],
        accommodations: [{
          id: "stay-seoul",
          city: "서울",
          period: "2026-09-01 ~ 2026-09-04",
          nights: 3,
          hotelName: "",
          isSearching: true,
          bookingStatus: "NOT_CHECKED",
        }],
        transports: [
          {
            id: "outbound-seoul",
            fromCity: "부산",
            toCity: "서울",
            mode: "",
            hasTransfer: false,
            durationText: "",
            bookingStatus: "NOT_CHECKED",
          },
          {
            id: "return-seoul",
            fromCity: "서울",
            toCity: "부산",
            mode: "",
            hasTransfer: false,
            durationText: "",
            bookingStatus: "NOT_CHECKED",
          },
        ],
        places: [],
        expectedRevision: sampleRoom.revision,
      }).pipe(Effect.provide(testEnv));

      const updatedRoom = await Effect.runPromise(program);

      expect(updatedRoom.plans).toHaveLength(1);
      expect(updatedRoom.plans[0].id).toBe("plan-test-001");
      expect(updatedRoom.plans[0].title).toBe("알찬 3박 4일 코스");
      expect(updatedRoom.plans[0].authorId).toBe(aliceSession.participantId);
    });
  });

  describe("5. IdGeneratorLive 런타임 지연 생성 검증", () => {
    it("IdGeneratorLive는 Effect 실행 시점마다 새로운 UUID를 생성한다", async () => {
      const program = Effect.gen(function* () {
        const ids = yield* IdGenerator;
        const id1 = yield* ids.tripId;
        const id2 = yield* ids.tripId;
      const plan1 = yield* ids.planId;
      const plan2 = yield* ids.planId;
      const invite1 = yield* ids.inviteToken;
      const invite2 = yield* ids.inviteToken;
      return { id1, id2, plan1, plan2, invite1, invite2 };
      }).pipe(Effect.provide(IdGeneratorLive));

      const result = await Effect.runPromise(program);

      expect(result.id1).not.toBe(result.id2);
      expect(result.plan1).not.toBe(result.plan2);
      expect(result.invite1).not.toBe(result.invite2);
      expect(result.id1.length).toBeGreaterThan(10);
      expect(result.plan1.length).toBeGreaterThan(10);
      expect(result.invite1).toMatch(/^[0-9a-f-]{36}$/);
    });
  });
});
