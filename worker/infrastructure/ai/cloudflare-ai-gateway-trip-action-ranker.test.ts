import { Effect, Exit, Logger } from "effect";
import { describe, expect, it, vi } from "vitest";
import type { TripActionRankingInput } from "../../../src/core/ports/trip-action-ranker.ts";
import {
  makeCachedTripActionRanker,
  makeCloudflareAiGatewayTripActionRanker,
  type CloudflareAiGatewayRankerConfig,
  type CloudflareAiGatewayRankerTelemetry,
} from "./cloudflare-ai-gateway-trip-action-ranker.ts";

const config: CloudflareAiGatewayRankerConfig = {
  model: "test-model",
  policyVersion: "nba-ai-v1",
  timeoutMs: 100,
};

const input: TripActionRankingInput = {
  contextFingerprint: "context-fingerprint-1",
  surface: "FIRST_PLAN",
  decisions: [
    { id: "TRAVEL_ROUTE", status: "INCOMPLETE" },
    { id: "MEMBERSHIP", status: "INCOMPLETE" },
  ],
  eligibleActions: [
    {
      actionId: "DEFINE_ROUTE",
      decisionId: "TRAVEL_ROUTE",
      reasonCode: "DEFINE_TRAVEL_ROUTE",
    },
    {
      actionId: "INVITE_MEMBER",
      decisionId: "MEMBERSHIP",
      reasonCode: "INVITE_TRAVEL_COMPANION",
    },
  ],
};

const responseWithOutput = (output: unknown): Response =>
  Response.json({
    choices: [{ finish_reason: "stop", message: { content: JSON.stringify(output) } }],
    usage: { prompt_tokens: 12, completion_tokens: 8, total_tokens: 20 },
  });

