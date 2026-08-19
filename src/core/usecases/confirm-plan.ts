import { Effect } from "effect";
import type { PlanId, Revision, TripId } from "../domain/ids.ts";
import { TripRoomRepository } from "../ports/trip-room-repository.ts";
import { SessionService, requireAuthSession } from "../ports/session.ts";
import {
  requirePlanInRoom,
  requireRoomPermission,
} from "../domain/auth-guards.ts";
import type {
  ConflictError,
  NotFoundError,
  RepositoryError,
  SessionUnavailableError,
  UnauthorizedError,
} from "../domain/errors.ts";
import type { TripRoom } from "../domain/room.ts";

export const confirmTripPlan = (
  roomId: TripId,
  planId: PlanId,
  expectedRevision: Revision
): Effect.Effect<
  TripRoom,
  NotFoundError | ConflictError | UnauthorizedError | SessionUnavailableError | RepositoryError,
  TripRoomRepository | SessionService
> =>
  Effect.gen(function* () {
    // 1. 인증된 세션 확인
    const session = yield* requireAuthSession(
      "여행안을 확정하려면 로그인이 필요합니다."
    );

    // 2. 방 조회
    const repo = yield* TripRoomRepository;
    const room = yield* repo.getRoom(roomId);

    // 3. RBAC: 'plan:confirm' 권한 검증 (GUEST 차단 및 참여자 확인)
    yield* requireRoomPermission(
      room,
      session.userId,
      "plan:confirm",
      "여행방 참여자만 여행안을 확정할 수 있습니다."
    );

    // 4. 대상 플랜 유효성 검증
    const plan = yield* requirePlanInRoom(room, planId);

    // 5. 이미 확정된 상태인 경우 멱등하게 현재 방 반환
    if (room.confirmedPlanId === planId && plan.status === "CONFIRMED") {
      return room;
    }

    // 6. 확정 실행 (Revision 낙관적 락 보장)
    return yield* repo.confirmPlan(roomId, planId, expectedRevision);
  });
