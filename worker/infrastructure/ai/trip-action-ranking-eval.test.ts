import { describe, expect, it } from "vitest";
import {
  runTripActionRankingEval,
  tripActionRankingGoldenCases,
  type TripActionRankingEvalCandidate,
} from "./trip-action-ranking-eval.ts";

const candidate = (
  id: string,
  reverse = false
): TripActionRankingEvalCandidate => ({
  id,
  rank: async (input) => {
    const actions = reverse
      ? [...input.eligibleActions].reverse()
      : [...input.eligibleActions];
    const primary = actions[0];
    if (!primary) throw new Error("Expected an eligible action");
    return {
      ranking: {
        primaryActionId: primary.actionId,
        alternativeActionIds: actions.slice(1).map(({ actionId }) => actionId),
        reasonCode: primary.reasonCode,
      },
      firstResponseLatencyMs: reverse ? 15 : 10,
      totalLatencyMs: reverse ? 25 : 20,
      inputTokens: 10,
      outputTokens: 5,
      estimatedCostUsd: 0.001,
    };
  },
});

describe("Trip action ranking golden eval", () => {
  it("동일 golden dataset으로 두 후보의 품질·latency·cost를 비교한다", async () => {
    const report = await runTripActionRankingEval([
      candidate("rule-order"),
      candidate("reverse-order", true),
    ]);

    expect(report.candidates).toHaveLength(2);
    expect(report.candidates[0]).toMatchObject({
      candidateId: "rule-order",
      metrics: {
        totalCases: 14,
        invokedCases: 8,
        skippedCases: 6,
        completedCases: 8,
        eligibilityViolationRate: 0,
        forbiddenActionRate: 0,
        goldenTop1Agreement: 1,
        goldenTopKCoverage: 1,
        ruleDisagreementRate: 0,
        p50FirstResponseLatencyMs: 10,
        p95TotalLatencyMs: 20,
        inputTokens: 80,
        outputTokens: 40,
        estimatedCostPerRecommendationUsd: 0.001,
      },
    });
    expect(report.candidates[1]?.metrics.ruleDisagreementRate).toBe(1);
    expect(report.candidates[1]?.metrics.goldenTop1Agreement).toBeLessThan(1);
  });

  it("필수 scenario와 단일 eligible/conflict skip을 고정한다", async () => {
    expect(tripActionRankingGoldenCases.map(({ rationaleTag }) => rationaleTag)).toEqual(
      expect.arrayContaining([
        "FIRST_PLAN_BASIC_INCOMPLETE",
        "ROUTE_MISSING",
        "DETAILS_MISSING",
        "ACCOMMODATION_SEARCHING",
        "TRANSPORT_NOT_CHECKED",
        "PLAN_COUNT_0",
        "PLAN_COUNT_1",
        "OPINIONS_INSUFFICIENT_HOST",
        "OPINIONS_SUFFICIENT_HOST",
        "MEMBER_ROLE",
        "CONFIRMED",
        "DRAFT_CONFLICT",
        "REVISION_CONFLICT",
        "SINGLE_ELIGIBLE_ACTION",
      ])
    );

    await expect(runTripActionRankingEval([candidate("only")])).rejects.toThrow(
      "At least two ranking candidates are required"
    );
  });
});
