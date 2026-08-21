import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { appRuntime } from "../../app/runtime.ts";
import { submitOpinion } from "../../core/usecases/submit-opinion.ts";
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
      appRuntime.runPromise(
        submitOpinion({
          roomId: TripIdSchema.make(roomId),
          planId: PlanIdSchema.make(planId),
          opinion: {
            reaction,
            reason: reason?.trim() ? reason.trim() : undefined,
          },
          expectedRevision: RevisionSchema.make(expectedRevision),
        })
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tripRoomKeys.all }),
  });
};
