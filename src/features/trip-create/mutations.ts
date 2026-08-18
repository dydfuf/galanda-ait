import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { appRuntime } from "../../app/runtime.ts";
import { createTripRoomUseCase } from "../../core/usecases/create-room.ts";
import type { TripRoom } from "../../core/domain/room.ts";
import { tripRoomKeys } from "../plan-home/queries.ts";

export interface CreateTripRoomVariables {
  readonly title: string;
  readonly destination?: string;
  readonly startDate?: string;
  readonly endDate?: string;
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
      appRuntime.runPromise(createTripRoomUseCase(variables)),
    onSuccess: (): void => {
      queryClient.invalidateQueries({ queryKey: tripRoomKeys.all });
    },
  });
};

