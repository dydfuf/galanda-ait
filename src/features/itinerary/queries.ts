import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { getTripItinerary } from "../../app/api-client.ts";
import { TripIdSchema } from "../../core/domain/ids.ts";
import type { ItineraryStateResponse } from "../../contracts/itinerary.ts";
import { useSessionQuery } from "../../hooks/useSession.ts";

export const itineraryKeys = {
  all: ["itineraries"] as const,
  detail: (tripId: string) => ["itineraries", tripId] as const,
};

export const useItineraryQuery = (
  tripId: string
): UseQueryResult<ItineraryStateResponse, Error> => {
  const { isSuccess: isSessionReady } = useSessionQuery();
  return useQuery({
    queryKey: itineraryKeys.detail(tripId),
    queryFn: ({ signal }) => getTripItinerary(TripIdSchema.make(tripId), signal),
    staleTime: 10_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    enabled: Boolean(tripId) && isSessionReady,
  });
};
