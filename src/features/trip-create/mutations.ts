import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import type { TripRoom } from "../../core/domain/room.ts";
import { createTrip } from "../../app/api-client.ts";
import { tripRoomKeys } from "../plan-home/queries.ts";

export interface CreateTripRoomVariables {
  readonly title: string;
  readonly destination?: string;
}

export const useCreateTripRoomMutation = (): UseMutationResult<
  TripRoom,
  Error,
  CreateTripRoomVariables,
  unknown
> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variables: CreateTripRoomVariables): Promise<TripRoom> =>
      createTrip(variables),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tripRoomKeys.all }),
  });
};
