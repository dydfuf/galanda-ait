import { describe, expect, it } from "vitest";
import { getRoomActor } from "../auth-guards.ts";
import {
  PlanIdSchema,
  RevisionSchema,
  TripIdSchema,
  UserIdSchema,
} from "../ids.ts";
import {
  getPlanPublishCompletion,
  type PlanPublishInput,
  type TripRoom,
} from "../room.ts";
import {
  applyTripActionRanking,
  isAiRankingNeeded,
  reasonCodeForAction,
  resolveEligibleTripActions,
  validateTripActionRanking,
} from "../trip-action-resolver.ts";
import { toTripRoomDecisionContext, type TripDecisionContext } from "../trip-decision.ts";

const hostId = UserIdSchema.make("host-1");
const memberId = UserIdSchema.make("member-1");
const room: TripRoom = {
  id: TripIdSchema.make("trip-1"),
  title: "서울 여행",
  destination: "서울",
  revision: RevisionSchema.make(1),
  members: [
    { id: hostId, name: "방장", role: "HOST" },
    { id: memberId, name: "멤버", role: "MEMBER" },
  ],
  plans: [{
    id: PlanIdSchema.make("plan-1"),
    title: "기본안",
    status: "VOTING",
    places: [],
    voteCount: 0,
  }],
};

const host = getRoomActor(room, hostId);
const member = getRoomActor(room, memberId);
const guest = getRoomActor(room);

const completeDraft: PlanPublishInput = {
  title: "서울 여행",
  baseHeadcount: 2,
  routes: [{
    city: "서울",
    arrivalDate: "2026-09-01",
    departureDate: "2026-09-03",
  }],
  accommodations: [{
    id: "stay-1",
    city: "서울",
    period: "2026-09-01 ~ 2026-09-03",
    nights: 2,
    hotelName: "",
    isSearching: true,
    bookingStatus: "NOT_CHECKED",
  }],
  transports: [
    {
      id: "outbound",
      fromCity: "부산",
      toCity: "서울",
      mode: "",
      hasTransfer: false,
      durationText: "",
      bookingStatus: "NOT_CHECKED",
    },
    {
      id: "return",
      fromCity: "서울",
      toCity: "부산",
      mode: "",
      hasTransfer: false,
      durationText: "",
      bookingStatus: "NOT_CHECKED",
    },
  ],
};

const context = (
  overrides: Partial<TripDecisionContext> = {}
): TripDecisionContext => ({
  planCount: 0,
  memberCount: 2,
  opinionParticipantCount: 0,
  actorHasOpinion: false,
  isConfirmed: false,
  confirmablePlanCount: 0,
  ...overrides,
});

const actionIds = (
  value: ReturnType<typeof resolveEligibleTripActions>
) => value.map(({ actionId }) => actionId);

