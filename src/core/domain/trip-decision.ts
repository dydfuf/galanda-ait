import { Schema } from "effect";
import {
  getPlanPublishCompletion,
  type PlanPublishInput,
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
  readonly conflict?: TripRecommendationConflict;
  readonly firstPlanDraft?: PlanPublishInput;
}

export const resolveTripDecisions = (
  context: TripDecisionContext
): ReadonlyArray<TripDecision> => {
  if (context.conflict) {
    return DecisionIdSchema.literals.map((id) => ({ id, status: "BLOCKED" }));
  }

  const completion = context.firstPlanDraft
    ? getPlanPublishCompletion(context.firstPlanDraft)
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
