import type {
  PlanMemberOpinion,
  TripMember,
  TripPlan,
  TripRoom,
} from "./room.ts";

const replacePlan = (
  room: TripRoom,
  plan: TripPlan
): ReadonlyArray<TripPlan> =>
  room.plans.map((candidate) => (candidate.id === plan.id ? plan : candidate));

export const deletePlanFromRoom = (
  room: TripRoom,
  plan: TripPlan
): TripRoom => ({
  ...room,
  plans: room.plans.filter((candidate) => candidate.id !== plan.id),
  confirmedPlanId:
    room.confirmedPlanId === plan.id ? undefined : room.confirmedPlanId,
});

export const confirmPlanInRoom = (
  room: TripRoom,
  plan: TripPlan
): TripRoom => ({
  ...room,
  plans: replacePlan(room, { ...plan, status: "CONFIRMED" }),
  confirmedPlanId: plan.id,
});

export const setPlanOpinionInRoom = (
  room: TripRoom,
  plan: TripPlan,
  opinion: PlanMemberOpinion
): TripRoom => {
  const memberOpinions = [
    ...(plan.memberOpinions ?? []).filter(
      (existing) => existing.userId !== opinion.userId
    ),
    opinion,
  ];

  return {
    ...room,
    plans: replacePlan(room, {
      ...plan,
      memberOpinions,
      voteCount: memberOpinions.filter(({ reaction }) => reaction === "LIKE")
        .length,
    }),
  };
};

export const joinRoomMember = (
  room: TripRoom,
  member: TripMember
): TripRoom =>
  room.members.some((existing) => existing.id === member.id)
    ? room
    : { ...room, members: [...room.members, member] };
