import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { submitTripPlanOpinion } from "../../app/api-client.ts";
import {
  TripIdSchema,
  PlanIdSchema,
  RevisionSchema,
} from "../../core/domain/ids.ts";
import type { ReactionType } from "./components/OpinionBottomSheet.tsx";
import type { TripRoom } from "../../core/domain/room.ts";
import { tripRoomKeys } from "../plan-home/queries.ts";

export interface SubmitOpinionVariables {
  readonly roomId: string;
  readonly planId: string;
  readonly reaction: ReactionType;
  readonly reason?: string;
  readonly expectedRevision: number;
}

export const useSubmitOpinionMutation = (): UseMutationResult<
  TripRoom,
  Error,
  SubmitOpinionVariables,
  unknown
> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      roomId,
      planId,
      reaction,
      reason,
      expectedRevision,
    }: SubmitOpinionVariables): Promise<TripRoom> =>
      submitTripPlanOpinion(
        TripIdSchema.make(roomId),
        PlanIdSchema.make(planId),
        {
          reaction,
          reason: reason?.trim() ? reason.trim() : undefined,
        },
        RevisionSchema.make(expectedRevision)
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tripRoomKeys.all }),
  });
};
