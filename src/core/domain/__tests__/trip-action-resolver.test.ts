import { describe, expect, it } from "vitest";
import { getRoomActor } from "../auth-guards.ts";
import {
  PlanIdSchema,
  RevisionSchema,
  TripIdSchema,
  UserIdSchema,
} from "../ids.ts";
import type { PlanPublishInput, TripRoom } from "../room.ts";
import { resolveEligibleTripActions } from "../trip-action-resolver.ts";
import type { TripDecisionContext } from "../trip-decision.ts";

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
  ...overrides,
});

const actionIds = (
  value: ReturnType<typeof resolveEligibleTripActions>
) => value.map(({ actionId }) => actionId);

describe("deterministic Trip action resolver", () => {
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
      context({ firstPlanDraft }),
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
      context({ firstPlanDraft: { title: "서울", baseHeadcount: 2 } }),
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
});
