import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { getTripItinerary } from "../../app/api-client.ts";
import { TripIdSchema } from "../../core/domain/ids.ts";
import type { ItineraryStateResponse } from "../../contracts/itinerary.ts";
import { useSessionQuery } from "../../hooks/useSession.ts";
import { COLLABORATION_READ_FRESHNESS, EDITOR_BASELINE_FRESHNESS } from "../../app/query-freshness.ts";

export const itineraryKeys = {
  all: ["itineraries"] as const,
  detail: (tripId: string, viewerId?: string) => ["itineraries", tripId, viewerId ?? "anonymous"] as const,
};

export const useItineraryQuery = (
  tripId: string,
  options: { readonly editing?: boolean } = {},
): UseQueryResult<ItineraryStateResponse, Error> => {
  const { data: session, isSuccess: isSessionReady } = useSessionQuery();
  return useQuery({
    queryKey: itineraryKeys.detail(tripId, session?.participantId),
    queryFn: ({ signal }) => getTripItinerary(TripIdSchema.make(tripId), signal),
    ...(options.editing ? EDITOR_BASELINE_FRESHNESS : COLLABORATION_READ_FRESHNESS),
    enabled: Boolean(tripId) && isSessionReady,
  });
};
