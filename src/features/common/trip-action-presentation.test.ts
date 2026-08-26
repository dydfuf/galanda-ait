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
    const roomAction = resolveEligibleTripActions(
      toTripRoomDecisionContext(twoPlanRoom, actor),
      actor,
    )[0];

    expect(roomAction?.actionId).toBe("COMPARE_PLANS");
    expect(tripActionPresentation[roomAction!.actionId].route(room.id)).toBe(
      "/trips/trip-1/plans",
    );
    expect(tripActionPresentation[roomAction!.actionId].reason).toBeTruthy();
  });
});
