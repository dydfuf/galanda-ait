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
}

type Fetcher = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

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
  eligibleActions: TripActionRankingInput["eligibleActions"]
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
      inputTokens: body.usage?.input_tokens ?? 0,
      outputTokens: body.usage?.output_tokens ?? 0,
      totalTokens: body.usage?.total_tokens ?? 0,
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

  return {
    policyVersion,
    rank: (input) => {
      const startedAt = Date.now();
      if (!input.eligibleActions[0]) return Effect.fail(invalidOutput());
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
          if (!response.ok) {
            throw new TripActionRankingError({
              reason: "PROVIDER_ERROR",
              statusCode: response.status,
            });
          }

          return {
            ...(await decodeRanking(response, input.eligibleActions)),
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
        Effect.tap(({ inputTokens, outputTokens, totalTokens, statusCode }) =>
          Effect.logInfo("nba_ai_ranker_completed").pipe(
            Effect.annotateLogs({
              provider: "openai",
              model,
              policyVersion,
              latencyMs: Date.now() - startedAt,
              statusCode,
              inputTokens,
              outputTokens,
              totalTokens,
            })
          )
        ),
        Effect.tapError((error) =>
          Effect.logWarning("nba_ai_ranker_failed").pipe(
            Effect.annotateLogs({
              provider: "openai",
              model,
              policyVersion,
              latencyMs: Date.now() - startedAt,
              failure: error.reason,
              statusCode: error.statusCode ?? 0,
            })
          )
        ),
        Effect.map(({ ranking }) => ranking)
      );
    },
  };
};
