import { describe, expect, it } from "vitest";
import { getRoomActor } from "../../core/domain/auth-guards.ts";
import { PlanIdSchema, RevisionSchema, TripIdSchema, UserIdSchema } from "../../core/domain/ids.ts";
import { resolveEligibleTripActions } from "../../core/domain/trip-action-resolver.ts";
import type { TripRoom } from "../../core/domain/room.ts";
import {
  toFirstPlanDecisionContext,
  toTripRoomDecisionContext,
  tripActionPresentation,
} from "./trip-action-presentation.ts";

const room: TripRoom = {
  id: TripIdSchema.make("trip-1"),
  title: "도쿄 여행",
  destination: "도쿄",
  revision: RevisionSchema.make(1),
  members: [{ id: UserIdSchema.make("host-1"), name: "호스트", role: "HOST" }],
  plans: [],
};

describe("trip action journey adapter (RAON-236)", () => {
  it("first-plan draft와 Trip Room을 같은 NBA action taxonomy로 연결한다", () => {
    const actor = getRoomActor(room, UserIdSchema.make("host-1"));
    const firstPlanAction = resolveEligibleTripActions(
      toFirstPlanDecisionContext(room, actor, {
        title: "첫 여행안",
        baseHeadcount: 1,
        routes: [],
        accommodations: [],
        transports: [],
      }),
      actor,
    )[0];

    expect(firstPlanAction?.actionId).toBe("DEFINE_ROUTE");
    expect(tripActionPresentation[firstPlanAction!.actionId]).toMatchObject({
      section: "route",
      label: "여행 경로 정하기",
    });

    const twoPlanRoom: TripRoom = {
      ...room,
      plans: ["plan-1", "plan-2"].map((id) => ({
        id: PlanIdSchema.make(id),
        title: id,
        status: "DRAFT" as const,
        places: [],
        voteCount: 0,
      })),
    };
    const roomActions = resolveEligibleTripActions(
      toTripRoomDecisionContext(twoPlanRoom, actor),
      actor,
    );
    const roomAction = roomActions[0];

    expect(roomAction?.actionId).toBe("COMPARE_PLANS");
    expect(roomActions).not.toContainEqual(
      expect.objectContaining({ actionId: "CONFIRM_PLAN" }),
    );
    expect(tripActionPresentation[roomAction!.actionId].route(room.id)).toBe(
      "/trips/trip-1/plans",
    );
    expect(tripActionPresentation[roomAction!.actionId].reason).toBeTruthy();
  });

  it.each([
    ["DRAFT", RevisionSchema.make(1), false],
    ["VOTING", undefined, false],
    ["VOTING", RevisionSchema.make(1), true],
  ] as const)("HOST에게 %s/revision=%s plan의 confirm eligibility를 정확히 반영한다", (status, revision, expected) => {
    const plans = ["plan-1", "plan-2"].map((id) => ({
      id: PlanIdSchema.make(id),
      title: id,
      status: status as "DRAFT" | "VOTING",
      revision,
      baseHeadcount: 1,
      routes: [{ city: "도쿄", arrivalDate: "2026-09-01", departureDate: "2026-09-03" }],
      accommodations: [{ id: `${id}-stay`, city: "도쿄", period: "2박", nights: 2, hotelName: "", isSearching: true, bookingStatus: "NOT_CHECKED" as const }],
      transports: [
        { id: `${id}-out`, fromCity: "서울", toCity: "도쿄", mode: "", hasTransfer: false, durationText: "", bookingStatus: "NOT_CHECKED" as const },
        { id: `${id}-back`, fromCity: "도쿄", toCity: "서울", mode: "", hasTransfer: false, durationText: "", bookingStatus: "NOT_CHECKED" as const },
      ],
      places: [],
      voteCount: 0,
    }));
    const targetRoom: TripRoom = { ...room, plans };
    const actor = getRoomActor(targetRoom, UserIdSchema.make("host-1"));
    const actions = resolveEligibleTripActions(
      toTripRoomDecisionContext(targetRoom, actor),
      actor,
    );

    expect(actions.some(({ actionId }) => actionId === "CONFIRM_PLAN")).toBe(expected);
  });
});
