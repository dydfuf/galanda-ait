import { Effect } from "effect";
import { TripRoomRepository } from "../ports/trip-room-repository.ts";
import type { PlanId, Revision, TripId } from "../domain/ids.ts";
import type { PlanMemberOpinion, TripRoom } from "../domain/room.ts";
import type { ConflictError, NotFoundError } from "../domain/errors.ts";

export interface SubmitPlanOpinionInput {
  readonly roomId: TripId;
  readonly planId: PlanId;
  readonly opinion: PlanMemberOpinion;
  readonly expectedRevision: Revision;
}

export const submitPlanOpinionUseCase = (
  input: SubmitPlanOpinionInput
): Effect.Effect<TripRoom, NotFoundError | ConflictError, TripRoomRepository> =>
  Effect.gen(function* () {
    const repo = yield* TripRoomRepository;
    return yield* repo.setPlanOpinion(
      input.roomId,
      input.planId,
      input.opinion,
      input.expectedRevision
    );
  });
