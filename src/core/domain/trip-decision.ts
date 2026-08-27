import { Schema } from "effect";
import {
  isRoomConfirmed,
  type RoomActor,
} from "./auth-guards.ts";
import { isPlanConfirmable } from "./confirmed-itinerary.ts";
import {
  type PlanPublishCompletion,
  type TripRoom,
} from "./room.ts";

export const DecisionIdSchema = Schema.Literals([
  "PLAN_IDENTITY",
  "TRAVEL_ROUTE",
  "ACCOMMODATION",
  "TRANSPORT",
  "MEMBERSHIP",
  "PLAN_FEEDBACK",
  "PLAN_SELECTION",
]);
export type DecisionId = typeof DecisionIdSchema.Type;

export const TripDecisionStatusSchema = Schema.Literals([
  "BLOCKED",
  "INCOMPLETE",
  "COMPLETE",
]);
export type TripDecisionStatus = typeof TripDecisionStatusSchema.Type;

export const TripDecisionSchema = Schema.Struct({
  id: DecisionIdSchema,
  status: TripDecisionStatusSchema,
});
export type TripDecision = typeof TripDecisionSchema.Type;

export const TripRecommendationConflictSchema = Schema.Literals([
  "DRAFT",
  "REVISION",
]);
export type TripRecommendationConflict =
  typeof TripRecommendationConflictSchema.Type;

export interface TripDecisionContext {
  readonly planCount: number;
  readonly memberCount: number;
  readonly opinionParticipantCount: number;
  readonly actorHasOpinion: boolean;
  readonly isConfirmed: boolean;
  readonly confirmablePlanCount: number;
  readonly conflict?: TripRecommendationConflict;
  readonly firstPlanCompletion?: PlanPublishCompletion;
}

export const toTripRoomDecisionContext = (
  room: TripRoom,
  actor: RoomActor,
): TripDecisionContext => {
  const opinionParticipantIds = new Set(
    room.plans.flatMap((plan) =>
      (plan.memberOpinions ?? []).map(({ userId }) => userId)
    )
  );

  return {
    planCount: room.plans.length,
    memberCount: room.members.length,
    opinionParticipantCount: opinionParticipantIds.size,
    actorHasOpinion: actor.member
      ? opinionParticipantIds.has(actor.member.id)
      : false,
    isConfirmed: isRoomConfirmed(room),
    confirmablePlanCount: room.plans.filter((plan) =>
      isPlanConfirmable(room, plan)
    ).length,
  };
};

export const toFirstPlanDecisionContext = (
  room: TripRoom,
  actor: RoomActor,
  firstPlanCompletion?: PlanPublishCompletion,
  conflict?: TripRecommendationConflict,
): TripDecisionContext => ({
  ...toTripRoomDecisionContext(room, actor),
  firstPlanCompletion,
  conflict,
});

export const resolveTripDecisions = (
  context: TripDecisionContext
): ReadonlyArray<TripDecision> => {
  if (context.conflict) {
    return DecisionIdSchema.literals.map((id) => ({ id, status: "BLOCKED" }));
  }

  const completion = context.firstPlanCompletion
    ? context.firstPlanCompletion
    : {
        basic: context.planCount > 0,
        route: context.planCount > 0,
        accommodation: context.planCount > 0,
        transport: context.planCount > 0,
      };
  const feedbackComplete =
    context.memberCount > 0 &&
    context.opinionParticipantCount >= context.memberCount;

  return [
    {
      id: "PLAN_IDENTITY",
      status: completion.basic ? "COMPLETE" : "INCOMPLETE",
    },
    {
      id: "TRAVEL_ROUTE",
      status: !completion.basic
        ? "BLOCKED"
        : completion.route
          ? "COMPLETE"
          : "INCOMPLETE",
    },
    {
      id: "ACCOMMODATION",
      status: !completion.route
        ? "BLOCKED"
        : completion.accommodation
          ? "COMPLETE"
          : "INCOMPLETE",
    },
    {
      id: "TRANSPORT",
      status: !completion.route
        ? "BLOCKED"
        : completion.transport
          ? "COMPLETE"
          : "INCOMPLETE",
    },
    {
      id: "MEMBERSHIP",
      status: context.memberCount >= 2 ? "COMPLETE" : "INCOMPLETE",
    },
    {
      id: "PLAN_FEEDBACK",
      status: context.planCount === 0
        ? "BLOCKED"
        : feedbackComplete
          ? "COMPLETE"
          : "INCOMPLETE",
    },
    {
      id: "PLAN_SELECTION",
      status: context.isConfirmed
        ? "COMPLETE"
        : context.planCount >= 2
          ? "INCOMPLETE"
          : "BLOCKED",
    },
  ];
};
