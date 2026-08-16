import { Effect } from "effect";
import { TripRoomRepository } from "../ports/trip-room-repository.ts";
import type { PlanId, Revision, TripId } from "../domain/ids.ts";
import type { TripPlan, TripRoom } from "../domain/room.ts";
import type { ConflictError, NotFoundError } from "../domain/errors.ts";

export interface CreatePlanInput {
  readonly roomId: TripId;
  readonly plan: TripPlan;
  readonly expectedRevision: Revision;
}

export const createPlanUseCase = (
  input: CreatePlanInput
): Effect.Effect<TripRoom, NotFoundError | ConflictError, TripRoomRepository> =>
  Effect.gen(function* () {
    const repo = yield* TripRoomRepository;
    return yield* repo.createPlan(input.roomId, input.plan, input.expectedRevision);
  });

export interface UpdatePlanInput {
  readonly roomId: TripId;
  readonly plan: TripPlan;
  readonly expectedRevision: Revision;
}

export const updatePlanUseCase = (
  input: UpdatePlanInput
): Effect.Effect<TripRoom, NotFoundError | ConflictError, TripRoomRepository> =>
  Effect.gen(function* () {
    const repo = yield* TripRoomRepository;
    return yield* repo.updatePlan(input.roomId, input.plan, input.expectedRevision);
  });

export interface DeletePlanInput {
  readonly roomId: TripId;
  readonly planId: PlanId;
  readonly expectedRevision: Revision;
}

export const deletePlanUseCase = (
  input: DeletePlanInput
): Effect.Effect<TripRoom, NotFoundError | ConflictError, TripRoomRepository> =>
  Effect.gen(function* () {
    const repo = yield* TripRoomRepository;
    return yield* repo.deletePlan(input.roomId, input.planId, input.expectedRevision);
  });
