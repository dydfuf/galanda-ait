import { Effect } from "effect";
import { ValidationError } from "../domain/errors.ts";
import type { TripId } from "../domain/ids.ts";
import type { RecommendationLifecycleEvent } from "../domain/trip-action.ts";
import { reasonCodeForAction } from "../domain/trip-action-resolver.ts";
import { getTripRoom } from "./get-room.ts";

export const recordRecommendationLifecycleEvent = Effect.fn(
  "recordRecommendationLifecycleEvent",
)(function* (tripId: TripId, event: RecommendationLifecycleEvent) {
  yield* getTripRoom(tripId);
  if (event.reasonCode !== reasonCodeForAction(event.actionId)) {
    return yield* Effect.fail(
      new ValidationError({ message: "추천 action과 reason이 일치하지 않습니다." }),
    );
  }
  yield* Effect.logInfo(event.eventName).pipe(Effect.annotateLogs(event));
  return { accepted: true as const };
});
