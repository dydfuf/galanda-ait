import { Effect } from "effect";
import type { PlanId, Revision, TripId } from "../domain/ids.ts";
import { TripRoomRepository } from "../ports/trip-room-repository.ts";
import { SessionService } from "../ports/session.ts";
import { UnauthorizedError } from "../domain/errors.ts";
import type { ConflictError, NotFoundError } from "../domain/errors.ts";
import type { TripRoom } from "../domain/room.ts";

export const confirmTripPlan = (
  roomId: TripId,
  planId: PlanId,
  expectedRevision: Revision
): Effect.Effect<
  TripRoom,
  NotFoundError | ConflictError | UnauthorizedError,
  TripRoomRepository | SessionService
> =>
  Effect.gen(function* () {
    const sessionService = yield* SessionService;
    const session = yield* sessionService.getCurrentSession();

    if (!session.isAuthenticated) {
      return yield* Effect.fail(
        new UnauthorizedError({ reason: "로그인이 필요합니다." })
      );
    }

    const repo = yield* TripRoomRepository;
    return yield* repo.confirmPlan(roomId, planId, expectedRevision);
  });
