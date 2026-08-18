import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { appRuntime } from "../../app/runtime.ts";
import { confirmTripPlan } from "../../core/usecases/confirm-plan.ts";
import {
  TripIdSchema,
  PlanIdSchema,
  RevisionSchema,
} from "../../core/domain/ids.ts";
import type { TripRoom } from "../../core/domain/room.ts";
import { tripRoomKeys } from "./queries.ts";

export interface ConfirmPlanVariables {
  readonly roomId: string;
  readonly planId: string;
  readonly revision: number;
}

export const useConfirmPlanMutation = (): UseMutationResult<
  TripRoom,
  Error,
  ConfirmPlanVariables,
  unknown
> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ roomId, planId, revision }: ConfirmPlanVariables): Promise<TripRoom> =>
      appRuntime.runPromise(
        confirmTripPlan(
          TripIdSchema.make(roomId),
          PlanIdSchema.make(planId),
          RevisionSchema.make(revision)
        )
      ),
    onSuccess: (): void => {
      queryClient.invalidateQueries({ queryKey: tripRoomKeys.all });
    },
  });
};

