import { Effect } from "effect";
import { TripRoomRepository } from "../ports/trip-room-repository.ts";
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
  TripRoomRepository
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

    const repo = yield* TripRoomRepository;
    const room = yield* repo.getRoom(input.roomId);

    // 3. RBAC: 'plan:create' 권한 검증 (GUEST 차단)
    if (input.plan.authorId) {
      yield* requireRoomPermission(
        room,
        input.plan.authorId,
        "plan:create",
        "여행방 참여자만 여행안을 작성할 수 있습니다."
      );
    }

    let finalPlan = {
      ...input.plan,
      title: input.plan.title.trim(),
    };

    // 4. 복제된 여행안인 경우, 원본 대비 변경점 요약 자동 산출
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
  NotFoundError | ConflictError | ValidationError,
  TripRoomRepository
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

    const repo = yield* TripRoomRepository;
    const room = yield* repo.getRoom(input.roomId);
    yield* requirePlanInRoom(room, input.plan.id);

    let finalPlan = {
      ...input.plan,
      title: input.plan.title.trim(),
    };

    // 3. 복제된 여행안인 경우, 변경사항 재계산하여 동기화
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
  NotFoundError | ConflictError | ValidationError,
  TripRoomRepository
> =>
  Effect.gen(function* () {
    const repo = yield* TripRoomRepository;
    const room = yield* repo.getRoom(input.roomId);
    yield* requirePlanInRoom(room, input.planId);

    return yield* repo.deletePlan(
      input.roomId,
      input.planId,
      input.expectedRevision
    );
  });
