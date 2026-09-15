import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createTripResource, deleteTripResource, editTripResourcePlace, getTripResources, organizeTripResource } from "../../app/api-client.ts";
import { COLLABORATION_READ_FRESHNESS } from "../../app/query-freshness.ts";
import type { CreateResourceRequest, EditResourcePlaceRequest, TripResourcesResponse } from "../../contracts/trip-resource.ts";
import { RevisionSchema, TripIdSchema } from "../../core/domain/ids.ts";
import { useSessionQuery } from "../../hooks/useSession.ts";

export const resourceKeys = {
  trip: (tripId: string) => ["trip-resources", tripId] as const,
  list: (tripId: string, participantId?: string) => ["trip-resources", tripId, participantId ?? "anonymous"] as const,
};

export function useTripResourcesQuery(tripId: string) {
  const { data: session, isSuccess } = useSessionQuery();
  return useQuery({
    queryKey: resourceKeys.list(tripId, session?.participantId),
    queryFn: ({ signal }) => getTripResources(TripIdSchema.make(tripId), signal),
    ...COLLABORATION_READ_FRESHNESS,
    enabled: Boolean(tripId) && isSuccess && Boolean(session),
  });
}

type ResourceMutation =
  | { type: "create"; input: CreateResourceRequest }
  | { type: "organize" | "delete"; resourceId: string; expectedRevision: number }
  | { type: "edit"; resourceId: string; input: EditResourcePlaceRequest };

export function useTripResourceMutation(tripId: string) {
  const client = useQueryClient();
  const { data: session } = useSessionQuery();
  const queryKey = resourceKeys.list(tripId, session?.participantId);
  return useMutation({
    mutationFn: async (action: ResourceMutation) => {
      const id = TripIdSchema.make(tripId);
      switch (action.type) {
        case "create": return createTripResource(id, action.input);
        case "edit": return editTripResourcePlace(id, action.resourceId, action.input);
        case "organize": return organizeTripResource(id, action.resourceId, RevisionSchema.make(action.expectedRevision));
        case "delete": return deleteTripResource(id, action.resourceId, RevisionSchema.make(action.expectedRevision));
      }
    },
    onSuccess: async (result, action) => {
      await client.cancelQueries({ queryKey });
      client.setQueryData<TripResourcesResponse>(queryKey, (previous) => {
        if (!previous) return previous;
        const items = "places" in result
          ? action.type === "create"
            ? [result, ...previous.items.filter((item) => item.id !== result.id)]
            : previous.items.map((item) => item.id === result.id ? result : item)
          : previous.items.filter((item) => action.type !== "delete" || item.id !== action.resourceId);
        return { ...previous, items };
      });
      await client.invalidateQueries({ queryKey: resourceKeys.trip(tripId) });
    },
  });
}
