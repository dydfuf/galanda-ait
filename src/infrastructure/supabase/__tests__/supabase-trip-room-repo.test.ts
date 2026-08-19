import { describe, it, expect, vi } from "vitest";
import { Effect, Exit, Layer } from "effect";
import { SupabaseClient } from "../supabase-client.ts";
import { SupabaseTripRoomRepositoryLayer } from "../supabase-trip-room-repo.ts";
import { TripRoomRepository } from "../../../core/ports/trip-room-repository.ts";
import { TripIdSchema, RevisionSchema } from "../../../core/domain/ids.ts";

describe("SupabaseTripRoomRepository", () => {
  it("1. Supabase 정상 조회 + 데이터 없음: getRooms()는 Effect.succeed([])를 반환한다", async () => {
    const mockClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    };

    const MockClientLayer = Layer.succeed(SupabaseClient, {
      client: mockClient as any,
    });

    const program = Effect.gen(function* () {
      const repo = yield* TripRoomRepository;
      return yield* repo.getRooms();
    }).pipe(
      Effect.provide(
        SupabaseTripRoomRepositoryLayer.pipe(Layer.provide(MockClientLayer))
      )
    );

    const exit = await Effect.runPromiseExit(program);

    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isSuccess(exit)) {
      expect(exit.value).toEqual([]);
    }
  });

  it("2. Supabase 조회 실패: getRooms()에서 DB 오류 발생 시 RepositoryError로 실패한다 (빈 배열이나 성공이 아님)", async () => {
    const mockClient = {
      from: vi.fn().mockReturnValue({
        select: vi
          .fn()
          .mockResolvedValue({ data: null, error: { message: "connection failed" } }),
      }),
    };

    const MockClientLayer = Layer.succeed(SupabaseClient, {
      client: mockClient as any,
    });

    const program = Effect.gen(function* () {
      const repo = yield* TripRoomRepository;
      return yield* repo.getRooms();
    }).pipe(
      Effect.provide(
        SupabaseTripRoomRepositoryLayer.pipe(Layer.provide(MockClientLayer))
      )
    );

    const exit = await Effect.runPromiseExit(program);

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const err = exit.cause;
      expect(JSON.stringify(err)).toContain("RepositoryError");
    }
  });

  it("3. Supabase Schema decode 오류 시 RepositoryError로 실패한다", async () => {
    const mockClient = {
      from: vi.fn().mockReturnValue({
        select: vi
          .fn()
          .mockResolvedValue({ data: [{ invalidField: 123 }], error: null }),
      }),
    };

    const MockClientLayer = Layer.succeed(SupabaseClient, {
      client: mockClient as any,
    });

    const program = Effect.gen(function* () {
      const repo = yield* TripRoomRepository;
      return yield* repo.getRooms();
    }).pipe(
      Effect.provide(
        SupabaseTripRoomRepositoryLayer.pipe(Layer.provide(MockClientLayer))
      )
    );

    const exit = await Effect.runPromiseExit(program);

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const err = exit.cause;
      expect(JSON.stringify(err)).toContain("RepositoryError");
    }
  });

  it("4. 특정 방이 없음: row가 없을 때 getRoom()은 NotFoundError로 실패한다", async () => {
    const mockClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    };

    const MockClientLayer = Layer.succeed(SupabaseClient, {
      client: mockClient as any,
    });

    const program = Effect.gen(function* () {
      const repo = yield* TripRoomRepository;
      return yield* repo.getRoom(TripIdSchema.make("non-existent-room"));
    }).pipe(
      Effect.provide(
        SupabaseTripRoomRepositoryLayer.pipe(Layer.provide(MockClientLayer))
      )
    );

    const exit = await Effect.runPromiseExit(program);

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const err = exit.cause;
      expect(JSON.stringify(err)).toContain("NotFoundError");
    }
  });

  it("5. 특정 방 조회 중 DB 오류: query 실패 시 NotFoundError가 아니라 RepositoryError로 실패한다", async () => {
    const mockClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi
              .fn()
              .mockResolvedValue({ data: null, error: { message: "Database error" } }),
          }),
        }),
      }),
    };

    const MockClientLayer = Layer.succeed(SupabaseClient, {
      client: mockClient as any,
    });

    const program = Effect.gen(function* () {
      const repo = yield* TripRoomRepository;
      return yield* repo.getRoom(TripIdSchema.make("room-1"));
    }).pipe(
      Effect.provide(
        SupabaseTripRoomRepositoryLayer.pipe(Layer.provide(MockClientLayer))
      )
    );

    const exit = await Effect.runPromiseExit(program);

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const err = exit.cause;
      expect(JSON.stringify(err)).toContain("RepositoryError");
      expect(JSON.stringify(err)).not.toContain("NotFoundError");
    }
  });

  it("6. RPC 수정 시 revision conflict는 ConflictError로 변환된다", async () => {
    const mockClient = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { code: "P0001", message: "conflict revision mismatch" },
      }),
    };

    const MockClientLayer = Layer.succeed(SupabaseClient, {
      client: mockClient as any,
    });

    const program = Effect.gen(function* () {
      const repo = yield* TripRoomRepository;
      return yield* repo.updateRoom(
        TripIdSchema.make("room-1"),
        { title: "새 제목" },
        RevisionSchema.make(1)
      );
    }).pipe(
      Effect.provide(
        SupabaseTripRoomRepositoryLayer.pipe(Layer.provide(MockClientLayer))
      )
    );

    const exit = await Effect.runPromiseExit(program);

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const err = exit.cause;
      expect(JSON.stringify(err)).toContain("ConflictError");
    }
  });

  it("7. RPC 충돌 시 DB의 최신 revision을 조회하여 ConflictError.actualRevision에 반영한다", async () => {
    const mockClient = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { code: "P0001", message: "conflict revision mismatch" },
      }),
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { revision: 3 },
              error: null,
            }),
          }),
        }),
      }),
    };

    const MockClientLayer = Layer.succeed(SupabaseClient, {
      client: mockClient as any,
    });

    const program = Effect.gen(function* () {
      const repo = yield* TripRoomRepository;
      return yield* repo.updateRoom(
        TripIdSchema.make("room-1"),
        { title: "새 제목" },
        RevisionSchema.make(1)
      );
    }).pipe(
      Effect.provide(
        SupabaseTripRoomRepositoryLayer.pipe(Layer.provide(MockClientLayer))
      )
    );

    try {
      await Effect.runPromise(program);
      expect.unreachable("should fail");
    } catch (err: any) {
      expect(err._tag).toBe("ConflictError");
      expect(err.expectedRevision).toBe(1);
      expect(err.actualRevision).toBe(3);
    }
  });

  it("8. plan 수정 RPC 충돌 시에도 DB의 실제 revision(actualRevision)을 정확히 보고한다", async () => {
    const mockClient = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { code: "P0001", message: "conflict revision mismatch" },
      }),
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { revision: 5 },
              error: null,
            }),
          }),
        }),
      }),
    };

    const MockClientLayer = Layer.succeed(SupabaseClient, {
      client: mockClient as any,
    });

    const dummyPlan = {
      id: "plan-1" as any,
      title: "후쿠오카 3박4일",
      status: "DRAFT" as const,
      places: [],
      voteCount: 0,
    };

    const program = Effect.gen(function* () {
      const repo = yield* TripRoomRepository;
      return yield* repo.createPlan(
        TripIdSchema.make("room-1"),
        dummyPlan,
        RevisionSchema.make(2)
      );
    }).pipe(
      Effect.provide(
        SupabaseTripRoomRepositoryLayer.pipe(Layer.provide(MockClientLayer))
      )
    );

    try {
      await Effect.runPromise(program);
      expect.unreachable("should fail");
    } catch (err: any) {
      expect(err._tag).toBe("ConflictError");
      expect(err.expectedRevision).toBe(2);
      expect(err.actualRevision).toBe(5);
    }
  });
});
