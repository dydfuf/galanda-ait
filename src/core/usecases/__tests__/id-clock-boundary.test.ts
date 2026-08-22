import { describe, it, expect, beforeEach } from "vitest";
import { Effect, Layer } from "effect";
import { createTripRoom } from "../create-room.ts";
import { createPlan } from "../save-plan.ts";
import { TripRoomRepository, type CreateRoomParams } from "../../ports/trip-room-repository.ts";
import { SessionService } from "../../ports/session.ts";
import { IdGenerator } from "../../ports/id-generator.ts";
import { IdGeneratorLive, createTestIdGenerator } from "../../../infrastructure/id-generator.ts";
import { LocalTripRoomRepositoryLayer } from "../../../infrastructure/local/local-trip-room-repo.ts";
import { SupabaseTripRoomRepositoryLayer } from "../../../infrastructure/supabase/supabase-trip-room-repo.ts";
import { SupabaseClient } from "../../../infrastructure/supabase/supabase-client.ts";
import { TripIdSchema, RevisionSchema, UserIdSchema } from "../../domain/ids.ts";
import type { TripMember, TripRoom, UserSession } from "../../domain/room.ts";

describe("Application / Effect Boundary: IdGenerator & Clock", () => {
  const aliceSession: UserSession = {
    userId: UserIdSchema.make("user-alice"),
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
      saveRoom: () => Effect.die("not implemented"),
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
        members: [{ id: aliceSession.userId, name: aliceSession.name, role: "HOST" }],
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
        places: [],
        expectedRevision: sampleRoom.revision,
      }).pipe(Effect.provide(testEnv));

      const updatedRoom = await Effect.runPromise(program);

      expect(updatedRoom.plans).toHaveLength(1);
      expect(updatedRoom.plans[0].id).toBe("plan-test-001");
      expect(updatedRoom.plans[0].title).toBe("알찬 3박 4일 코스");
      expect(updatedRoom.plans[0].authorId).toBe(aliceSession.userId);
    });
  });

  describe("5. Local / Supabase Repository Contract 일치 확인", () => {
    it("동일한 CreateRoomParams를 Local과 Supabase 저장소에 전달했을 때 id와 주요 필드의 의미가 일치한다", async () => {
      const hostUser: TripMember = {
        id: UserIdSchema.make("user-host-1"),
        name: "호스트",
        role: "HOST",
      };

      const params: CreateRoomParams = {
        id: TripIdSchema.make("room-contract-001"),
        title: "유럽 배낭여행",
        destination: "파리",
        hostUser,
      };

      // 1) Local Repo 실행
      const localResult = await Effect.runPromise(
        Effect.gen(function* () {
          const repo = yield* TripRoomRepository;
          return yield* repo.createRoom(params);
        }).pipe(Effect.provide(LocalTripRoomRepositoryLayer))
      );

      // 2) Supabase Repo 실행 (Mock Client)
      let insertedRow: any = null;
      const fakeClient = {
        from: (_table: string) => ({
          insert: (row: any) => {
            insertedRow = row;
            return {
              select: () => ({
                single: () =>
                  Promise.resolve({
                    data: {
                      id: row.id,
                      title: row.title,
                      destination: row.destination,
                      revision: 1,
                      members: [row.host_user],
                      plans: [],
                      confirmedPlanId: undefined,
                    },
                    error: null,
                  }),
              }),
            };
          },
        }),
      };

      const SupabaseTestLayer = SupabaseTripRoomRepositoryLayer.pipe(
        Layer.provide(Layer.succeed(SupabaseClient, { client: fakeClient as any }))
      );

      const supabaseResult = await Effect.runPromise(
        Effect.gen(function* () {
          const repo = yield* TripRoomRepository;
          return yield* repo.createRoom(params);
        }).pipe(Effect.provide(SupabaseTestLayer))
      );

      // 계약 일치 검증: 두 구현체 모두 호출자가 제공한 ID를 정확히 유지함
      expect(localResult.id).toBe("room-contract-001");
      expect(supabaseResult.id).toBe("room-contract-001");
      expect(insertedRow.id).toBe("room-contract-001");

      expect(localResult.title).toBe(supabaseResult.title);
      expect(localResult.destination).toBe(supabaseResult.destination);
      expect(localResult.revision).toBe(supabaseResult.revision);
    });
  });

  describe("6. IdGeneratorLive 런타임 지연 생성 검증", () => {
    it("IdGeneratorLive는 Effect 실행 시점마다 새로운 UUID를 생성한다", async () => {
      const program = Effect.gen(function* () {
        const ids = yield* IdGenerator;
        const id1 = yield* ids.tripId;
        const id2 = yield* ids.tripId;
        const plan1 = yield* ids.planId;
        const plan2 = yield* ids.planId;
        return { id1, id2, plan1, plan2 };
      }).pipe(Effect.provide(IdGeneratorLive));

      const result = await Effect.runPromise(program);

      expect(result.id1).not.toBe(result.id2);
      expect(result.plan1).not.toBe(result.plan2);
      expect(result.id1.length).toBeGreaterThan(10);
      expect(result.plan1.length).toBeGreaterThan(10);
    });
  });
});
