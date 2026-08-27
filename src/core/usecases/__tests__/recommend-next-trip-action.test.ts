import { Effect, Exit, Layer } from "effect";
import { describe, expect, it } from "vitest";
import {
  PlanIdSchema,
  RevisionSchema,
  TripIdSchema,
  UserIdSchema,
} from "../../domain/ids.ts";
import type { TripRoom } from "../../domain/room.ts";
import { TripRoomRepository } from "../../ports/trip-room-repository.ts";
import {
  TripActionRanker,
  TripActionRankingError,
} from "../../ports/trip-action-ranker.ts";
import { createTestIdGenerator } from "../../../infrastructure/id-generator.ts";
import { createLocalSessionLayer } from "../../../infrastructure/local/local-session.ts";
import { recommendNextTripAction } from "../recommend-next-trip-action.ts";

const hostId = UserIdSchema.make("host-1");
const room: TripRoom = {
  id: TripIdSchema.make("trip-1"),
  title: "도쿄 여행",
  destination: "도쿄",
  revision: RevisionSchema.make(3),
  members: [{ id: hostId, name: "Host", role: "HOST" }],
  plans: [],
};

const layerFor = (value: TripRoom) => Layer.mergeAll(
  Layer.succeed(TripRoomRepository, {
    getRoom: () => Effect.succeed(value),
  } as any),
  createLocalSessionLayer({
    participantId: hostId,
    participantIds: [hostId],
    accountType: "REGISTERED",
    name: "Host",
    isAuthenticated: true,
  }),
  createTestIdGenerator({ recommendationId: "recommendation-test-001" })
);

const draftCommand = {
  tripId: room.id,
  surface: "FIRST_PLAN" as const,
  draft: {
    basic: true,
    route: false,
    accommodation: false,
    transport: false,
  },
};

describe("recommendNextTripAction", () => {
  it("minimal draft fact를 deterministic RULE recommendation으로 변환한다", async () => {
    const program = recommendNextTripAction(draftCommand).pipe(
      Effect.provide(layerFor(room))
    );

    const first = await Effect.runPromise(program);
    const second = await Effect.runPromise(program);

    expect(first).toMatchObject({
      recommendationId: "recommendation-test-001",
      primary: {
        actionId: "DEFINE_ROUTE",
        reasonCode: "DEFINE_TRAVEL_ROUTE",
      },
      source: "RULE",
    });
    expect(first.alternatives.map(({ actionId }) => actionId)).toContain(
      "INVITE_MEMBER"
    );
    expect(first.contextFingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(second.contextFingerprint).toBe(first.contextFingerprint);

    const changed = await Effect.runPromise(
      recommendNextTripAction({
        ...draftCommand,
        draft: { ...draftCommand.draft, route: true },
      }).pipe(Effect.provide(layerFor(room)))
    );
    expect(changed.contextFingerprint).not.toBe(first.contextFingerprint);

    const revised = await Effect.runPromise(
      recommendNextTripAction(draftCommand).pipe(
        Effect.provide(layerFor({
          ...room,
          revision: RevisionSchema.make(4),
        }))
      )
    );
    expect(revised.contextFingerprint).not.toBe(first.contextFingerprint);
  });

  it("주입된 ranker의 eligible ranking을 적용한다", async () => {
    const result = await Effect.runPromise(
      recommendNextTripAction(draftCommand).pipe(
        Effect.provide(Layer.merge(
          layerFor(room),
          Layer.succeed(TripActionRanker, {
            policyVersion: "nba-ai-test-v1",
            rank: () => Effect.succeed({
              primaryActionId: "INVITE_MEMBER",
              alternativeActionIds: ["DEFINE_ROUTE"],
              reasonCode: "INVITE_TRAVEL_COMPANION",
            }),
          })
        ))
      )
    );

    expect(result).toMatchObject({
      source: "AI",
      primary: { actionId: "INVITE_MEMBER" },
    });
  });

  it("ranker 실패 시 deterministic RULE recommendation으로 fallback한다", async () => {
    const result = await Effect.runPromise(
      recommendNextTripAction(draftCommand).pipe(
        Effect.provide(Layer.merge(
          layerFor(room),
          Layer.succeed(TripActionRanker, {
            policyVersion: "nba-ai-test-v1",
            rank: () => Effect.fail(
              new TripActionRankingError({ reason: "TIMEOUT" })
            ),
          })
        ))
      )
    );

    expect(result).toMatchObject({
      source: "RULE",
      primary: { actionId: "DEFINE_ROUTE" },
    });
  });

  it("첫 plan이 생긴 뒤 도착한 draft snapshot을 stale state로 거절한다", async () => {
    const withPlan: TripRoom = {
      ...room,
      plans: [{
        id: PlanIdSchema.make("plan-1"),
        title: "첫 여행안",
        status: "VOTING",
        places: [],
        voteCount: 0,
      }],
    };
    const exit = await Effect.runPromiseExit(
      recommendNextTripAction({
        tripId: room.id,
        surface: "FIRST_PLAN",
        draft: {
          basic: true,
          route: true,
          accommodation: true,
          transport: true,
        },
      }).pipe(Effect.provide(layerFor(withPlan)))
    );

    expect(Exit.isFailure(exit)).toBe(true);
    expect(JSON.stringify(exit)).toContain("StateConflictError");
  });

  it("draft conflict가 있으면 완료 fact와 무관하게 recommendation을 만들지 않는다", async () => {
    const exit = await Effect.runPromiseExit(
      recommendNextTripAction({
        tripId: room.id,
        surface: "FIRST_PLAN",
        draft: {
          basic: true,
          route: true,
          accommodation: true,
          transport: true,
          conflict: "DRAFT",
        },
      }).pipe(Effect.provide(layerFor(room)))
    );

    expect(Exit.isFailure(exit)).toBe(true);
    expect(JSON.stringify(exit)).toContain("StateConflictError");
  });
});
