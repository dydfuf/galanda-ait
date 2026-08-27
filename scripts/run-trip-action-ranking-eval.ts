import { Effect, Logger } from "effect";
import {
  makeCloudflareAiGatewayTripActionRanker,
  type CloudflareAiGatewayRankerTelemetry,
} from "../worker/infrastructure/ai/cloudflare-ai-gateway-trip-action-ranker.ts";
import {
  runTripActionRankingEval,
  type TripActionRankingEvalOutcome,
} from "../worker/infrastructure/ai/trip-action-ranking-eval.ts";

interface ModelPrice {
  readonly inputUsdPerMillionTokens: number;
  readonly outputUsdPerMillionTokens: number;
}

const required = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const positiveInteger = (name: string): number => {
  const value = Number(required(name));
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
};

const pricesFor = (
  models: ReadonlyArray<string>
): Readonly<Record<string, ModelPrice>> => {
  const parsed: unknown = JSON.parse(required("AI_EVAL_PRICING_JSON"));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("AI_EVAL_PRICING_JSON must be an object");
  }

  const prices: Record<string, ModelPrice> = {};
  for (const model of models) {
    const price = (parsed as Record<string, unknown>)[model];
    if (!price || typeof price !== "object" || Array.isArray(price)) {
      throw new Error(`Missing pricing for ${model}`);
    }
    const inputUsdPerMillionTokens = Number(
      (price as Record<string, unknown>).inputUsdPerMillionTokens
    );
    const outputUsdPerMillionTokens = Number(
      (price as Record<string, unknown>).outputUsdPerMillionTokens
    );
    if (
      !Number.isFinite(inputUsdPerMillionTokens) ||
      inputUsdPerMillionTokens < 0 ||
      !Number.isFinite(outputUsdPerMillionTokens) ||
      outputUsdPerMillionTokens < 0
    ) {
      throw new Error(`Invalid pricing for ${model}`);
    }
    prices[model] = {
      inputUsdPerMillionTokens,
      outputUsdPerMillionTokens,
    };
  }
  return prices;
};

const main = async () => {
  const models = [...new Set(
    required("AI_EVAL_MODELS").split(",").map((model) => model.trim()).filter(Boolean)
  )];
  if (models.length < 2) {
    throw new Error("AI_EVAL_MODELS must contain at least two unique models");
  }
  const prices = pricesFor(models);
  const accountId = required("AI_GATEWAY_ACCOUNT_ID");
  const gatewayId = required("AI_GATEWAY_ID");
  const gatewayToken = required("AI_GATEWAY_TOKEN");
  const policyVersion = required("AI_RECOMMENDATION_POLICY_VERSION");
  const timeoutMs = positiveInteger("AI_RECOMMENDATION_TIMEOUT_MS");

  const candidates = models.map((model) => {
    let telemetry: CloudflareAiGatewayRankerTelemetry | undefined;
    const ranker = makeCloudflareAiGatewayTripActionRanker({
      accountId,
      gatewayId,
      gatewayToken,
      model,
      policyVersion,
      timeoutMs,
      openAiApiKey: process.env.OPENAI_API_KEY,
      onTelemetry: (event) => {
        telemetry = event;
      },
    });
    return {
      id: model,
      rank: async (input) => {
        let failure: TripActionRankingEvalOutcome["failure"];
        const ranking = await Effect.runPromise(
          ranker.rank(input).pipe(
            Effect.catch((error) => {
              failure = error.reason;
              return Effect.succeed(undefined);
            }),
            Effect.provide(Logger.layer([]))
          )
        );
        if (!telemetry) throw new Error(`Missing telemetry for ${model}`);
        const price = prices[model]!;
        return {
          ranking,
          failure,
          firstResponseLatencyMs: telemetry.firstResponseLatencyMs,
          totalLatencyMs: telemetry.totalLatencyMs,
          inputTokens: telemetry.inputTokens,
          outputTokens: telemetry.outputTokens,
          estimatedCostUsd:
            (telemetry.inputTokens * price.inputUsdPerMillionTokens +
              telemetry.outputTokens * price.outputUsdPerMillionTokens) /
            1_000_000,
        };
      },
    };
  });

  const report = await runTripActionRankingEval(candidates);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
};

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
