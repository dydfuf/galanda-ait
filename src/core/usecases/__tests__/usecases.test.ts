import { describe, it, expect } from "vitest";
import { Effect, Exit, Layer, Option } from "effect";
import { TripRoomRepository } from "../../ports/trip-room-repository.ts";
import { findTripRoom, getTripRooms } from "../get-room.ts";
import { createTripRoom } from "../create-room.ts";
import { LocalSessionLayer } from "../../../infrastructure/local/local-session.ts";
import {
  NotFoundError,
  RepositoryError,
} from "../../domain/errors.ts";
import { TripIdSchema, type TripId } from "../../domain/ids.ts";

describe("UseCases Error Propagation", () => {
  it("getTripRooms()는 RepositoryError를 숨기지 않고 상위로 전파한다", async () => {
    const FailingRepoLayer = Layer.succeed(TripRoomRepository, {
      getRooms: () =>
        Effect.fail(
          new RepositoryError({
            operation: "getRooms",
            message: "DB 연결 실패",
          })
        ),
    } as any);

    const program = getTripRooms().pipe(Effect.provide(FailingRepoLayer));
    const exit = await Effect.runPromiseExit(program);

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(JSON.stringify(exit.cause)).toContain("RepositoryError");
    }
  });

  it("findTripRoom()은 NotFoundError일 때는 Option.none()을 반환하지만 RepositoryError는 전파한다", async () => {
    const NotFoundRepoLayer = Layer.succeed(TripRoomRepository, {
      getRoom: (roomId: TripId) =>
        Effect.fail(new NotFoundError({ entity: "TripRoom", id: roomId })),
    } as any);

    const nfProgram = findTripRoom(TripIdSchema.make("room-1")).pipe(
      Effect.provide(NotFoundRepoLayer)
    );
    const nfExit = await Effect.runPromiseExit(nfProgram);

    expect(Exit.isSuccess(nfExit)).toBe(true);
    if (Exit.isSuccess(nfExit)) {
      expect(Option.isNone(nfExit.value)).toBe(true);
    }

    const ErrorRepoLayer = Layer.succeed(TripRoomRepository, {
      getRoom: () =>
        Effect.fail(
          new RepositoryError({
            operation: "getRoom",
            message: "DB 다운",
          })
        ),
    } as any);

    const errProgram = findTripRoom(TripIdSchema.make("room-1")).pipe(
      Effect.provide(ErrorRepoLayer)
    );
    const errExit = await Effect.runPromiseExit(errProgram);

    expect(Exit.isFailure(errExit)).toBe(true);
    if (Exit.isFailure(errExit)) {
      expect(JSON.stringify(errExit.cause)).toContain("RepositoryError");
    }
  });

  it("createTripRoom()는 스키마 유효성 실패 시 ValidationError, 저장소 실패 시 RepositoryError를 전파한다", async () => {
    const FailingRepoLayer = Layer.succeed(TripRoomRepository, {
      createRoom: () =>
        Effect.fail(
          new RepositoryError({
            operation: "createRoom",
            message: "저장 실패",
          })
        ),
    } as any);

    const CombinedLayer = Layer.merge(FailingRepoLayer, LocalSessionLayer);

    // 1. 유효성 검증 실패
    const invalidProgram = createTripRoom({ title: "   " }).pipe(
      Effect.provide(CombinedLayer)
    );
    const invalidExit = await Effect.runPromiseExit(invalidProgram);
    expect(Exit.isFailure(invalidExit)).toBe(true);
    if (Exit.isFailure(invalidExit)) {
      expect(JSON.stringify(invalidExit.cause)).toContain("ValidationError");
    }

    // 2. 유효성 성공 후 저장소 오류 전파
    const validProgram = createTripRoom({
      title: "제주 여행",
    }).pipe(Effect.provide(CombinedLayer));
    const validExit = await Effect.runPromiseExit(validProgram);
    expect(Exit.isFailure(validExit)).toBe(true);
    if (Exit.isFailure(validExit)) {
      expect(JSON.stringify(validExit.cause)).toContain("RepositoryError");
    }
  });
});
