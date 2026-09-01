import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { getTripActivities, markTripActivityRead } from "../../app/api-client.ts";
import type { ActivitySequence, TripActivityPageResponse } from "../../contracts/trip-activity.ts";
import { tripOverviewKeys } from "../plan-home/queries.ts";

export const tripActivityKeys = {
  all: ["trip-activity"] as const,
  list: (tripId: string) => [...tripActivityKeys.all, "list", tripId] as const,
};

export const useTripActivitiesInfiniteQuery = (
  tripId: string,
  options: { readonly enabled?: boolean } = {}
) => {
  const enabled = (options.enabled ?? true) && Boolean(tripId);

  return useInfiniteQuery<
    TripActivityPageResponse,
    Error,
    InfiniteData<TripActivityPageResponse>,
    readonly ["trip-activity", "list", string],
    ActivitySequence | undefined
  >({
    queryKey: tripActivityKeys.list(tripId),
    queryFn: async ({ pageParam, signal }) => {
      return getTripActivities(tripId, { beforeSequence: pageParam, limit: 20 }, signal);
    },
    initialPageParam: undefined,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? (lastPage.nextBeforeSequence ?? undefined) : undefined,
    enabled,
  });
};

export const useMarkTripActivityReadMutation = (tripId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (throughSequence: ActivitySequence) =>
      markTripActivityRead(tripId, throughSequence),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: tripOverviewKeys.all });
    },
  });
};
