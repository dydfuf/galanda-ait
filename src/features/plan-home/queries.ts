import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { getTrips } from "../../app/api-client.ts";
import type { TripOverviewDto } from "../../contracts/trip-overview.ts";
import { useSessionQuery } from "../../hooks/useSession.ts";

export const tripOverviewKeys = {
  all: ["trip-overviews"] as const,
  list: (): readonly ["trip-overviews", "list"] =>
    [...tripOverviewKeys.all, "list"] as const,
};

export const tripRoomKeys = {
  all: ["trip-rooms"] as const,
  list: (): readonly ["trip-overviews", "list"] => tripOverviewKeys.list(),
  detail: (id: string, viewerId?: string): readonly ["trip-rooms", "detail", string, string] =>
    [...tripRoomKeys.all, "detail", id, viewerId ?? "anonymous"] as const,
};

/**
 * 참여 중인 여행 목록 (Trip Overview) query.
 */
export const useTripRoomsQuery = (
  options: { readonly enabled?: boolean } = {}
): UseQueryResult<ReadonlyArray<TripOverviewDto>, Error> => {
  const { data: session, isSuccess: isSessionReady } = useSessionQuery();
  const enabled = options.enabled ?? true;

  return useQuery<ReadonlyArray<TripOverviewDto>, Error>({
    queryKey: [...tripOverviewKeys.list(), session?.participantId ?? "anonymous"],
    queryFn: async ({ signal }): Promise<ReadonlyArray<TripOverviewDto>> => {
      const response = await getTrips(signal);
      return response.items;
    },
    enabled: enabled && isSessionReady,
  });
};

export const useTripOverviewsQuery = useTripRoomsQuery;
