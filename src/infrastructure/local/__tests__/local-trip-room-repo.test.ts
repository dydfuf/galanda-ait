import { describe, it, expect, beforeEach } from "vitest";
import { Effect, Exit } from "effect";
import { LocalTripRoomRepositoryLayer } from "../local-trip-room-repo.ts";
import { TripRoomRepository } from "../../../core/ports/trip-room-repository.ts";
import {
  PlanIdSchema,
  RevisionSchema,
  TripIdSchema,
  UserIdSchema,
} from "../../../core/domain/ids.ts";

const STORAGE_KEY = "galanda_rooms_v1";

describe("LocalTripRoomRepository", () => {
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

  it("1. 정상적인 빈 목록: LocalStorage에 아무것도 없을 때 getRooms()는 Effect.succeed([])를 반환한다", async () => {
    const program = Effect.gen(function* () {
      const repo = yield* TripRoomRepository;
      return yield* repo.getRooms([UserIdSchema.make("viewer")]);
    }).pipe(Effect.provide(LocalTripRoomRepositoryLayer));

    const exit = await Effect.runPromiseExit(program);

    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isSuccess(exit)) {
      expect(exit.value).toEqual([]);
    }
  });

  it("2. LocalStorage 데이터 손상: JSON 파싱 실패 시 RepositoryError로 실패한다", async () => {
    memoryStore[STORAGE_KEY] = "{ invalid json";

    const program = Effect.gen(function* () {
      const repo = yield* TripRoomRepository;
      return yield* repo.getRooms([UserIdSchema.make("viewer")]);
    }).pipe(Effect.provide(LocalTripRoomRepositoryLayer));

    const exit = await Effect.runPromiseExit(program);

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const err = exit.cause;
      expect(JSON.stringify(err)).toContain("RepositoryError");
    }
  });

  it("3. Domain Schema 불일치: JSON은 유효하지만 스키마가 안 맞으면 RepositoryError로 실패한다", async () => {
    memoryStore[STORAGE_KEY] = JSON.stringify([{ hello: "world" }]);

    const program = Effect.gen(function* () {
      const repo = yield* TripRoomRepository;
      return yield* repo.getRooms([UserIdSchema.make("viewer")]);
    }).pipe(Effect.provide(LocalTripRoomRepositoryLayer));

    const exit = await Effect.runPromiseExit(program);

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const err = exit.cause;
      expect(JSON.stringify(err)).toContain("RepositoryError");
    }
  });

  it("createRoom initialPlan을 방과 함께 single write로 저장한다 (RAON-261 DISC-7)", async () => {
    const roomId = TripIdSchema.make("room-import-local");
    const hostId = UserIdSchema.make("host-local");
    const program = Effect.gen(function* () {
      const repo = yield* TripRoomRepository;
      return yield* repo.createRoom({
        id: roomId,
        title: "가져온 여행",
        destination: "오사카",
        hostUser: { id: hostId, name: "Host", role: "HOST" },
        initialPlan: {
          id: PlanIdSchema.make("plan-local-imported"),
          title: "가져온 여행안",
          status: "VOTING",
          revision: RevisionSchema.make(1),
          places: [],
          voteCount: 0,
        },
      });
    }).pipe(Effect.provide(LocalTripRoomRepositoryLayer));

    const exit = await Effect.runPromiseExit(program);
    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isSuccess(exit)) {
      expect(exit.value.plans).toHaveLength(1);
      expect(exit.value.plans[0]!.id).toBe("plan-local-imported");
    }
    // 저장된 스토리지에도 room+plan이 한 번에 반영된다.
    expect(memoryStore[STORAGE_KEY]).toContain("plan-local-imported");
  });

  it("참여 중인 방만 반환한다", async () => {
    const aliceId = UserIdSchema.make("alice");
    const bobId = UserIdSchema.make("bob");
    const program = Effect.gen(function* () {
      const repo = yield* TripRoomRepository;
      yield* repo.createRoom({
        id: TripIdSchema.make("alice-room"),
        title: "앨리스 여행",
        hostUser: { id: aliceId, name: "Alice", role: "HOST" },
      });
      yield* repo.createRoom({
        id: TripIdSchema.make("bob-room"),
        title: "밥 여행",
        hostUser: { id: bobId, name: "Bob", role: "HOST" },
      });
      return yield* repo.getRooms([aliceId]);
    }).pipe(Effect.provide(LocalTripRoomRepositoryLayer));

    const rooms = await Effect.runPromise(program);
    expect(rooms.map(({ id }) => id)).toEqual(["alice-room"]);
  });

  it("4. 특정 방이 존재하지 않을 때 getRoom()은 NotFoundError로 실패한다", async () => {
    const program = Effect.gen(function* () {
      const repo = yield* TripRoomRepository;
      return yield* repo.getRoom(TripIdSchema.make("non-existent-room"));
    }).pipe(Effect.provide(LocalTripRoomRepositoryLayer));

    const exit = await Effect.runPromiseExit(program);

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const err = exit.cause;
      expect(JSON.stringify(err)).toContain("NotFoundError");
    }
  });

  it("5. 방 수정 시 revision 불일치는 RevisionConflictError로 실패한다", async () => {
    const program = Effect.gen(function* () {
      const repo = yield* TripRoomRepository;
      const room = yield* repo.createRoom({
        id: TripIdSchema.make("room-1"),
        title: "제주도 여행",
        hostUser: { id: UserIdSchema.make("host-1"), name: "Host", role: "HOST" },
      });
      return yield* repo.updateRoom(
        room.id,
        { title: "수정된 여행" },
        RevisionSchema.make(999)
      );
    }).pipe(Effect.provide(LocalTripRoomRepositoryLayer));

    const exit = await Effect.runPromiseExit(program);

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const err = exit.cause;
      expect(JSON.stringify(err)).toContain("RevisionConflictError");
    }
  });

  it("6. LocalStorage 저장 실패 시 RepositoryError로 실패한다", async () => {
    const brokenStorage: Storage = {
      getItem: () => "[]",
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
      removeItem: () => {},
      clear: () => {},
      key: () => null,
      length: 0,
    };

    Object.defineProperty(globalThis, "localStorage", {
      value: brokenStorage,
      writable: true,
      configurable: true,
    });

    const program = Effect.gen(function* () {
      const repo = yield* TripRoomRepository;
      return yield* repo.createRoom({
        id: TripIdSchema.make("room-1"),
        title: "제주도 여행",
        hostUser: { id: UserIdSchema.make("host-1"), name: "Host", role: "HOST" },
      });
    }).pipe(Effect.provide(LocalTripRoomRepositoryLayer));

    const exit = await Effect.runPromiseExit(program);

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const err = exit.cause;
      expect(JSON.stringify(err)).toContain("RepositoryError");
    }
  });

  it("7. saveRoom은 전달받은 aggregate를 저장하고 revision을 증가시킨다", async () => {
    const program = Effect.gen(function* () {
      const repo = yield* TripRoomRepository;
      const room = yield* repo.createRoom({
        id: TripIdSchema.make("room-1"),
        title: "제주도 여행",
        hostUser: { id: UserIdSchema.make("host-1"), name: "Host", role: "HOST" },
      });
      const withPlan = yield* repo.createPlan(
        room.id,
        {
          id: PlanIdSchema.make("plan-1"),
          title: "기본안",
          status: "DRAFT",
          places: [],
          voteCount: 0,
        },
        room.revision
      );
      return yield* repo.saveRoom(
        { ...withPlan, title: "저장된 여행" },
        withPlan.revision
      );
    }).pipe(Effect.provide(LocalTripRoomRepositoryLayer));

    const room = await Effect.runPromise(program);
    expect(room.title).toBe("저장된 여행");
    expect(room.revision).toBe(3);
  });

  it("legacy Room 날짜와 nights 기반 routes를 adapter 입구에서 날짜 기반 모델로 정상화한다", async () => {
    memoryStore[STORAGE_KEY] = JSON.stringify([{
      id: "legacy-room",
      title: "일본 여행",
      destination: "일본",
      startDate: "2026-12-10",
      endDate: "2026-12-15",
      revision: 1,
      members: [{ id: "host-1", name: "Host", role: "HOST" }],
      plans: [{ id: "plan-a", title: "기본안", status: "DRAFT", routes: [{ city: "도쿄", nights: 3 }, { city: "하코네", nights: 2 }], places: [], voteCount: 0 }],
    }]);

    const room = await Effect.runPromise(Effect.gen(function* () {
      const repo = yield* TripRoomRepository;
      return yield* repo.getRoom(TripIdSchema.make("legacy-room"));
    }).pipe(Effect.provide(LocalTripRoomRepositoryLayer)));

    expect("startDate" in room).toBe(false);
    expect(room.plans[0].routes).toEqual([
      { city: "도쿄", arrivalDate: "2026-12-10", departureDate: "2026-12-13" },
      { city: "하코네", arrivalDate: "2026-12-13", departureDate: "2026-12-15" },
    ]);
  });

  it("잘못된 legacy 시작일은 예외를 던지지 않고 복원 불가능한 route를 제외한다", async () => {
    memoryStore[STORAGE_KEY] = JSON.stringify([{
      id: "invalid-date-room",
      title: "손상된 여행",
      destination: "미정",
      startDate: "invalid",
      endDate: "2026-12-15",
      revision: 1,
      members: [{ id: "host-1", name: "Host", role: "HOST" }],
      plans: [{ id: "plan-a", title: "기본안", status: "DRAFT", routes: [{ city: "도쿄", nights: 3 }], places: [], voteCount: 0 }],
    }]);

    const room = await Effect.runPromise(Effect.gen(function* () {
      const repo = yield* TripRoomRepository;
      return yield* repo.getRoom(TripIdSchema.make("invalid-date-room"));
    }).pipe(Effect.provide(LocalTripRoomRepositoryLayer)));

    expect(room.plans[0].routes).toEqual([]);
  });
});