describe("deterministic Trip action resolver", () => {
  it("한 안에 응답했어도 다른 후보가 미응답이면 의견 행동을 유지한다", () => {
    const opinion = { userId: memberId, userName: "멤버", reaction: "LIKE" as const };
    const partial: TripRoom = { ...room, plans: [
      { ...room.plans[0], memberOpinions: [opinion] },
      { ...room.plans[0], id: PlanIdSchema.make("second") },
    ] };
    expect(actionIds(resolveEligibleTripActions(toTripRoomDecisionContext(partial, member), member))).toContain("GIVE_OPINION");
    const complete = { ...partial, plans: partial.plans.map((plan) => ({ ...plan, memberOpinions: [opinion] })) };
    expect(actionIds(resolveEligibleTripActions(toTripRoomDecisionContext(complete, member), member))).not.toContain("GIVE_OPINION");
  });
  it.each([
    ["first plan basic incomplete", { title: "", baseHeadcount: 0 }, "EDIT_PLAN_BASIC"],
    ["basic complete and route missing", { title: "서울", baseHeadcount: 2 }, "DEFINE_ROUTE"],
    [
      "route complete and accommodation missing",
      { ...completeDraft, accommodations: [], transports: [] },
      "ADD_ACCOMMODATION",
    ],
    ["accommodation searching and transport not checked", completeDraft, "PUBLISH_FIRST_PLAN"],
  ] as const)("%s → %s", (_name, firstPlanDraft, expected) => {
    const actions = resolveEligibleTripActions(
      context({ firstPlanCompletion: getPlanPublishCompletion(firstPlanDraft) }),
      host
    );

    expect(actions[0]?.actionId).toBe(expected);
  });

  it.each([
    [0, "EDIT_PLAN_BASIC"],
    [1, "PROPOSE_ALTERNATIVE"],
    [2, "COMPARE_PLANS"],
  ] as const)("plan %i개 critical journey의 primary는 %s다", (planCount, expected) => {
    const actions = resolveEligibleTripActions(context({ planCount }), host);
    expect(actions[0]?.actionId).toBe(expected);
  });

  it("route가 미완료면 숙소와 교통 action을 열지 않는다", () => {
    const actions = actionIds(resolveEligibleTripActions(
      context({
        firstPlanCompletion: getPlanPublishCompletion({
          title: "서울",
          baseHeadcount: 2,
        }),
      }),
      host
    ));

    expect(actions).toContain("DEFINE_ROUTE");
    expect(actions).not.toContain("ADD_ACCOMMODATION");
    expect(actions).not.toContain("ADD_TRANSPORT");
  });

  it("member에게 host-only action을 반환하지 않는다", () => {
    const actions = actionIds(resolveEligibleTripActions(
      context({ planCount: 2, memberCount: 1 }),
      member
    ));

    expect(actions).not.toContain("INVITE_MEMBER");
    expect(actions).not.toContain("CONFIRM_PLAN");
  });

  it("confirmed trip은 itinerary 열람만 반환한다", () => {
    const actions = actionIds(resolveEligibleTripActions(
      context({ planCount: 2, isConfirmed: true }),
      host
    ));

    expect(actions).toEqual(["VIEW_ITINERARY"]);
  });

  it("guest에게 member journey action을 반환하지 않는다", () => {
    expect(resolveEligibleTripActions(
      context({ planCount: 2, isConfirmed: true }),
      guest
    )).toEqual([]);

    const actions = actionIds(resolveEligibleTripActions(
      context({ planCount: 2 }),
      guest
    ));
    expect(actions).not.toContain("VIEW_ITINERARY");
    expect(actions).not.toContain("COMPARE_PLANS");
  });

  it.each(["DRAFT", "REVISION"] as const)(
    "%s conflict에서는 recommendation을 억제한다",
    (conflict) => {
      expect(resolveEligibleTripActions(
        context({ planCount: 2, conflict }),
        host
      )).toEqual([]);
    }
  );

  it("first-plan 진행 단계는 후보가 여러 개여도 RULE로 고정한다", () => {
    const decisionContext = context({
      memberCount: 1,
      firstPlanCompletion: getPlanPublishCompletion({
        title: "서울",
        baseHeadcount: 2,
      }),
    });
    const actions = resolveEligibleTripActions(decisionContext, host);

    expect(actions.length).toBeGreaterThanOrEqual(2);
    expect(isAiRankingNeeded(decisionContext, actions)).toBe(false);
  });

  it("등록된 plan 이후의 복수 collaboration action만 AI ranking 대상으로 본다", () => {
    const decisionContext = context({ planCount: 1 });
    const actions = resolveEligibleTripActions(decisionContext, host);

    expect(isAiRankingNeeded(decisionContext, actions)).toBe(true);
  });

  it("eligible action 일부를 누락한 ranking을 거절한다", () => {
    const actions = resolveEligibleTripActions(context({ planCount: 1 }), host);

    expect(applyTripActionRanking(actions, {
      primaryActionId: "PROPOSE_ALTERNATIVE",
      alternativeActionIds: [],
      reasonCode: "ADD_PLAN_ALTERNATIVE",
    })).toBeUndefined();
  });
});

