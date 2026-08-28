import { Effect } from "effect";
import type { TripId } from "../domain/ids.ts";
import type { RecommendationLifecycleEvent } from "../domain/trip-action.ts";
import { getTripRoom } from "./get-room.ts";

export const recordRecommendationLifecycleEvent = Effect.fn(
  "recordRecommendationLifecycleEvent",
)(function* (tripId: TripId, event: RecommendationLifecycleEvent) {
  yield* getTripRoom(tripId);
  yield* Effect.logInfo(event.eventName).pipe(Effect.annotateLogs(event));
  return { accepted: true as const };
});
