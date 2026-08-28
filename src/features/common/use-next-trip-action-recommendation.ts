import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type {
  RecommendNextActionRequest,
  RecommendNextActionResponse,
} from "../../contracts/recommendation.ts";
import { TripIdSchema, type Revision } from "../../core/domain/ids.ts";
import { recommendNextTripAction } from "../../app/api-client.ts";

export const useNextTripActionRecommendation = (
  tripId: string,
  input: RecommendNextActionRequest,
  tripRevision?: Revision,
  enabled = true,
): UseQueryResult<RecommendNextActionResponse | null, Error> =>
  useQuery({
    queryKey: ["trip-recommendation", tripId, tripRevision, input] as const,
    queryFn: async ({ signal }) => {
      const recommendation = await recommendNextTripAction(
        TripIdSchema.make(tripId),
        input,
        signal,
      );
      return recommendation.tripRevision === tripRevision
        ? recommendation
        : null;
    },
    enabled: Boolean(tripId && tripRevision) && enabled,
    refetchOnMount: false,
  });
