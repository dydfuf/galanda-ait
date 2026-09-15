import { Effect, Logger } from "effect";
import {
  makeCloudflareAiGatewayTripActionRanker,
  type CloudflareAiGatewayRankerTelemetry,
} from "./cloudflare-ai-gateway-trip-action-ranker.ts";
import {
  runTripActionRankingEval,
  type TripActionRankingEvalCandidate,
  type TripActionRankingEvalOutcome,
} from "./trip-action-ranking-eval.ts";

interface TripActionRankingEvalEnv {
  readonly AI: Pick<Ai, "gateway">;
  readonly AI_GATEWAY_ID: string;
  readonly AI_RECOMMENDATION_POLICY_VERSION: string;
  readonly AI_RECOMMENDATION_TIMEOUT_MS: number;
  readonly AI_EVAL_MODELS: ReadonlyArray<string>;
  readonly AI_EVAL_PRICING: Readonly<Record<string, {
    readonly inputUsdPerMillionTokens: number;
    readonly outputUsdPerMillionTokens: number;
  }>>;
}

// Loaded only by the CLI's private remote preview, never the application Worker.
export default {
  async fetch(_request: Request, env: TripActionRankingEvalEnv): Promise<Response> {
    const gateway = env.AI.gateway(env.AI_GATEWAY_ID);
    const models = env.AI_EVAL_MODELS;
    const prices = env.AI_EVAL_PRICING;
    const policyVersion = env.AI_RECOMMENDATION_POLICY_VERSION;
    const timeoutMs = env.AI_RECOMMENDATION_TIMEOUT_MS;
    const candidates: ReadonlyArray<TripActionRankingEvalCandidate> = models.map((model) => {
      let telemetry: CloudflareAiGatewayRankerTelemetry | undefined;
      const ranker = makeCloudflareAiGatewayTripActionRanker({
        gateway,
        model,
        policyVersion,
        timeoutMs,
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
            totalTokens: telemetry.totalTokens,
            estimatedCostUsd:
              (telemetry.inputTokens * price.inputUsdPerMillionTokens +
                telemetry.outputTokens * price.outputUsdPerMillionTokens) /
              1_000_000,
          };
        },
      };
    });

    const report = await runTripActionRankingEval(candidates);
    return Response.json(report);
  },
};
