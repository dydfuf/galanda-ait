import { useMutation, useQueryClient } from "@tanstack/react-query";
import { appRuntime } from "../../app/runtime.ts";
import { createTripRoomUseCase } from "../../core/usecases/create-room.ts";
import type { TripMember } from "../../core/domain/room.ts";
import { tripRoomKeys } from "../plan-home/queries.ts";

export interface CreateTripRoomVariables {
  readonly title: string;
  readonly hostUser?: TripMember;
}

export const useCreateTripRoomMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ title, hostUser }: CreateTripRoomVariables) =>
      appRuntime.runPromise(createTripRoomUseCase({ title, hostUser })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tripRoomKeys.all });
    },
  });
};