describe("CloudflareAiGatewayTripActionRanker", () => {
  it("OpenRouter BYOK binding의 structured output을 ranking으로 변환한다", async () => {
    const telemetry: CloudflareAiGatewayRankerTelemetry[] = [];
    const run = vi.fn<AiGateway["run"]>(async () => responseWithOutput({
          primaryActionId: "INVITE_MEMBER",
          alternativeActionIds: ["DEFINE_ROUTE"],
          reasonCode: "INVITE_TRAVEL_COMPANION",
    }));
    const ranker = makeCloudflareAiGatewayTripActionRanker({
      ...config, gateway: { run }, onTelemetry: (event) => telemetry.push(event),
    });

    await expect(Effect.runPromise(ranker.rank(input))).resolves.toEqual({
      primaryActionId: "INVITE_MEMBER",
      alternativeActionIds: ["DEFINE_ROUTE"],
      reasonCode: "INVITE_TRAVEL_COMPANION",
    });
    expect(run).toHaveBeenCalledWith(expect.objectContaining({
      provider: "openrouter", endpoint: "https://openrouter.ai/api/v1/chat/completions",
      headers: { "cf-aig-collect-log-payload": "true" },
      query: expect.objectContaining({
        model: "test-model",
        reasoning: { effort: "low" },
        response_format: { type: "json_schema", json_schema: expect.objectContaining({ strict: true }) },
        provider: { require_parameters: true, data_collection: "deny" },
      }),
    }), expect.objectContaining({ extraHeaders: {
      "cf-aig-skip-cache": "true", "cf-aig-request-timeout": "100",
      "cf-aig-max-attempts": "1", "cf-aig-collect-log-payload": "true",
    } }));
    expect(telemetry).toEqual([
      expect.objectContaining({
        status: "COMPLETED",
        provider: "openrouter",
        model: "test-model",
        configuredTimeoutMs: 100,
        statusCode: 200,
        inputTokens: 12,
        outputTokens: 8,
        totalTokens: 20,
      }),
    ]);
    expect(telemetry[0]?.firstResponseLatencyMs).toBeGreaterThanOrEqual(0);
    expect(telemetry[0]?.totalLatencyMs).toBeGreaterThanOrEqual(
      telemetry[0]?.firstResponseLatencyMs ?? 0
    );
  });

  it.each([
    [
      "invalid schema",
      async () => responseWithOutput({ primaryActionId: "DEFINE_ROUTE" }),
      "INVALID_OUTPUT",
    ],
    [
      "out-of-eligible action",
      async () => responseWithOutput({
        primaryActionId: "VIEW_ITINERARY",
        alternativeActionIds: [],
        reasonCode: "TRIP_CONFIRMED",
      }),
      "INVALID_OUTPUT",
    ],
    [
      "provider error",
      async () => new Response(null, { status: 429 }),
      "PROVIDER_ERROR",
    ],
  ])("%s를 typed failure로 반환한다", async (_name, fetcher, reason) => {
    const ranker = makeCloudflareAiGatewayTripActionRanker({ ...config, gateway: { run: fetcher } });
    const exit = await Effect.runPromiseExit(ranker.rank(input));

    expect(Exit.isFailure(exit)).toBe(true);
    expect(JSON.stringify(exit)).toContain(reason);
  });

  it("ranking validation failure에도 provider telemetry를 보존한다", async () => {
    const telemetry: CloudflareAiGatewayRankerTelemetry[] = [];
    const ranker = makeCloudflareAiGatewayTripActionRanker({
      ...config, onTelemetry: (event) => telemetry.push(event),
      gateway: { run: async () => responseWithOutput({ primaryActionId: "DEFINE_ROUTE" }) },
    });
    const exit = await Effect.runPromiseExit(ranker.rank(input));

    expect(Exit.isFailure(exit)).toBe(true);
    expect(JSON.stringify(exit)).toContain("INVALID_OUTPUT");
    expect(telemetry).toEqual([
      expect.objectContaining({
        status: "FAILED",
        statusCode: 200,
        inputTokens: 12,
        outputTokens: 8,
        totalTokens: 20,
      }),
    ]);
    expect(telemetry[0]?.firstResponseLatencyMs).toBeGreaterThanOrEqual(0);
    expect(telemetry[0]?.totalLatencyMs).toBeGreaterThanOrEqual(
      telemetry[0]?.firstResponseLatencyMs ?? 0
    );
  });

  it("request contract states a complete permutation and preserves the inference budget", async () => {
    const run = vi.fn<AiGateway["run"]>(async () => responseWithOutput({
      primaryActionId: "DEFINE_ROUTE",
      alternativeActionIds: ["INVITE_MEMBER"],
      reasonCode: "DEFINE_TRAVEL_ROUTE",
    }));
    const ranker = makeCloudflareAiGatewayTripActionRanker({ ...config, gateway: { run } });
    await Effect.runPromise(ranker.rank(input));
    expect(ranker.policyVersion).toBe("nba-ai-v1:openrouter-v3:test-model");
    expect(run).toHaveBeenCalledWith(expect.objectContaining({
      query: expect.objectContaining({
        max_tokens: 500,
        reasoning: { effort: "low" },
        messages: expect.arrayContaining([expect.objectContaining({
          role: "system",
          content: expect.stringContaining("every other eligible action ID in alternativeActionIds exactly once"),
        }), expect.objectContaining({
          role: "system",
          content: expect.stringContaining("whose actionId equals primaryActionId"),
        })]),
        response_format: {
          type: "json_schema",
          json_schema: expect.objectContaining({
            strict: true,
            schema: expect.objectContaining({
              additionalProperties: false,
              properties: expect.objectContaining({
                primaryActionId: expect.objectContaining({ enum: ["DEFINE_ROUTE", "INVITE_MEMBER"] }),
                alternativeActionIds: expect.objectContaining({
                  description: expect.stringContaining("Exactly 1 action IDs"),
                  items: { type: "string", enum: ["DEFINE_ROUTE", "INVITE_MEMBER"] },
                }),
              }),
            }),
          }),
        },
      }),
    }), expect.anything());
  });

  it.each([
    ["missing alternative", { primaryActionId: "DEFINE_ROUTE", alternativeActionIds: [], reasonCode: "DEFINE_TRAVEL_ROUTE" }, "MISSING_ACTION"],
    ["duplicate alternative", { primaryActionId: "DEFINE_ROUTE", alternativeActionIds: ["INVITE_MEMBER", "INVITE_MEMBER"], reasonCode: "DEFINE_TRAVEL_ROUTE" }, "DUPLICATE_ALTERNATIVE"],
    ["primary repeated", { primaryActionId: "DEFINE_ROUTE", alternativeActionIds: ["DEFINE_ROUTE"], reasonCode: "DEFINE_TRAVEL_ROUTE" }, "PRIMARY_REPEATED"],
    ["unknown eligible ID", { primaryActionId: "VIEW_ITINERARY", alternativeActionIds: ["INVITE_MEMBER"], reasonCode: "TRIP_CONFIRMED" }, "UNKNOWN_ACTION"],
    ["unknown action enum", { primaryActionId: "invented-private-value", alternativeActionIds: ["INVITE_MEMBER"], reasonCode: "DEFINE_TRAVEL_ROUTE" }, "RANKING_SCHEMA"],
    ["reason mismatch", { primaryActionId: "DEFINE_ROUTE", alternativeActionIds: ["INVITE_MEMBER"], reasonCode: "INVITE_TRAVEL_COMPANION" }, "REASON_MISMATCH"],
    ["extra property", { primaryActionId: "DEFINE_ROUTE", alternativeActionIds: ["INVITE_MEMBER"], reasonCode: "DEFINE_TRAVEL_ROUTE", privateText: "do-not-log" }, "RANKING_SCHEMA"],
  ])("classifies %s without changing the public error", async (_name, output, invalidOutputReason) => {
    const telemetry: CloudflareAiGatewayRankerTelemetry[] = [];
    const logs: string[] = [];
    const ranker = makeCloudflareAiGatewayTripActionRanker({
      ...config, gateway: { run: async () => responseWithOutput(output) },
      onTelemetry: (event) => telemetry.push(event),
    });
    const failure = await Effect.runPromise(ranker.rank(input).pipe(
      Effect.flip,
      Effect.provide(Logger.layer([Logger.formatJson.pipe(Logger.map((line) => { logs.push(line); }))])),
    ));
    expect(failure.toJSON()).toEqual({ _tag: "TripActionRankingError", reason: "INVALID_OUTPUT" });
    expect(telemetry).toEqual([expect.objectContaining({
      status: "FAILED", failure: "INVALID_OUTPUT", invalidOutputReason,
      inputTokens: 12, outputTokens: 8, totalTokens: 20,
      finishReason: "stop", choiceCount: 1,
    })]);
    expect(logs.join()).toContain(invalidOutputReason);
    expect(JSON.stringify({ telemetry, logs, failure })).not.toMatch(/invented-private-value|do-not-log|primaryActionId|alternativeActionIds/);
  });

  it.each([
    ["truncated empty content", { choices: [{ finish_reason: "length", message: { content: "" } }] }, "FINISH_REASON"],
    ["empty stopped content", { choices: [{ finish_reason: "stop", message: { content: "" } }] }, "EMPTY_CONTENT"],
    ["refusal", { choices: [{ finish_reason: "stop", message: { content: null, refusal: "private refusal text" } }] }, "REFUSAL"],
    ["malformed ranking JSON", { choices: [{ finish_reason: "stop", message: { content: "{private content" } }] }, "RANKING_JSON"],
    ["invalid envelope", { choices: [] }, "ENVELOPE_SCHEMA"],
  ])("retains usage and safe diagnostics for %s", async (_name, body, invalidOutputReason) => {
    const telemetry: CloudflareAiGatewayRankerTelemetry[] = [];
    const ranker = makeCloudflareAiGatewayTripActionRanker({
      ...config,
      gateway: { run: async () => Response.json({
        ...body, usage: { prompt_tokens: 100, completion_tokens: 500, total_tokens: 600 },
      }) },
      onTelemetry: (event) => telemetry.push(event),
    });
    const exit = await Effect.runPromiseExit(ranker.rank(input));
    expect(Exit.isFailure(exit)).toBe(true);
    expect(telemetry).toEqual([expect.objectContaining({
      status: "FAILED", failure: "INVALID_OUTPUT", invalidOutputReason,
      statusCode: 200, inputTokens: 100, outputTokens: 500, totalTokens: 600,
    })]);
    expect(JSON.stringify({ telemetry, exit })).not.toContain("private");
  });

  it("classifies malformed response JSON without retaining its contents", async () => {
    const telemetry: CloudflareAiGatewayRankerTelemetry[] = [];
    const ranker = makeCloudflareAiGatewayTripActionRanker({
      ...config, gateway: { run: async () => new Response("{private-provider-body") },
      onTelemetry: (event) => telemetry.push(event),
    });
    const exit = await Effect.runPromiseExit(ranker.rank(input));
    expect(Exit.isFailure(exit)).toBe(true);
    expect(telemetry[0]).toMatchObject({ invalidOutputReason: "RESPONSE_JSON", totalTokens: 0 });
    expect(JSON.stringify({ telemetry, exit })).not.toContain("private-provider-body");
  });

  it("rejects empty candidates without calling the provider and emits one diagnostic", async () => {
    const telemetry: CloudflareAiGatewayRankerTelemetry[] = [];
    const run = vi.fn<AiGateway["run"]>();
    const ranker = makeCloudflareAiGatewayTripActionRanker({
      ...config, gateway: { run }, onTelemetry: (event) => telemetry.push(event),
    });
    const exit = await Effect.runPromiseExit(ranker.rank({ ...input, eligibleActions: [] }));
    expect(Exit.isFailure(exit)).toBe(true);
    expect(run).not.toHaveBeenCalled();
    expect(telemetry).toEqual([expect.objectContaining({ invalidOutputReason: "EMPTY_CANDIDATES", statusCode: 0 })]);
  });

  it("keeps telemetry failures and repeated Effect execution isolated", async () => {
    const telemetry: CloudflareAiGatewayRankerTelemetry[] = [];
    let calls = 0;
    const ranker = makeCloudflareAiGatewayTripActionRanker({
      ...config,
      gateway: { run: async () => ++calls === 1 ? responseWithOutput({}) : responseWithOutput({
        primaryActionId: "DEFINE_ROUTE", alternativeActionIds: ["INVITE_MEMBER"], reasonCode: "DEFINE_TRAVEL_ROUTE",
      }) },
      onTelemetry: (event) => { telemetry.push(event); throw new Error("observer failed"); },
    });
    const program = ranker.rank(input);
    expect(Exit.isFailure(await Effect.runPromiseExit(program))).toBe(true);
    await expect(Effect.runPromise(program)).resolves.toMatchObject({ primaryActionId: "DEFINE_ROUTE" });
    expect(telemetry[0]?.invalidOutputReason).toBe("RANKING_SCHEMA");
    expect(telemetry[1]?.status).toBe("COMPLETED");
    expect(telemetry[1]?.invalidOutputReason).toBeUndefined();
  });

  it("설정된 latency budget이 지나면 TIMEOUT을 반환한다", async () => {
    const ranker = makeCloudflareAiGatewayTripActionRanker({
      ...config, timeoutMs: 5,
      gateway: { run: (_request, init) => new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => reject(init.signal?.reason),
          { once: true }
        );
      }) },
    });
    const exit = await Effect.runPromiseExit(ranker.rank(input));

    expect(Exit.isFailure(exit)).toBe(true);
    expect(JSON.stringify(exit)).toContain("TIMEOUT");
  });

  it("headers 이후 본문이 멈춰도 TIMEOUT을 반환한다", async () => {
    const ranker = makeCloudflareAiGatewayTripActionRanker({
      ...config, timeoutMs: 5,
      gateway: { run: async () => new Response(new ReadableStream()) },
    });
    const exit = await Effect.runPromiseExit(ranker.rank(input));
    expect(Exit.isFailure(exit)).toBe(true);
    expect(JSON.stringify(exit)).toContain("TIMEOUT");
  });

  it("동일 fingerprint의 ranking을 재사용하고 stale fingerprint는 다시 조회한다", async () => {
    let providerCalls = 0;
    const pendingWrites: Promise<unknown>[] = [];
    const entries = new Map<string, Response>();
    const cache = {
      match: async (request: RequestInfo | URL) =>
        entries.get(new Request(request).url)?.clone(),
      put: async (request: RequestInfo | URL, response: Response) => {
        entries.set(new Request(request).url, response.clone());
      },
    } satisfies Pick<Cache, "match" | "put">;
    const provider = makeCloudflareAiGatewayTripActionRanker({
      ...config, gateway: { run: async () => {
        providerCalls += 1;
        return responseWithOutput({
          primaryActionId: "INVITE_MEMBER",
          alternativeActionIds: ["DEFINE_ROUTE"],
          reasonCode: "INVITE_TRAVEL_COMPANION",
        });
      } },
    });
    const ranker = makeCachedTripActionRanker(
      provider,
      cache,
      (promise) => pendingWrites.push(promise)
    );

    await Effect.runPromise(ranker.rank(input));
    await Promise.all(pendingWrites);
    await Effect.runPromise(ranker.rank(input));
    await Effect.runPromise(ranker.rank({
      ...input,
      contextFingerprint: "context-fingerprint-2",
    }));

    expect(providerCalls).toBe(2);

    const anotherModel = makeCachedTripActionRanker(
      makeCloudflareAiGatewayTripActionRanker({
        ...config, model: "another-model", gateway: { run: async () => {
          providerCalls += 1;
          return responseWithOutput({
            primaryActionId: "INVITE_MEMBER",
            alternativeActionIds: ["DEFINE_ROUTE"],
            reasonCode: "INVITE_TRAVEL_COMPANION",
          });
        } },
      }),
      cache,
      (promise) => pendingWrites.push(promise)
    );
    await Effect.runPromise(anotherModel.rank(input));
    await Promise.all(pendingWrites);
    expect(providerCalls).toBe(3);
  });
});
