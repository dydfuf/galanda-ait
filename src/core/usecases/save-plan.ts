import { Effect } from "effect";
import { TripRoomRepository } from "../ports/trip-room-repository.ts";
import { SessionService, requireAuthSession } from "../ports/session.ts";
import { calculatePlanDifference } from "../calculations/plan-diff.ts";
import {
  requirePlanInRoom,
  requireRoomPermission,
} from "../domain/auth-guards.ts";
import type { PlanId, Revision, TripId } from "../domain/ids.ts";
import type { TripPlan, TripRoom } from "../domain/room.ts";
import {
  ValidationError,
  type ConflictError,
  type NotFoundError,
  type UnauthorizedError,
} from "../domain/errors.ts";

export interface CreatePlanInput {
  readonly roomId: TripId;
  readonly plan: TripPlan;
  readonly expectedRevision: Revision;
}

export const createPlanUseCase = (
  input: CreatePlanInput
): Effect.Effect<
  TripRoom,
  NotFoundError | ConflictError | ValidationError | UnauthorizedError,
  TripRoomRepository | SessionService
> =>
  Effect.gen(function* () {
    // 1. 여행안 제목 유효성 검증
    if (!input.plan.title?.trim()) {
      return yield* Effect.fail(
        new ValidationError({ message: "여행안 제목을 입력해주세요." })
      );
    }

    // 2. 인원수 유효성 검증
    if (input.plan.baseHeadcount !== undefined && input.plan.baseHeadcount < 1) {
      return yield* Effect.fail(
        new ValidationError({ message: "기준 인원수는 1명 이상이어야 합니다." })
      );
    }

    // 3. 인증 세션 확인 (단일 권한 주체)
    const session = yield* requireAuthSession(
      "여행안을 작성하려면 로그인이 필요합니다."
    );

    const repo = yield* TripRoomRepository;
    const room = yield* repo.getRoom(input.roomId);

    // 4. RBAC: 세션 사용자의 'plan:create' 권한 검증
    yield* requireRoomPermission(
      room,
      session.userId,
      "plan:create",
      "여행방 참여자만 여행안을 작성할 수 있습니다."
    );

    let finalPlan: TripPlan = {
      ...input.plan,
      title: input.plan.title.trim(),
      authorId: session.userId,
      authorName: session.name,
    };

    // 5. 복제된 여행안인 경우, 원본 대비 변경점 요약 자동 산출
    if (finalPlan.clonedFromPlanId && !finalPlan.differenceSummary) {
      const originalPlan = room.plans.find(
        (p) => p.id === finalPlan.clonedFromPlanId
      );
      if (originalPlan) {
        const diff = calculatePlanDifference(originalPlan, finalPlan);
        finalPlan = {
          ...finalPlan,
          differenceSummary: diff.summaryText,
        };
      }
    }

    return yield* repo.createPlan(
      input.roomId,
      finalPlan,
      input.expectedRevision
    );
  });

export interface UpdatePlanInput {
  readonly roomId: TripId;
  readonly plan: TripPlan;
  readonly expectedRevision: Revision;
}

export const updatePlanUseCase = (
  input: UpdatePlanInput
): Effect.Effect<
  TripRoom,
  NotFoundError | ConflictError | ValidationError | UnauthorizedError,
  TripRoomRepository | SessionService
> =>
  Effect.gen(function* () {
    // 1. 여행안 제목 유효성 검증
    if (!input.plan.title?.trim()) {
      return yield* Effect.fail(
        new ValidationError({ message: "여행안 제목을 입력해주세요." })
      );
    }

    // 2. 인원수 유효성 검증
    if (input.plan.baseHeadcount !== undefined && input.plan.baseHeadcount < 1) {
      return yield* Effect.fail(
        new ValidationError({ message: "기준 인원수는 1명 이상이어야 합니다." })
      );
    }

    // 3. 인증 세션 확인
    const session = yield* requireAuthSession(
      "여행안을 수정하려면 로그인이 필요합니다."
    );

    const repo = yield* TripRoomRepository;
    const room = yield* repo.getRoom(input.roomId);
    const existingPlan = yield* requirePlanInRoom(room, input.plan.id);

    // 4. RBAC: 세션 사용자의 'plan:update' 권한 검증
    yield* requireRoomPermission(
      room,
      session.userId,
      "plan:update",
      "여행방 참여자만 여행안을 수정할 수 있습니다."
    );

    let finalPlan: TripPlan = {
      ...input.plan,
      title: input.plan.title.trim(),
      authorId: existingPlan.authorId,
      authorName: existingPlan.authorName,
    };

    // 5. 복제된 여행안인 경우, 변경사항 재계산하여 동기화
    if (finalPlan.clonedFromPlanId) {
      const originalPlan = room.plans.find(
        (p) => p.id === finalPlan.clonedFromPlanId
      );
      if (originalPlan) {
        const diff = calculatePlanDifference(originalPlan, finalPlan);
        finalPlan = {
          ...finalPlan,
          differenceSummary: diff.summaryText,
        };
      }
    }

    return yield* repo.updatePlan(
      input.roomId,
      finalPlan,
      input.expectedRevision
    );
  });

export interface DeletePlanInput {
  readonly roomId: TripId;
  readonly planId: PlanId;
  readonly expectedRevision: Revision;
}

export const deletePlanUseCase = (
  input: DeletePlanInput
): Effect.Effect<
  TripRoom,
  NotFoundError | ConflictError | ValidationError | UnauthorizedError,
  TripRoomRepository | SessionService
> =>
  Effect.gen(function* () {
    // 1. 인증 세션 확인
    const session = yield* requireAuthSession(
      "여행안을 삭제하려면 로그인이 필요합니다."
    );

    const repo = yield* TripRoomRepository;
    const room = yield* repo.getRoom(input.roomId);
    yield* requirePlanInRoom(room, input.planId);

    // 2. RBAC: 세션 사용자의 'plan:delete' 권한 검증
    yield* requireRoomPermission(
      room,
      session.userId,
      "plan:delete",
      "여행방 참여자만 여행안을 삭제할 수 있습니다."
    );

    return yield* repo.deletePlan(
      input.roomId,
      input.planId,
      input.expectedRevision
    );
  });
