import type {
  PlanMemberOpinion,
  TripMember,
  TripPlan,
  TripRoom,
} from "./room.ts";
import type { ParticipantId } from "./ids.ts";

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

/** Alias로 남은 동일 참여자를 현재 canonical participant 하나로 합쳐요. */
export const mergeParticipantIdentityInRoom = (
  room: TripRoom,
  participantId: ParticipantId,
  participantIds: ReadonlyArray<ParticipantId>
): TripRoom => {
  const aliases = new Set(participantIds);
  const hasAliasData = participantIds.some(
    (alias) =>
      alias !== participantId &&
      (room.members.some(({ id }) => id === alias) ||
        room.plans.some(
          (plan) =>
            plan.authorId === alias ||
            plan.memberOpinions?.some(({ userId }) => userId === alias)
        ))
  );
  if (!hasAliasData) return room;

  const matchingMembers = room.members.filter(({ id }) => aliases.has(id));
  const canonicalMember =
    matchingMembers.find(({ id }) => id === participantId) ?? matchingMembers[0];
  const mergedMember = canonicalMember
    ? {
        ...canonicalMember,
        id: participantId,
        role: matchingMembers.some(({ role }) => role === "HOST")
          ? ("HOST" as const)
          : ("MEMBER" as const),
      }
    : undefined;

  const members = mergedMember
    ? [
        ...room.members.filter(({ id }) => !aliases.has(id)),
        mergedMember,
      ]
    : room.members;
  const plans = room.plans.map((plan) => {
    const matchingOpinions = (plan.memberOpinions ?? []).filter(({ userId }) =>
      aliases.has(userId)
    );
    const canonicalOpinion =
      matchingOpinions.find(({ userId }) => userId === participantId) ??
      matchingOpinions.at(-1);
    const memberOpinions = canonicalOpinion
      ? [
          ...(plan.memberOpinions ?? []).filter(
            ({ userId }) => !aliases.has(userId)
          ),
          {
            ...canonicalOpinion,
            userId: participantId,
            userName: mergedMember?.name ?? canonicalOpinion.userName,
          },
        ]
      : plan.memberOpinions;

    return {
      ...plan,
      authorId:
        plan.authorId && aliases.has(plan.authorId)
          ? participantId
          : plan.authorId,
      authorName:
        plan.authorId && aliases.has(plan.authorId) && mergedMember
          ? mergedMember.name
          : plan.authorName,
      memberOpinions,
      voteCount:
        memberOpinions?.filter(({ reaction }) => reaction === "LIKE").length ??
        plan.voteCount,
    };
  });

  return { ...room, members, plans };
};
