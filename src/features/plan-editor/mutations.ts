import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { appRuntime } from "../../app/runtime.ts";
import { createPlan, updatePlan, deletePlan, type CreatePlanCommand } from "../../core/usecases/save-plan.ts";
import { TripIdSchema, PlanIdSchema, RevisionSchema } from "../../core/domain/ids.ts";
import type { TripPlan, TripRoom } from "../../core/domain/room.ts";
import { tripRoomKeys } from "../plan-home/queries.ts";

export interface CreatePlanVariables extends Omit<CreatePlanCommand, "roomId" | "expectedRevision"> {
  readonly roomId: string;
  readonly expectedRevision: number;
}

export const useCreatePlanMutation = (): UseMutationResult<
  TripRoom,
  Error,
  CreatePlanVariables,
  unknown
> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ roomId, expectedRevision, ...command }: CreatePlanVariables): Promise<TripRoom> =>
      appRuntime.runPromise(
        createPlan({
          roomId: TripIdSchema.make(roomId),
          expectedRevision: RevisionSchema.make(expectedRevision),
          ...command,
        })
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tripRoomKeys.all }),
  });
};

export interface UpdatePlanVariables {
  readonly roomId: string;
  readonly plan: TripPlan;
  readonly expectedRevision: number;
}

export const useUpdatePlanMutation = (): UseMutationResult<
  TripRoom,
  Error,
  UpdatePlanVariables,
  unknown
> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ roomId, plan, expectedRevision }: UpdatePlanVariables): Promise<TripRoom> =>
      appRuntime.runPromise(
        updatePlan({
          roomId: TripIdSchema.make(roomId),
          plan,
          expectedRevision: RevisionSchema.make(expectedRevision),
        })
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tripRoomKeys.all }),
  });
};

export interface DeletePlanVariables {
  readonly roomId: string;
  readonly planId: string;
  readonly expectedRevision: number;
}

export const useDeletePlanMutation = (): UseMutationResult<
  TripRoom,
  Error,
  DeletePlanVariables,
  unknown
> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ roomId, planId, expectedRevision }: DeletePlanVariables): Promise<TripRoom> =>
      appRuntime.runPromise(
        deletePlan({
          roomId: TripIdSchema.make(roomId),
          planId: PlanIdSchema.make(planId),
          expectedRevision: RevisionSchema.make(expectedRevision),
        })
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tripRoomKeys.all }),
  });
};
