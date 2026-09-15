import { Effect, Exit } from "effect";
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
