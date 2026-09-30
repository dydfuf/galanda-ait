import { describe, expect, it, vi } from "vitest";
import worker from "./trip-action-ranking-eval-worker.ts";

describe("Trip action ranking eval worker", () => {
  it("keeps sanitized completion diagnostics and usage in failed eval cases", async () => {
    const run = vi.fn<AiGateway["run"]>(async () => Response.json({
      choices: [{ finish_reason: "length", message: { content: "" } }],
      usage: { prompt_tokens: 100, completion_tokens: 500, total_tokens: 600 },
      provider_private_data: "must-not-appear-in-report",
    }));
    const response = await worker.fetch(new Request("https://eval.invalid"), {
      AI: { gateway: () => ({ run }) as unknown as AiGateway },
      AI_GATEWAY_ID: "test-gateway",
      AI_RECOMMENDATION_POLICY_VERSION: "test-policy",
      AI_RECOMMENDATION_TIMEOUT_MS: 1000,
      AI_EVAL_MODELS: ["candidate-a", "candidate-b"],
      AI_EVAL_PRICING: {
        "candidate-a": { inputUsdPerMillionTokens: 1, outputUsdPerMillionTokens: 2 },
        "candidate-b": { inputUsdPerMillionTokens: 1, outputUsdPerMillionTokens: 2 },
      },
    });
    const report = await response.json() as {
      candidates: Array<{ metrics: Record<string, unknown>; cases: Array<Record<string, unknown>> }>;
    };
    expect(run).toHaveBeenCalledTimes(16);
    for (const candidate of report.candidates) {
      expect(candidate.metrics).toMatchObject({
        completedCases: 0,
        invokedCases: 8,
        schemaFailureRate: 1,
        invalidOutputReasons: { FINISH_REASON: 8 },
        inputTokens: 800,
        outputTokens: 4000,
        totalTokens: 4800,
        estimatedCostPerRecommendationUsd: 0.0011,
      });
      expect(candidate.cases.filter(({ status }) => status === "FAILED")).toEqual(
        expect.arrayContaining([expect.objectContaining({
          failure: "INVALID_OUTPUT",
          diagnostics: {
            requestVersion: "openrouter-v3",
            invalidOutputReason: "FINISH_REASON",
            finishReason: "length",
            contentLength: 0,
            refusal: false,
            choiceCount: 1,
          },
        })]),
      );
    }
    expect(JSON.stringify(report)).not.toContain("must-not-appear-in-report");
  });
});
