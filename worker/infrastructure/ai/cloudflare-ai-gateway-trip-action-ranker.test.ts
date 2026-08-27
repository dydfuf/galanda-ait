import { Effect, Exit } from "effect";
import { describe, expect, it } from "vitest";
import type { TripActionRankingInput } from "../../../src/core/ports/trip-action-ranker.ts";
import {
  makeCloudflareAiGatewayTripActionRanker,
  type CloudflareAiGatewayRankerConfig,
  type CloudflareAiGatewayRankerTelemetry,
} from "./cloudflare-ai-gateway-trip-action-ranker.ts";

const config: CloudflareAiGatewayRankerConfig = {
  accountId: "account-id",
  gatewayId: "gateway-id",
  gatewayToken: "gateway-token",
  model: "test-model",
  policyVersion: "nba-ai-v1",
  timeoutMs: 100,
};

const input: TripActionRankingInput = {
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
    output: [{
      content: [{ type: "output_text", text: JSON.stringify(output) }],
    }],
    usage: { input_tokens: 12, output_tokens: 8, total_tokens: 20 },
  });

describe("CloudflareAiGatewayTripActionRanker", () => {
  it("Responses API structured output을 ranking으로 변환한다", async () => {
    let requestedUrl = "";
    let requestedInit: RequestInit | undefined;
    const telemetry: CloudflareAiGatewayRankerTelemetry[] = [];
    const ranker = makeCloudflareAiGatewayTripActionRanker(
      { ...config, onTelemetry: (event) => telemetry.push(event) },
      async (url, init) => {
        requestedUrl = url instanceof Request
          ? url.url
          : url instanceof URL
            ? url.href
            : url;
        requestedInit = init;
        return responseWithOutput({
          primaryActionId: "INVITE_MEMBER",
          alternativeActionIds: ["DEFINE_ROUTE"],
          reasonCode: "INVITE_TRAVEL_COMPANION",
        });
      }
    );

    await expect(Effect.runPromise(ranker.rank(input))).resolves.toEqual({
      primaryActionId: "INVITE_MEMBER",
      alternativeActionIds: ["DEFINE_ROUTE"],
      reasonCode: "INVITE_TRAVEL_COMPANION",
    });
    expect(requestedUrl).toBe(
      "https://gateway.ai.cloudflare.com/v1/account-id/gateway-id/openai/responses"
    );
    const headers = new Headers(requestedInit?.headers);
    expect(headers.get("cf-aig-authorization")).toBe("Bearer gateway-token");
    expect(headers.get("cf-aig-collect-log-payload")).toBe("false");
    expect(headers.get("cf-aig-max-attempts")).toBe("1");

    const requestBodyText = requestedInit?.body;
    if (typeof requestBodyText !== "string") {
      throw new Error("Expected a JSON string request body");
    }
    const requestBody = JSON.parse(requestBodyText);
    expect(requestBody).toMatchObject({
      model: "test-model",
      store: false,
      text: { format: { type: "json_schema", strict: true } },
    });
    expect(telemetry).toEqual([
      expect.objectContaining({
        status: "COMPLETED",
        provider: "openai",
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
    const ranker = makeCloudflareAiGatewayTripActionRanker(config, fetcher);
    const exit = await Effect.runPromiseExit(ranker.rank(input));

    expect(Exit.isFailure(exit)).toBe(true);
    expect(JSON.stringify(exit)).toContain(reason);
  });

  it("ranking validation failure에도 provider telemetry를 보존한다", async () => {
    const telemetry: CloudflareAiGatewayRankerTelemetry[] = [];
    const ranker = makeCloudflareAiGatewayTripActionRanker(
      { ...config, onTelemetry: (event) => telemetry.push(event) },
      async () => responseWithOutput({ primaryActionId: "DEFINE_ROUTE" })
    );
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
    const ranker = makeCloudflareAiGatewayTripActionRanker(
      { ...config, timeoutMs: 5 },
      (_url, init) => new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => reject(init.signal?.reason),
          { once: true }
        );
      })
    );
    const exit = await Effect.runPromiseExit(ranker.rank(input));

    expect(Exit.isFailure(exit)).toBe(true);
    expect(JSON.stringify(exit)).toContain("TIMEOUT");
  });
});
