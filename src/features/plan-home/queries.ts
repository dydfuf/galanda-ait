import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { TripRoom } from "../../core/domain/room.ts";
import { getTrips } from "../../app/api-client.ts";
import {
  toTripRoomViewModel,
  type TripRoomViewModel,
} from "./plan-home-view-model.ts";

import { useSessionQuery } from "../../hooks/useSession.ts";

export const tripRoomKeys = {
  all: ["trip-rooms"] as const,
  list: (): readonly ["trip-rooms", "list"] => [...tripRoomKeys.all, "list"] as const,
  detail: (id: string, viewerId?: string): readonly ["trip-rooms", "detail", string, string] =>
    [...tripRoomKeys.all, "detail", id, viewerId ?? "anonymous"] as const,
};

export const useTripRoomsQuery = (): UseQueryResult<
  ReadonlyArray<TripRoomViewModel>,
  Error
> => {
  const { data: session, isSuccess: isSessionReady } = useSessionQuery();

  return useQuery<ReadonlyArray<TripRoom>, Error, ReadonlyArray<TripRoomViewModel>>({
    queryKey: [...tripRoomKeys.list(), session?.participantId ?? "anonymous"],
    queryFn: ({ signal }): Promise<ReadonlyArray<TripRoom>> =>
      getTrips(signal),
    select: (rooms: ReadonlyArray<TripRoom>): ReadonlyArray<TripRoomViewModel> =>
      rooms.map((r) => toTripRoomViewModel(r, session?.participantIds)),
    enabled: isSessionReady,
  });
};
