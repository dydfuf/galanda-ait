// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RecommendationIdSchema, RevisionSchema } from "../../core/domain/ids.ts";

vi.mock("./recommendation.ts", () => ({
  trackRecommendationEvent: vi.fn<() => void>(),
}));

import { trackRecommendationEvent } from "./recommendation.ts";
import { NextActionRecommendation } from "./NextActionRecommendation.tsx";

describe("NextActionRecommendation", () => {
  it("impression·accept·alternative·skip을 recommendationId와 연결한다", () => {
    const onAction = vi.fn<() => void>();
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

    render(
      <NextActionRecommendation
        tripId="trip-1"
        surface="PLAN_HOME"
        recommendation={recommendation}
        onAction={onAction}
      />,
    );

    expect(trackRecommendationEvent).toHaveBeenCalledWith(
      "trip-1",
      recommendation,
      "PLAN_HOME",
      "nba_impression",
    );

    fireEvent.click(screen.getByRole("button", { name: "여행안에 의견 남기기" }));
    fireEvent.click(screen.getByRole("button", { name: "대신 여행안 비교하기" }));

    expect(trackRecommendationEvent).toHaveBeenCalledWith(
      "trip-1",
      recommendation,
      "PLAN_HOME",
      "nba_accept",
      "GIVE_OPINION",
    );
    expect(trackRecommendationEvent).toHaveBeenCalledWith(
      "trip-1",
      recommendation,
      "PLAN_HOME",
      "nba_alternative_selected",
      "COMPARE_PLANS",
    );
    expect(onAction).toHaveBeenNthCalledWith(1, {
      recommendation,
      surface: "PLAN_HOME",
      actionId: "GIVE_OPINION",
    });
    expect(onAction).toHaveBeenNthCalledWith(2, {
      recommendation,
      surface: "PLAN_HOME",
      actionId: "COMPARE_PLANS",
    });

    fireEvent.click(screen.getByRole("button", { name: "지금은 건너뛰기" }));
    expect(trackRecommendationEvent).toHaveBeenCalledWith(
      "trip-1",
      recommendation,
      "PLAN_HOME",
      "nba_skip",
    );
    expect(screen.queryByRole("region", { name: "다음으로 하면 좋은 일" }))
      .not.toBeInTheDocument();
  });
});
