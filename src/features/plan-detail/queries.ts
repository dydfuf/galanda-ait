import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { appRuntime } from "../../app/runtime.ts";
import { getTripRoom } from "../../core/usecases/get-room.ts";
import { TripIdSchema } from "../../core/domain/ids.ts";
import type { TripRoom } from "../../core/domain/room.ts";
import {
  toPlanDetailViewModel,
  type PlanDetailViewModel,
} from "./plan-detail-view-model.ts";
import { tripRoomKeys } from "../plan-home/queries.ts";

import { useSessionQuery } from "../../hooks/useSession.ts";

export const useTripRoomDetailQuery = (
  roomId: string
): UseQueryResult<PlanDetailViewModel, Error> => {
  const { data: session } = useSessionQuery();

  return useQuery<TripRoom, Error, PlanDetailViewModel>({
    queryKey: tripRoomKeys.detail(roomId),
    queryFn: ({ signal }): Promise<TripRoom> =>
      appRuntime.runPromise(getTripRoom(TripIdSchema.make(roomId)), {
        signal,
      }),
    select: (room: TripRoom): PlanDetailViewModel =>
      toPlanDetailViewModel(room, session?.userId),
    enabled: Boolean(roomId),
  });
};

export const useTripRoomRawQuery = (
  roomId: string
): UseQueryResult<TripRoom, Error> =>
  useQuery<TripRoom, Error>({
    queryKey: tripRoomKeys.detail(roomId),
    queryFn: ({ signal }): Promise<TripRoom> =>
      appRuntime.runPromise(getTripRoom(TripIdSchema.make(roomId)), {
        signal,
      }),
    enabled: Boolean(roomId),
  });

