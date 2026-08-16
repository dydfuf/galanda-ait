import { useMutation, useQueryClient } from "@tanstack/react-query";
import { appRuntime } from "../../app/runtime.ts";
import { submitPlanOpinionUseCase } from "../../core/usecases/submit-opinion.ts";
import {
  TripIdSchema,
  PlanIdSchema,
  RevisionSchema,
  UserIdSchema,
} from "../../core/domain/ids.ts";
import type { ReactionType } from "./components/OpinionBottomSheet.tsx";
import { tripRoomKeys } from "../plan-home/queries.ts";

export interface SubmitOpinionVariables {
  readonly roomId: string;
  readonly planId: string;
  readonly reaction: ReactionType;
  readonly reason?: string;
  readonly expectedRevision: number;
  readonly userId?: string;
  readonly userName?: string;
}

export const useSubmitOpinionMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      roomId,
      planId,
      reaction,
      reason,
      expectedRevision,
      userId = "user-local-me",
      userName = "나",
    }: SubmitOpinionVariables) =>
      appRuntime.runPromise(
        submitPlanOpinionUseCase({
          roomId: TripIdSchema.make(roomId),
          planId: PlanIdSchema.make(planId),
          opinion: {
            userId: UserIdSchema.make(userId),
            userName,
            reaction,
            reason: reason?.trim() ? reason.trim() : undefined,
          },
          expectedRevision: RevisionSchema.make(expectedRevision),
        })
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tripRoomKeys.all });
    },
  });
};
