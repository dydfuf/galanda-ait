import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { confirmTripPlan } from "../../app/api-client.ts";
import {
  TripIdSchema,
  PlanIdSchema,
  RevisionSchema,
} from "../../core/domain/ids.ts";
import type { ConfirmItineraryResult } from "../../contracts/itinerary.ts";
import { itineraryKeys } from "../itinerary/queries.ts";
import { tripRoomKeys } from "./queries.ts";

export interface ConfirmPlanVariables {
  readonly roomId: string;
  readonly planId: string;
  readonly revision: number;
}

export const useConfirmPlanMutation = (): UseMutationResult<
  ConfirmItineraryResult,
  Error,
  ConfirmPlanVariables,
  unknown
> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ roomId, planId, revision }: ConfirmPlanVariables): Promise<ConfirmItineraryResult> =>
      confirmTripPlan(
        TripIdSchema.make(roomId),
        PlanIdSchema.make(planId),
        RevisionSchema.make(revision)
      ),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: tripRoomKeys.all }),
        queryClient.invalidateQueries({ queryKey: itineraryKeys.all }),
      ]),
  });
};
