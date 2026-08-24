import { Effect } from "effect";
import { TripRoomRepository } from "../ports/trip-room-repository.ts";
import { requireAuthSession } from "../ports/session.ts";
import {
  requirePlanInRoom,
  requireRoomPermission,
  requireRoomUnconfirmed,
} from "../domain/auth-guards.ts";
import type { PlanId, Revision, TripId } from "../domain/ids.ts";
import type { PlanMemberOpinion } from "../domain/room.ts";
import { ValidationError } from "../domain/errors.ts";
import {
  mergeParticipantIdentityInRoom,
  setPlanOpinionInRoom,
} from "../domain/room-transitions.ts";

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
    const reaction = input.opinion?.reaction;
    if (!["LIKE", "OKAY", "HARD"].includes(reaction)) {
      return yield* Effect.fail(
        new ValidationError({ message: "올바른 반응(리액션)을 선택해주세요." })
      );
    }

    const reason = reaction === "HARD" ? input.opinion.reason?.trim() : undefined;
    if (reaction === "HARD" && !reason) {
      return yield* Effect.fail(
        new ValidationError({ message: "어려운 이유를 입력해주세요." })
      );
    }

    const repo = yield* TripRoomRepository;

    // 3. 방 조회 및 RBAC: 세션 사용자의 'opinion:submit' 권한 검증 (GUEST 차단)
    const storedRoom = yield* repo.getRoom(input.roomId);
    const room = mergeParticipantIdentityInRoom(
      storedRoom,
      session.participantId,
      session.participantIds
    );
    const actor = yield* requireRoomPermission(
      room,
      session.participantIds,
      "opinion:submit",
      "여행방 참여자만 의견 및 투표를 남길 수 있습니다."
    );

    yield* requireRoomUnconfirmed(
      room,
      "확정된 여행에서는 의견을 변경할 수 없습니다."
    );

    // 4. 대상 플랜 존재 여부 검증
    const plan = yield* requirePlanInRoom(room, input.planId);

    // 5. 세션 사용자의 정보로 작성자 고정 (위조 방지)
    const sanitizedOpinion: PlanMemberOpinion = {
      userId: session.participantId,
      userName: actor.member?.name ?? session.name,
      reaction,
      reason,
    };

    return yield* repo.saveRoom(
      setPlanOpinionInRoom(room, plan, sanitizedOpinion),
      input.expectedRevision
    );
  }
);
