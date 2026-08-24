import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  acknowledgeTripItinerary,
  reviseTripItinerary,
} from "../../app/api-client.ts";
import {
  RevisionSchema,
  TripIdSchema,
} from "../../core/domain/ids.ts";
import type { ItineraryItemPatch } from "../../core/domain/confirmed-itinerary.ts";
import { itineraryKeys } from "./queries.ts";

export const useReviseItineraryMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      tripId,
      patches,
      expectedRevision,
    }: {
      readonly tripId: string;
      readonly patches: ReadonlyArray<ItineraryItemPatch>;
      readonly expectedRevision: number;
    }) =>
      reviseTripItinerary(
        TripIdSchema.make(tripId),
        patches,
        RevisionSchema.make(expectedRevision)
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: itineraryKeys.all }),
  });
};

export const useAcknowledgeItineraryMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tripId, expectedRevision }: { readonly tripId: string; readonly expectedRevision: number }) =>
      acknowledgeTripItinerary(
        TripIdSchema.make(tripId),
        RevisionSchema.make(expectedRevision)
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: itineraryKeys.all }),
  });
};