describe("Trip action ranking validation", () => {
  const eligibleActions = resolveEligibleTripActions(context({ planCount: 2 }), host);

  it.each([
    ["누락한 alternative", {
      primaryActionId: "COMPARE_PLANS",
      alternativeActionIds: ["PROPOSE_ALTERNATIVE"],
      reasonCode: "COMPARE_PLAN_OPTIONS",
    }, "MISSING_ACTION"],
    ["비어 있는 alternatives", {
      primaryActionId: "COMPARE_PLANS",
      alternativeActionIds: [],
      reasonCode: "COMPARE_PLAN_OPTIONS",
    }, "MISSING_ACTION"],
    ["반복된 primary", {
      primaryActionId: "COMPARE_PLANS",
      alternativeActionIds: ["COMPARE_PLANS", "GIVE_OPINION"],
      reasonCode: "COMPARE_PLAN_OPTIONS",
    }, "PRIMARY_REPEATED"],
    ["중복 alternative", {
      primaryActionId: "COMPARE_PLANS",
      alternativeActionIds: ["PROPOSE_ALTERNATIVE", "PROPOSE_ALTERNATIVE"],
      reasonCode: "COMPARE_PLAN_OPTIONS",
    }, "DUPLICATE_ALTERNATIVE"],
    ["eligible에 없는 primary", {
      primaryActionId: "INVITE_MEMBER",
      alternativeActionIds: ["PROPOSE_ALTERNATIVE", "GIVE_OPINION"],
      reasonCode: "INVITE_TRAVEL_COMPANION",
    }, "UNKNOWN_ACTION"],
    ["eligible에 없는 alternative", {
      primaryActionId: "COMPARE_PLANS",
      alternativeActionIds: ["PROPOSE_ALTERNATIVE", "INVITE_MEMBER"],
      reasonCode: "COMPARE_PLAN_OPTIONS",
    }, "UNKNOWN_ACTION"],
    ["primary와 다른 reason", {
      primaryActionId: "COMPARE_PLANS",
      alternativeActionIds: ["PROPOSE_ALTERNATIVE", "GIVE_OPINION"],
      reasonCode: "SHARE_PLAN_OPINION",
    }, "REASON_MISMATCH"],
    ["unknown은 중복보다 우선", {
      primaryActionId: "COMPARE_PLANS",
      alternativeActionIds: ["COMPARE_PLANS", "INVITE_MEMBER", "COMPARE_PLANS"],
      reasonCode: "SHARE_PLAN_OPINION",
    }, "UNKNOWN_ACTION"],
    ["primary 반복은 alternative 중복보다 우선", {
      primaryActionId: "COMPARE_PLANS",
      alternativeActionIds: ["COMPARE_PLANS", "PROPOSE_ALTERNATIVE", "PROPOSE_ALTERNATIVE"],
      reasonCode: "SHARE_PLAN_OPINION",
    }, "PRIMARY_REPEATED"],
    ["alternative 중복은 누락과 reason보다 우선", {
      primaryActionId: "COMPARE_PLANS",
      alternativeActionIds: ["PROPOSE_ALTERNATIVE", "PROPOSE_ALTERNATIVE", "PROPOSE_ALTERNATIVE"],
      reasonCode: "SHARE_PLAN_OPINION",
    }, "DUPLICATE_ALTERNATIVE"],
    ["누락은 reason보다 우선", {
      primaryActionId: "COMPARE_PLANS",
      alternativeActionIds: [],
      reasonCode: "SHARE_PLAN_OPINION",
    }, "MISSING_ACTION"],
  ] as const)("%s ranking을 거절한다", (_name, ranking, expected) => {
    expect(validateTripActionRanking(eligibleActions, ranking)).toBe(expected);
    expect(applyTripActionRanking(eligibleActions, ranking)).toBeUndefined();
  });

  it.each([
    ["COMPARE_PLANS", "PROPOSE_ALTERNATIVE", "GIVE_OPINION"],
    ["COMPARE_PLANS", "GIVE_OPINION", "PROPOSE_ALTERNATIVE"],
    ["PROPOSE_ALTERNATIVE", "COMPARE_PLANS", "GIVE_OPINION"],
    ["PROPOSE_ALTERNATIVE", "GIVE_OPINION", "COMPARE_PLANS"],
    ["GIVE_OPINION", "COMPARE_PLANS", "PROPOSE_ALTERNATIVE"],
    ["GIVE_OPINION", "PROPOSE_ALTERNATIVE", "COMPARE_PLANS"],
  ] as const)("%s → %s → %s 순열을 적용한다", (primaryActionId, first, second) => {
    const ranking = {
      primaryActionId,
      alternativeActionIds: [first, second],
      reasonCode: reasonCodeForAction(primaryActionId),
    };

    expect(validateTripActionRanking(eligibleActions, ranking)).toBeUndefined();
    const ranked = applyTripActionRanking(eligibleActions, ranking)!;
    expect(actionIds(ranked)).toEqual([primaryActionId, first, second]);
    for (const action of ranked) {
      expect(action).toBe(eligibleActions.find(({ actionId }) => actionId === action.actionId));
    }
  });

  it("단일 후보와 비어 있는 alternatives를 허용한다", () => {
    const actions = resolveEligibleTripActions(context({ isConfirmed: true }), host);
    const ranking = {
      primaryActionId: "VIEW_ITINERARY",
      alternativeActionIds: [],
      reasonCode: "TRIP_CONFIRMED",
    } as const;

    expect(validateTripActionRanking(actions, ranking)).toBeUndefined();
    expect(applyTripActionRanking(actions, ranking)).toEqual(actions);
  });

  it("후보가 없으면 다른 오류보다 먼저 거절한다", () => {
    const ranking = {
      primaryActionId: "COMPARE_PLANS",
      alternativeActionIds: ["COMPARE_PLANS"],
      reasonCode: "SHARE_PLAN_OPINION",
    } as const;

    expect(validateTripActionRanking([], ranking)).toBe("EMPTY_CANDIDATES");
    expect(applyTripActionRanking([], ranking)).toBeUndefined();
  });
});
