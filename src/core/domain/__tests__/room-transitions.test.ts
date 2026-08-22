import { describe, expect, it } from "vitest";
import {
  PlanIdSchema,
  RevisionSchema,
  TripIdSchema,
  UserIdSchema,
} from "../ids.ts";
import type { TripRoom } from "../room.ts";
import {
  confirmPlanInRoom,
  deletePlanFromRoom,
  joinRoomMember,
  setPlanOpinionInRoom,
} from "../room-transitions.ts";

const hostId = UserIdSchema.make("host-1");
const memberId = UserIdSchema.make("member-1");
const planId = PlanIdSchema.make("plan-1");

const room: TripRoom = {
  id: TripIdSchema.make("room-1"),
  title: "제주 여행",
  destination: "제주",
  revision: RevisionSchema.make(7),
  members: [{ id: hostId, name: "방장", role: "HOST" }],
  plans: [
    {
      id: planId,
      title: "기본안",
      status: "DRAFT",
      places: [],
      voteCount: 1,
      memberOpinions: [
        { userId: memberId, userName: "멤버", reaction: "LIKE" },
        { userId: memberId, userName: "멤버", reaction: "OKAY" },
        { userId: hostId, userName: "방장", reaction: "LIKE" },
      ],
    },
  ],
  confirmedPlanId: planId,
};

describe("TripRoom domain transitions", () => {
  it("deletes a plan and clears its confirmation without changing revision", () => {
    const updated = deletePlanFromRoom(room, room.plans[0]);

    expect(updated.plans).toEqual([]);
    expect(updated.confirmedPlanId).toBeUndefined();
    expect(updated.revision).toBe(room.revision);
  });

  it("confirms the selected plan without changing revision", () => {
    const draftRoom = { ...room, confirmedPlanId: undefined };
    const updated = confirmPlanInRoom(draftRoom, draftRoom.plans[0]);

    expect(updated.confirmedPlanId).toBe(planId);
    expect(updated.plans[0].status).toBe("CONFIRMED");
    expect(updated.revision).toBe(room.revision);
  });

  it("upserts one opinion per member and recalculates likes", () => {
    const updated = setPlanOpinionInRoom(room, room.plans[0], {
      userId: memberId,
      userName: "멤버",
      reaction: "HARD",
      reason: "이동이 길어요",
    });

    expect(updated.plans[0].memberOpinions).toEqual([
      { userId: hostId, userName: "방장", reaction: "LIKE" },
      {
        userId: memberId,
        userName: "멤버",
        reaction: "HARD",
        reason: "이동이 길어요",
      },
    ]);
    expect(updated.plans[0].voteCount).toBe(1);
  });

  it("joins once and returns the same aggregate for an existing member", () => {
    const member = { id: memberId, name: "멤버", role: "MEMBER" as const };
    const joined = joinRoomMember(room, member);

    expect(joined.members).toContainEqual(member);
    expect(joinRoomMember(joined, member)).toBe(joined);
  });
});
