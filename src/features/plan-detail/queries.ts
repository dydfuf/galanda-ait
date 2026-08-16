import { useQuery } from "@tanstack/react-query";
import { appRuntime } from "../../app/runtime.ts";
import { getTripRoom } from "../../core/usecases/get-room.ts";
import { TripIdSchema } from "../../core/domain/ids.ts";
import {
  toPlanDetailViewModel,
  type PlanDetailViewModel,
} from "./plan-detail-view-model.ts";
import { tripRoomKeys } from "../plan-home/queries.ts";

export const useTripRoomDetailQuery = (roomId: string) =>
  useQuery({
    queryKey: tripRoomKeys.detail(roomId),
    queryFn: ({ signal }) =>
      appRuntime.runPromise(getTripRoom(TripIdSchema.make(roomId)), {
        signal,
      }),
    select: (room): PlanDetailViewModel => toPlanDetailViewModel(room),
    enabled: Boolean(roomId),
  });

export const useTripRoomRawQuery = (roomId: string) =>
  useQuery({
    queryKey: tripRoomKeys.detail(roomId),
    queryFn: ({ signal }) =>
      appRuntime.runPromise(getTripRoom(TripIdSchema.make(roomId)), {
        signal,
      }),
    enabled: Boolean(roomId),
  });
