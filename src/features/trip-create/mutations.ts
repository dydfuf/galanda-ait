import { useMutation, useQueryClient } from "@tanstack/react-query";
import { appRuntime } from "../../app/runtime.ts";
import { createTripRoomUseCase } from "../../core/usecases/create-room.ts";
import { tripRoomKeys } from "../plan-home/queries.ts";

export interface CreateTripRoomVariables {
  readonly title: string;
  readonly destination?: string;
  readonly startDate?: string;
  readonly endDate?: string;
}

export const useCreateTripRoomMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variables: CreateTripRoomVariables) =>
      appRuntime.runPromise(createTripRoomUseCase(variables)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tripRoomKeys.all });
    },
  });
};
