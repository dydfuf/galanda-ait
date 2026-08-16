import { useQuery } from "@tanstack/react-query";
import { appRuntime } from "../../app/runtime.ts";
import { getTripRooms } from "../../core/usecases/get-room.ts";
import {
  toTripRoomViewModel,
  type TripRoomViewModel,
} from "./plan-home-view-model.ts";

export const tripRoomKeys = {
  all: ["trip-rooms"] as const,
  list: () => [...tripRoomKeys.all, "list"] as const,
  detail: (id: string) => [...tripRoomKeys.all, "detail", id] as const,
};

export const useTripRoomsQuery = () =>
  useQuery({
    queryKey: tripRoomKeys.list(),
    queryFn: ({ signal }) =>
      appRuntime.runPromise(getTripRooms(), { signal }),
    select: (rooms): ReadonlyArray<TripRoomViewModel> =>
      rooms.map(toTripRoomViewModel),
  });
