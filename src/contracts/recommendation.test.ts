import { Result, Schema } from "effect";
import { describe, expect, it } from "vitest";
import {
  RecommendationLifecycleEventNameSchema,
} from "../core/domain/trip-action.ts";
import {
  RecommendNextActionRequestSchema,
  RecommendNextActionResponseSchema,
} from "./recommendation.ts";

const strictInput = { onExcessProperty: "error" } as const;

describe("recommendation HTTP contract", () => {
  it("first-plan 원문 없이 완료 상태 fact만 받는다", () => {
    const decode = Schema.decodeUnknownResult(
      RecommendNextActionRequestSchema,
      strictInput
    );

    expect(Result.isSuccess(decode({
      surface: "FIRST_PLAN",
      draft: {
        basic: true,
        route: false,
        accommodation: false,
        transport: false,
      },
    }))).toBe(true);
    expect(Result.isFailure(decode({
      surface: "FIRST_PLAN",
      draft: {
        basic: true,
        route: false,
        accommodation: false,
        transport: false,
        title: "서버로 보내면 안 되는 초안 원문",
        memo: "민감한 메모",
        bookingUrl: "https://secret.example",
      },
    }))).toBe(true);
  });

  it("공개 응답에서 provider/model/token/cost 필드를 허용하지 않는다", () => {
    const decode = Schema.decodeUnknownResult(
      RecommendNextActionResponseSchema,
      strictInput
    );
    const response = {
      recommendationId: "recommendation-1",
      primary: {
        actionId: "DEFINE_ROUTE",
        reasonCode: "DEFINE_TRAVEL_ROUTE",
      },
      alternatives: [{ actionId: "INVITE_MEMBER" }],
      source: "RULE",
      contextFingerprint: "fingerprint",
    };

    expect(Result.isSuccess(decode(response))).toBe(true);
    expect(Result.isFailure(decode({
      ...response,
      provider: "example-provider",
      model: "example-model",
      tokenCount: 10,
      cost: 1,
    }))).toBe(true);
  });

  it("NBA lifecycle event taxonomy를 고정한다", () => {
    expect(RecommendationLifecycleEventNameSchema.literals).toEqual([
      "nba_impression",
      "nba_accept",
      "nba_alternative_selected",
      "nba_skip",
      "nba_action_completed",
    ]);
  });
});
