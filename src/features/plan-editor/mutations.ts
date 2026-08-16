import { useMutation, useQueryClient } from "@tanstack/react-query";
import { appRuntime } from "../../app/runtime.ts";
import { createPlanUseCase, updatePlanUseCase, deletePlanUseCase } from "../../core/usecases/save-plan.ts";
import { TripIdSchema, PlanIdSchema, RevisionSchema } from "../../core/domain/ids.ts";
import type { TripPlan } from "../../core/domain/room.ts";
import { tripRoomKeys } from "../plan-home/queries.ts";

export interface CreatePlanVariables {
  readonly roomId: string;
  readonly plan: TripPlan;
  readonly expectedRevision: number;
}

export const useCreatePlanMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ roomId, plan, expectedRevision }: CreatePlanVariables) =>
      appRuntime.runPromise(
        createPlanUseCase({
          roomId: TripIdSchema.make(roomId),
          plan,
          expectedRevision: RevisionSchema.make(expectedRevision),
        })
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tripRoomKeys.all });
    },
  });
};

export interface UpdatePlanVariables {
  readonly roomId: string;
  readonly plan: TripPlan;
  readonly expectedRevision: number;
}

export const useUpdatePlanMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ roomId, plan, expectedRevision }: UpdatePlanVariables) =>
      appRuntime.runPromise(
        updatePlanUseCase({
          roomId: TripIdSchema.make(roomId),
          plan,
          expectedRevision: RevisionSchema.make(expectedRevision),
        })
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tripRoomKeys.all });
    },
  });
};

export interface DeletePlanVariables {
  readonly roomId: string;
  readonly planId: string;
  readonly expectedRevision: number;
}

export const useDeletePlanMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ roomId, planId, expectedRevision }: DeletePlanVariables) =>
      appRuntime.runPromise(
        deletePlanUseCase({
          roomId: TripIdSchema.make(roomId),
          planId: PlanIdSchema.make(planId),
          expectedRevision: RevisionSchema.make(expectedRevision),
        })
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tripRoomKeys.all });
    },
  });
};
