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

export interface CloudflareAiGatewayRankerConfig {
  readonly accountId: string;
  readonly gatewayId: string;
  readonly gatewayToken: string;
  readonly model: string;
  readonly policyVersion: string;
  readonly timeoutMs: number;
  readonly openAiApiKey?: string;
  readonly onTelemetry?: (telemetry: CloudflareAiGatewayRankerTelemetry) => void;
}

export interface CloudflareAiGatewayRankerTelemetry {
  readonly status: "COMPLETED" | "FAILED";
  readonly provider: "openai";
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

type Fetcher = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

const ACTIVE_RANKING_CACHE_TTL_SECONDS = 300;

const OpenAiResponseSchema = Schema.Struct({
  output: Schema.Array(Schema.Struct({
    content: Schema.optional(Schema.Array(Schema.Struct({
      type: Schema.String,
      text: Schema.optional(Schema.String),
    }))),
  })),
  usage: Schema.optional(Schema.NullOr(Schema.Struct({
    input_tokens: Schema.Number,
    output_tokens: Schema.Number,
    total_tokens: Schema.Number,
  }))),
});

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
  }) => void
): Promise<{
  readonly ranking: TripActionRanking;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly totalTokens: number;
}> => {
  try {
    const body = await Schema.decodeUnknownPromise(OpenAiResponseSchema)(
      await response.json()
    );
    const usage = {
      inputTokens: body.usage?.input_tokens ?? 0,
      outputTokens: body.usage?.output_tokens ?? 0,
      totalTokens: body.usage?.total_tokens ?? 0,
    };
    onUsage(usage);
    const outputText = body.output
      .flatMap(({ content }) => content ?? [])
      .find(({ type, text }) => type === "output_text" && text)?.text;
    if (!outputText) throw invalidOutput();

    const ranking = await Schema.decodeUnknownPromise(
      TripActionRankingSchema,
      { onExcessProperty: "error" }
    )(JSON.parse(outputText));
    if (!applyTripActionRanking(eligibleActions, ranking)) throw invalidOutput();

    return {
      ranking,
      ...usage,
    };
  } catch (error) {
    throw error instanceof TripActionRankingError ? error : invalidOutput();
  }
};

export const makeCloudflareAiGatewayTripActionRanker = (
  config: CloudflareAiGatewayRankerConfig,
  fetcher: Fetcher = fetch
): TripActionRankerService => {
  const accountId = config.accountId.trim();
  const gatewayId = config.gatewayId.trim();
  const gatewayToken = config.gatewayToken.trim();
  const model = config.model.trim();
  const policyVersion = config.policyVersion.trim();
  if (
    !accountId ||
    !gatewayId ||
    !gatewayToken ||
    !model ||
    !policyVersion ||
    !Number.isInteger(config.timeoutMs) ||
    config.timeoutMs <= 0
  ) {
    throw new Error("Cloudflare AI Gateway ranker configuration is invalid");
  }

  const endpoint = [
    "https://gateway.ai.cloudflare.com/v1",
    encodeURIComponent(accountId),
    encodeURIComponent(gatewayId),
    "openai/responses",
  ].join("/");
  const emitTelemetry = (telemetry: CloudflareAiGatewayRankerTelemetry) => {
    try {
      config.onTelemetry?.(telemetry);
    } catch {
      // Telemetry observers must never change ranking behavior.
    }
  };

  return {
    policyVersion,
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
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "cf-aig-authorization": `Bearer ${gatewayToken}`,
        "cf-aig-collect-log-payload": "false",
        "cf-aig-max-attempts": "1",
        "cf-aig-request-timeout": String(config.timeoutMs),
        "cf-aig-metadata": JSON.stringify({
          feature: "trip-action-ranking",
          policyVersion,
        }),
      };
      if (config.openAiApiKey?.trim()) {
        headers.Authorization = `Bearer ${config.openAiApiKey.trim()}`;
      }

      const request = Effect.tryPromise({
        try: async () => {
          const response = await fetcher(endpoint, {
            method: "POST",
            headers,
            signal: AbortSignal.timeout(config.timeoutMs),
            body: JSON.stringify({
              model,
              store: false,
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
              text: {
                format: {
                  type: "json_schema",
                  name: "trip_action_ranking",
                  strict: true,
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
                },
              },
            }),
          });
          const firstResponseLatencyMs = Date.now() - startedAt;
          attempt.firstResponseLatencyMs = firstResponseLatencyMs;
          attempt.statusCode = response.status;
          if (!response.ok) {
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
              }
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
            provider: "openai",
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
              provider: "openai",
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
            provider: "openai",
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
              provider: "openai",
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
