import { describe, expect, it, vi } from "vitest";
import { RecommendationIdSchema, RevisionSchema } from "../../core/domain/ids.ts";

const recordRecommendationLifecycleEvent = vi.hoisted(() =>
  vi.fn<(...args: unknown[]) => Promise<{ readonly accepted: true }>>(),
);

vi.mock("../../app/api-client.ts", () => ({
  recordRecommendationLifecycleEvent,
}));

import { trackRecommendationEvent } from "./recommendation.ts";

describe("trackRecommendationEvent", () => {
  it.each(["nba_alternative_selected", "nba_action_completed"] as const)(
    "%s는 선택한 alternative의 canonical reasonCode를 기록한다",
    (eventName) => {
      recordRecommendationLifecycleEvent.mockResolvedValue({ accepted: true });
      const recommendation = {
        recommendationId: RecommendationIdSchema.make("recommendation-1"),
        primary: {
          actionId: "GIVE_OPINION" as const,
          reasonCode: "SHARE_PLAN_OPINION" as const,
        },
        alternatives: [{ actionId: "COMPARE_PLANS" as const }],
        source: "AI" as const,
        policyVersion: "nba-ai-v1",
        tripRevision: RevisionSchema.make(3),
        contextFingerprint: "fingerprint",
      };

      trackRecommendationEvent(
        "trip-1",
        recommendation,
        "PLAN_HOME",
        eventName,
        "COMPARE_PLANS",
      );

      expect(recordRecommendationLifecycleEvent).toHaveBeenLastCalledWith(
        "trip-1",
        expect.objectContaining({
          eventName,
          actionId: "COMPARE_PLANS",
          reasonCode: "COMPARE_PLAN_OPTIONS",
        }),
      );
    },
  );
});
