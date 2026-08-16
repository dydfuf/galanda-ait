import { useMutation, useQueryClient } from "@tanstack/react-query";
import { appRuntime } from "../../app/runtime.ts";
import { confirmTripPlan } from "../../core/usecases/confirm-plan.ts";
import {
  TripIdSchema,
  PlanIdSchema,
  RevisionSchema,
} from "../../core/domain/ids.ts";
import { tripRoomKeys } from "./queries.ts";

export interface ConfirmPlanVariables {
  readonly roomId: string;
  readonly planId: string;
  readonly revision: number;
}

export const useConfirmPlanMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ roomId, planId, revision }: ConfirmPlanVariables) =>
      appRuntime.runPromise(
        confirmTripPlan(
          TripIdSchema.make(roomId),
          PlanIdSchema.make(planId),
          RevisionSchema.make(revision)
        )
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tripRoomKeys.all });
    },
  });
};
