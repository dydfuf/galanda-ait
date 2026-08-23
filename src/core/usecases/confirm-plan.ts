import { Effect } from "effect";
import type { PlanId, Revision, TripId } from "../domain/ids.ts";
import { TripRoomRepository } from "../ports/trip-room-repository.ts";
import { requireAuthSession } from "../ports/session.ts";
import {
  isPlanConfirmed,
  requirePlanInRoom,
  requireRoomHost,
} from "../domain/auth-guards.ts";
import { getPlanDateRange } from "../domain/room.ts";
import {
  confirmPlanInRoom,
  mergeParticipantIdentityInRoom,
} from "../domain/room-transitions.ts";
import { ConflictError, ValidationError } from "../domain/errors.ts";

export const confirmTripPlan = Effect.fn("confirmTripPlan")(
  function* (
    roomId: TripId,
    planId: PlanId,
    expectedRevision: Revision
  ) {
    // 1. 인증된 세션 확인
    const session = yield* requireAuthSession(
      "여행안을 확정하려면 로그인이 필요합니다."
    );

    // 2. 방 조회
    const repo = yield* TripRoomRepository;
    const room = mergeParticipantIdentityInRoom(
      yield* repo.getRoom(roomId),
      session.participantId,
      session.participantIds
    );

    // 3. RBAC: 확정은 방장만 수행할 수 있다.
    yield* requireRoomHost(
      room,
      session.participantIds,
      "방장만 여행안을 확정할 수 있습니다."
    );

    // 4. 대상 플랜 유효성 검증
    const plan = yield* requirePlanInRoom(room, planId);

    // 5. 확정은 한 번만 가능하며, 실패 시 저장소를 호출하지 않는다.
    if (room.confirmedPlanId !== undefined || isPlanConfirmed(room, plan)) {
      return yield* Effect.fail(
        new ConflictError({
          message: "이미 확정된 여행안이 있어 다시 확정할 수 없습니다.",
          expectedRevision,
          actualRevision: room.revision,
        })
      );
    }

    if (!getPlanDateRange(plan)) {
      return yield* Effect.fail(
        new ValidationError({ message: "날짜가 있는 여행안만 확정할 수 있습니다." })
      );
    }

    // 6. 확정 실행 (Revision 낙관적 락 보장)
    return yield* repo.saveRoom(
      confirmPlanInRoom(room, plan),
      expectedRevision
    );
  }
);
