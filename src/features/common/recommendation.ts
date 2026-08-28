import type { RecommendNextActionResponse } from "../../contracts/recommendation.ts";
import type {
  RecommendationLifecycleEventName,
  RecommendationSurface,
  TripActionId,
} from "../../core/domain/trip-action.ts";
import { TripIdSchema } from "../../core/domain/ids.ts";
import { recordRecommendationLifecycleEvent } from "../../app/api-client.ts";

export interface RecommendationActionContext {
  readonly recommendation: RecommendNextActionResponse;
  readonly surface: RecommendationSurface;
  readonly actionId: TripActionId;
}

export const getRecommendationActionContext = (
  state: unknown,
): RecommendationActionContext | undefined => {
  if (!state || typeof state !== "object" || !("nbaRecommendation" in state)) {
    return undefined;
  }
  return (state as { readonly nbaRecommendation?: RecommendationActionContext })
    .nbaRecommendation;
};

export const trackRecommendationEvent = (
  tripId: string,
  recommendation: RecommendNextActionResponse,
  surface: RecommendationSurface,
  eventName: RecommendationLifecycleEventName,
  actionId: TripActionId = recommendation.primary.actionId,
): void => {
  void recordRecommendationLifecycleEvent(TripIdSchema.make(tripId), {
    eventName,
    recommendationId: recommendation.recommendationId,
    source: recommendation.source,
    actionId,
    reasonCode: recommendation.primary.reasonCode,
    surface,
    policyVersion: recommendation.policyVersion,
    contextFingerprint: recommendation.contextFingerprint,
  }).catch(() => undefined);
};
