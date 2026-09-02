import { Effect, Layer } from "effect";
import { TripActivityRepository } from "../../core/ports/trip-activity-repository.ts";
import { TripIdSchema } from "../../core/domain/ids.ts";
import type { TripActivitySummary } from "../../core/domain/trip-activity.ts";

export const LocalTripActivityRepositoryLayer: Layer.Layer<TripActivityRepository> =
  Layer.succeed(TripActivityRepository, {
    listForTrip: () =>
      Effect.succeed({
        events: [],
        hasMore: false,
        nextBeforeSequence: undefined,
        latestSequence: undefined,
        lastSeenSequence: undefined,
        unreadCount: 0,
      }),

    getSummariesForTrips: ({ tripIds }) =>
      Effect.succeed(
        new Map<typeof TripIdSchema.Type, TripActivitySummary>(
          tripIds.map((id) => [
            TripIdSchema.make(id),
            {
              tripId: TripIdSchema.make(id),
              unreadCount: 0,
              latestUnreadSummary: undefined,
              lastSeenSequence: undefined,
            },
          ])
        )
      ),

    markRead: ({ tripId, throughSequence }) =>
      Effect.succeed({
        tripId,
        unreadCount: 0,
        latestUnreadSummary: undefined,
        lastSeenSequence: throughSequence,
      }),

    initializeMemberCursor: () => Effect.void,
  });
