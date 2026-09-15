import { Effect, Schema } from "effect";
import {
  TripActionRankingSchema,
  type TripActionRanking,
} from "../../../src/core/domain/trip-action.ts";
import { applyTripActionRanking } from "../../../src/core/domain/trip-action-resolver.ts";
import {
  TripActionRankingError,
  type TripActionRankerService,
  type TripActionRankingInput,
} from "../../../src/core/ports/trip-action-ranker.ts";
import { readOpenRouterCompletion, requestOpenRouter } from "./openrouter.ts";

export interface CloudflareAiGatewayRankerConfig {
  readonly gateway?: Pick<AiGateway, "run">;
  readonly model: string;
  readonly policyVersion: string;
  readonly timeoutMs: number;
  readonly onTelemetry?: (telemetry: CloudflareAiGatewayRankerTelemetry) => void;
}

export interface CloudflareAiGatewayRankerTelemetry {
  readonly status: "COMPLETED" | "FAILED";
  readonly provider: "openrouter";
  readonly model: string;
  readonly policyVersion: string;
  readonly firstResponseLatencyMs: number;
  readonly totalLatencyMs: number;
  readonly configuredTimeoutMs: number;
  readonly statusCode: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly totalTokens: number;
  readonly failure?: TripActionRankingError["reason"];
}

const ACTIVE_RANKING_CACHE_TTL_SECONDS = 300;

const invalidOutput = () =>
  new TripActionRankingError({ reason: "INVALID_OUTPUT" });

const isTimeout = (error: unknown): boolean =>
  error instanceof DOMException &&
  (error.name === "AbortError" || error.name === "TimeoutError");

const decodeRanking = async (
  response: Response,
  eligibleActions: TripActionRankingInput["eligibleActions"],
  onUsage: (usage: {
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly totalTokens: number;
  }) => void,
  signal: AbortSignal,
): Promise<{
  readonly ranking: TripActionRanking;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly totalTokens: number;
}> => {
  try {
    const { content, ...usage } = await readOpenRouterCompletion(response, signal);
    onUsage(usage);

    const ranking = await Schema.decodeUnknownPromise(
      TripActionRankingSchema,
      { onExcessProperty: "error" }
    )(JSON.parse(content));
    if (!applyTripActionRanking(eligibleActions, ranking)) throw invalidOutput();

    return {
      ranking,
      ...usage,
    };
  } catch (error) {
    throw error instanceof TripActionRankingError || isTimeout(error) ? error : invalidOutput();
  }
};

