import { Effect, Exit, Layer } from "effect";
import { describe, expect, it, vi } from "vitest";
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
  type TripActionRankerService,
} from "../../ports/trip-action-ranker.ts";
import { createTestIdGenerator } from "../../../infrastructure/id-generator.ts";
import { createLocalSessionLayer } from "../../../infrastructure/local/local-session.ts";
import { recommendNextTripAction } from "../recommend-next-trip-action.ts";

const hostId = UserIdSchema.make("host-1");
const memberId = UserIdSchema.make("member-1");
const room: TripRoom = {
  id: TripIdSchema.make("trip-1"),
  title: "도쿄 여행",
  destination: "도쿄",
  revision: RevisionSchema.make(3),
  members: [{ id: hostId, name: "Host", role: "HOST" }],
  plans: [],
};
const roomWithPlan: TripRoom = {
  ...room,
  plans: [{
    id: PlanIdSchema.make("plan-1"),
    title: "첫 여행안",
    status: "VOTING",
    places: [],
    voteCount: 0,
  }],
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
const planHomeCommand = {
  tripId: room.id,
  surface: "PLAN_HOME" as const,
};

describe("recommendNextTripAction", () => {
  it("HOME은 동일한 RBAC와 결정 규칙으로 의견 행동을 추천한다", async () => {
    const result = await Effect.runPromise(recommendNextTripAction({ tripId: room.id, surface: "HOME" }).pipe(
      Effect.provide(layerFor({ ...roomWithPlan, members: [...room.members, { id: memberId, name: "Member", role: "MEMBER" }] })),
    ));
    expect(result.primary.actionId).toBe("PROPOSE_ALTERNATIVE");
    expect(result.alternatives.map(({ actionId }) => actionId)).toContain("GIVE_OPINION");
  });
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

  it("ambiguous context에서만 주입된 ranker의 eligible ranking을 적용한다", async () => {
    const result = await Effect.runPromise(
      recommendNextTripAction(planHomeCommand).pipe(
        Effect.provide(Layer.merge(
          layerFor(roomWithPlan),
          Layer.succeed(TripActionRanker, {
            policyVersion: "nba-ai-test-v1",
            rank: () => Effect.succeed({
              primaryActionId: "INVITE_MEMBER",
              alternativeActionIds: [
                "PROPOSE_ALTERNATIVE",
                "GIVE_OPINION",
              ],
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

  it("deterministic first-plan context에서는 ranker를 호출하지 않는다", async () => {
    const rank = vi.fn<TripActionRankerService["rank"]>(
      () => Effect.die("ranker must not be called")
    );
    const result = await Effect.runPromise(
      recommendNextTripAction(draftCommand).pipe(
        Effect.provide(Layer.merge(
          layerFor(room),
          Layer.succeed(TripActionRanker, {
            policyVersion: "nba-ai-test-v1",
            rank,
          })
        ))
      )
    );

    expect(result.source).toBe("RULE");
    expect(rank).not.toHaveBeenCalled();
  });

  it("ranker 실패 시 deterministic RULE recommendation으로 fallback한다", async () => {
    const result = await Effect.runPromise(
      recommendNextTripAction(planHomeCommand).pipe(
        Effect.provide(Layer.merge(
          layerFor(roomWithPlan),
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
      primary: { actionId: "PROPOSE_ALTERNATIVE" },
    });
  });

  it("decision status가 달라지면 eligible set이 같아도 fingerprint를 분리한다", async () => {
    const plans = [
      {
        ...roomWithPlan.plans[0]!,
        memberOpinions: [{
          userId: hostId,
          userName: "Host",
          reaction: "LIKE" as const,
        }],
      },
      {
        ...roomWithPlan.plans[0]!,
        id: PlanIdSchema.make("plan-2"),
        memberOpinions: [{
          userId: hostId,
          userName: "Host",
          reaction: "LIKE" as const,
        }],
      },
    ];
    const incompleteFeedbackRoom: TripRoom = {
      ...room,
      members: [
        ...room.members,
        { id: memberId, name: "Member", role: "MEMBER" },
      ],
      plans,
    };
    const completeFeedbackRoom: TripRoom = {
      ...incompleteFeedbackRoom,
      plans: [
        plans[0]!,
        {
          ...plans[1]!,
          memberOpinions: [
            ...plans[1]!.memberOpinions!,
            { userId: memberId, userName: "Member", reaction: "OKAY" as const },
          ],
        },
      ],
    };

    const incomplete = await Effect.runPromise(
      recommendNextTripAction(planHomeCommand).pipe(
        Effect.provide(layerFor(incompleteFeedbackRoom))
      )
    );
    const complete = await Effect.runPromise(
      recommendNextTripAction(planHomeCommand).pipe(
        Effect.provide(layerFor(completeFeedbackRoom))
      )
    );

    expect(incomplete.rankingInput.eligibleActions.map(({ actionId }) => actionId))
      .toEqual(complete.rankingInput.eligibleActions.map(({ actionId }) => actionId));
    expect(incomplete.contextFingerprint).not.toBe(complete.contextFingerprint);
  });

  it("첫 plan이 생긴 뒤 도착한 draft snapshot을 stale state로 거절한다", async () => {
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
      }).pipe(Effect.provide(layerFor(roomWithPlan)))
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
