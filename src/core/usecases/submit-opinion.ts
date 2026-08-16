import { Effect } from "effect";
import { TripRoomRepository } from "../ports/trip-room-repository.ts";
import {
  requirePlanInRoom,
  requireRoomPermission,
} from "../domain/auth-guards.ts";
import type { PlanId, Revision, TripId } from "../domain/ids.ts";
import type { PlanMemberOpinion, TripRoom } from "../domain/room.ts";
import {
  ValidationError,
  type ConflictError,
  type NotFoundError,
  type UnauthorizedError,
} from "../domain/errors.ts";

export interface SubmitPlanOpinionInput {
  readonly roomId: TripId;
  readonly planId: PlanId;
  readonly opinion: PlanMemberOpinion;
  readonly expectedRevision: Revision;
}

export const submitPlanOpinionUseCase = (
  input: SubmitPlanOpinionInput
): Effect.Effect<
  TripRoom,
  NotFoundError | ConflictError | ValidationError | UnauthorizedError,
  TripRoomRepository
> =>
  Effect.gen(function* () {
    // 1. 의견 입력값 유효성 검증
    if (!["LIKE", "OKAY", "HARD"].includes(input.opinion?.reaction)) {
      return yield* Effect.fail(
        new ValidationError({ message: "올바른 반응(리액션)을 선택해주세요." })
      );
    }

    if (!input.opinion?.userName?.trim()) {
      return yield* Effect.fail(
        new ValidationError({ message: "작성자 이름이 필요합니다." })
      );
    }

    const repo = yield* TripRoomRepository;

    // 2. 방 조회 및 RBAC: 'opinion:submit' 권한 검증 (GUEST 차단)
    const room = yield* repo.getRoom(input.roomId);
    if (input.opinion.userId) {
      yield* requireRoomPermission(
        room,
        input.opinion.userId,
        "opinion:submit",
        "여행방 참여자만 의견 및 투표를 남길 수 있습니다."
      );
    }

    // 3. 대상 플랜 존재 여부 검증
    yield* requirePlanInRoom(room, input.planId);

    // 4. 의견 등록 실행
    const sanitizedOpinion: PlanMemberOpinion = {
      ...input.opinion,
      userName: input.opinion.userName.trim(),
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
  });