export const makeCloudflareAiGatewayTripActionRanker = (
  config: CloudflareAiGatewayRankerConfig
): TripActionRankerService => {
  const model = config.model.trim();
  const policyVersion = config.policyVersion.trim();
  if (
    !config.gateway ||
    !model ||
    !policyVersion ||
    !Number.isInteger(config.timeoutMs) ||
    config.timeoutMs <= 0
  ) {
    throw new Error("Cloudflare AI Gateway ranker configuration is invalid");
  }

  const emitTelemetry = (telemetry: CloudflareAiGatewayRankerTelemetry) => {
    try {
      config.onTelemetry?.(telemetry);
    } catch {
      // Telemetry observers must never change ranking behavior.
    }
  };

  return {
    // Include the wire/prompt version and model in fingerprints and cache keys.
    policyVersion: `${policyVersion}:openrouter-v2:${model}`,
    rank: (input) => {
      const startedAt = Date.now();
      if (!input.eligibleActions[0]) return Effect.fail(invalidOutput());
      const attempt = {
        firstResponseLatencyMs: 0,
        statusCode: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
      };
      const eligibleActionIds = input.eligibleActions.map(({ actionId }) => actionId);
      const eligibleReasonCodes = [
        ...new Set(input.eligibleActions.map(({ reasonCode }) => reasonCode)),
      ];
      const request = Effect.tryPromise({
        try: async (parentSignal) => {
          const signal = AbortSignal.any([parentSignal, AbortSignal.timeout(config.timeoutMs)]);
          const response = await requestOpenRouter(config.gateway!, {
            model,
            maxTokens: 500,
            reasoning: { effort: "low" },
            instructions:
              "Rank only the supplied eligible trip actions. Never invent an action or reason code.",
            input: JSON.stringify({
              policyVersion,
              surface: input.surface,
              decisions: input.decisions,
              eligibleActions: input.eligibleActions.map(({ actionId, reasonCode }) => ({
                actionId,
                reasonCode,
              })),
            }),
            schemaName: "trip_action_ranking",
            schema: {
              type: "object",
              properties: {
                primaryActionId: { type: "string", enum: eligibleActionIds },
                alternativeActionIds: {
                  type: "array",
                  items: { type: "string", enum: eligibleActionIds },
                },
                reasonCode: { type: "string", enum: eligibleReasonCodes },
              },
              required: [
                "primaryActionId",
                "alternativeActionIds",
                "reasonCode",
              ],
              additionalProperties: false,
            },
          }, signal, config.timeoutMs);
          const firstResponseLatencyMs = Date.now() - startedAt;
          attempt.firstResponseLatencyMs = firstResponseLatencyMs;
          attempt.statusCode = response.status;
          if (!response.ok) {
            await response.body?.cancel();
            throw new TripActionRankingError({
              reason: "PROVIDER_ERROR",
              statusCode: response.status,
            });
          }

          return {
            ...(await decodeRanking(
              response,
              input.eligibleActions,
              ({ inputTokens, outputTokens, totalTokens }) => {
                attempt.inputTokens = inputTokens;
                attempt.outputTokens = outputTokens;
                attempt.totalTokens = totalTokens;
              },
              signal,
            )),
            firstResponseLatencyMs,
            statusCode: response.status,
          };
        },
        catch: (error) =>
          error instanceof TripActionRankingError
            ? error
            : new TripActionRankingError({
                reason: isTimeout(error) ? "TIMEOUT" : "PROVIDER_ERROR",
              }),
      });

      return request.pipe(
        Effect.tap(({
          firstResponseLatencyMs,
          inputTokens,
          outputTokens,
          totalTokens,
          statusCode,
        }) => {
          const totalLatencyMs = Date.now() - startedAt;
          emitTelemetry({
            status: "COMPLETED",
            provider: "openrouter",
            model,
            policyVersion,
            firstResponseLatencyMs,
            totalLatencyMs,
            configuredTimeoutMs: config.timeoutMs,
            statusCode,
            inputTokens,
            outputTokens,
            totalTokens,
          });
          return Effect.logInfo("nba_ai_ranker_completed").pipe(
            Effect.annotateLogs({
              provider: "openrouter",
              model,
              policyVersion,
              latencyMs: totalLatencyMs,
              providerFirstResponseLatencyMs: firstResponseLatencyMs,
              providerTotalLatencyMs: totalLatencyMs,
              configuredTimeoutMs: config.timeoutMs,
              statusCode,
              inputTokens,
              outputTokens,
              totalTokens,
            })
          );
        }),
        Effect.tapError((error) => {
          const totalLatencyMs = Date.now() - startedAt;
          emitTelemetry({
            status: "FAILED",
            provider: "openrouter",
            model,
            policyVersion,
            firstResponseLatencyMs: attempt.firstResponseLatencyMs,
            totalLatencyMs,
            configuredTimeoutMs: config.timeoutMs,
            statusCode: error.statusCode ?? attempt.statusCode,
            inputTokens: attempt.inputTokens,
            outputTokens: attempt.outputTokens,
            totalTokens: attempt.totalTokens,
            failure: error.reason,
          });
          return Effect.logWarning("nba_ai_ranker_failed").pipe(
            Effect.annotateLogs({
              provider: "openrouter",
              model,
              policyVersion,
              latencyMs: totalLatencyMs,
              providerFirstResponseLatencyMs: attempt.firstResponseLatencyMs,
              providerTotalLatencyMs: totalLatencyMs,
              configuredTimeoutMs: config.timeoutMs,
              failure: error.reason,
              statusCode: error.statusCode ?? attempt.statusCode,
            })
          );
        }),
        Effect.map(({ ranking }) => ranking)
      );
    },
  };
};

export const makeCachedTripActionRanker = (
  ranker: TripActionRankerService,
  cache: Pick<Cache, "match" | "put">,
  waitUntil: (promise: Promise<unknown>) => void
): TripActionRankerService => ({
  policyVersion: ranker.policyVersion,
  rank: (input) => {
    const cacheKey = new Request(
      `https://nba-cache.galanda.internal/${encodeURIComponent(ranker.policyVersion)}/${encodeURIComponent(input.contextFingerprint)}`
    );
    const cachedRanking = Effect.promise(async () => {
      try {
        const response = await cache.match(cacheKey);
        if (!response) return undefined;
        const ranking = await Schema.decodeUnknownPromise(
          TripActionRankingSchema,
          { onExcessProperty: "error" }
        )(await response.json());
        return applyTripActionRanking(input.eligibleActions, ranking)
          ? ranking
          : undefined;
      } catch {
        return undefined;
      }
    });

    return cachedRanking.pipe(
      Effect.flatMap((ranking) => {
        if (ranking) {
          return Effect.logInfo("nba_ai_ranking_cache_hit").pipe(
            Effect.annotateLogs({
              contextFingerprint: input.contextFingerprint,
              policyVersion: ranker.policyVersion,
            }),
            Effect.as(ranking)
          );
        }

        return ranker.rank(input).pipe(
          Effect.tap((freshRanking) =>
            Effect.sync(() => {
              // ponytail: completed results only; add distributed miss deduplication
              // if concurrent provider calls become measurable.
              try {
                waitUntil(
                  cache.put(
                    cacheKey,
                    Response.json(freshRanking, {
                      headers: {
                        "Cache-Control":
                          `public, max-age=${ACTIVE_RANKING_CACHE_TTL_SECONDS}`,
                      },
                    })
                  ).catch(() => undefined)
                );
              } catch {
                // Cache scheduling must never change ranking behavior.
              }
            })
          )
        );
      })
    );
  },
});
