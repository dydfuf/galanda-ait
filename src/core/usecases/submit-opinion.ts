import { Effect } from "effect";
import { TripRoomRepository } from "../ports/trip-room-repository.ts";
import { requireAuthSession } from "../ports/session.ts";
import {
  requirePlanInRoom,
  requireRoomPermission,
} from "../domain/auth-guards.ts";
import type { PlanId, Revision, TripId } from "../domain/ids.ts";
import type { PlanMemberOpinion } from "../domain/room.ts";
import { ValidationError } from "../domain/errors.ts";

/**
 * 의견 제출 입력
 * - 작성자 신원은 세션에서만 결정되므로 호출자가 userId/userName을 넘길 수 없다
 */
export interface SubmitPlanOpinionInput {
  readonly roomId: TripId;
  readonly planId: PlanId;
  readonly opinion: {
    readonly reaction: "LIKE" | "OKAY" | "HARD";
    readonly reason?: string;
  };
  readonly expectedRevision: Revision;
}

export const submitOpinion = Effect.fn("submitOpinion")(
  function* (input: SubmitPlanOpinionInput) {
    // 1. 인증 세션 확인 (세션 사용자 단일 주체 강제)
    const session = yield* requireAuthSession(
      "의견을 등록하려면 로그인이 필요합니다."
    );

    // 2. 의견 입력값 유효성 검증
    if (!["LIKE", "OKAY", "HARD"].includes(input.opinion?.reaction)) {
      return yield* Effect.fail(
        new ValidationError({ message: "올바른 반응(리액션)을 선택해주세요." })
      );
    }

    const repo = yield* TripRoomRepository;

    // 3. 방 조회 및 RBAC: 세션 사용자의 'opinion:submit' 권한 검증 (GUEST 차단)
    const room = yield* repo.getRoom(input.roomId);
    yield* requireRoomPermission(
      room,
      session.userId,
      "opinion:submit",
      "여행방 참여자만 의견 및 투표를 남길 수 있습니다."
    );

    // 4. 대상 플랜 존재 여부 검증
    yield* requirePlanInRoom(room, input.planId);

    // 5. 세션 사용자의 정보로 작성자 고정 (위조 방지)
    const sanitizedOpinion: PlanMemberOpinion = {
      userId: session.userId,
      userName: session.name,
      reaction: input.opinion.reaction,
      reason: input.opinion.reason?.trim()
        ? input.opinion.reason.trim()
        : undefined,
    };

    return yield* repo.setPlanOpinion(
      input.roomId,
      input.planId,
      sanitizedOpinion,
      input.expectedRevision
    );
  }
);
