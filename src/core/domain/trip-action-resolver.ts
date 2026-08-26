import type { RoomActor } from "./auth-guards.ts";
import type { TripAction, TripActionId } from "./trip-action.ts";
import {
  resolveTripDecisions,
  type DecisionId,
  type TripDecisionContext,
} from "./trip-decision.ts";

const actions = {
  EDIT_PLAN_BASIC: {
    actionId: "EDIT_PLAN_BASIC",
    decisionId: "PLAN_IDENTITY",
    reasonCode: "COMPLETE_PLAN_IDENTITY",
  },
  DEFINE_ROUTE: {
    actionId: "DEFINE_ROUTE",
    decisionId: "TRAVEL_ROUTE",
    reasonCode: "DEFINE_TRAVEL_ROUTE",
  },
  ADD_ACCOMMODATION: {
    actionId: "ADD_ACCOMMODATION",
    decisionId: "ACCOMMODATION",
    reasonCode: "ADD_ACCOMMODATION_DETAILS",
  },
  ADD_TRANSPORT: {
    actionId: "ADD_TRANSPORT",
    decisionId: "TRANSPORT",
    reasonCode: "ADD_TRANSPORT_DETAILS",
  },
  PUBLISH_FIRST_PLAN: {
    actionId: "PUBLISH_FIRST_PLAN",
    decisionId: "PLAN_IDENTITY",
    reasonCode: "READY_TO_PUBLISH",
  },
  INVITE_MEMBER: {
    actionId: "INVITE_MEMBER",
    decisionId: "MEMBERSHIP",
    reasonCode: "INVITE_TRAVEL_COMPANION",
  },
  PROPOSE_ALTERNATIVE: {
    actionId: "PROPOSE_ALTERNATIVE",
    decisionId: "PLAN_SELECTION",
    reasonCode: "ADD_PLAN_ALTERNATIVE",
  },
  GIVE_OPINION: {
    actionId: "GIVE_OPINION",
    decisionId: "PLAN_FEEDBACK",
    reasonCode: "SHARE_PLAN_OPINION",
  },
  COMPARE_PLANS: {
    actionId: "COMPARE_PLANS",
    decisionId: "PLAN_SELECTION",
    reasonCode: "COMPARE_PLAN_OPTIONS",
  },
  CONFIRM_PLAN: {
    actionId: "CONFIRM_PLAN",
    decisionId: "PLAN_SELECTION",
    reasonCode: "READY_TO_CONFIRM",
  },
  VIEW_ITINERARY: {
    actionId: "VIEW_ITINERARY",
    decisionId: "PLAN_SELECTION",
    reasonCode: "TRIP_CONFIRMED",
  },
} as const satisfies Record<TripActionId, TripAction>;

const priority: Record<TripActionId, number> = {
  VIEW_ITINERARY: 0,
  EDIT_PLAN_BASIC: 1,
  DEFINE_ROUTE: 2,
  ADD_ACCOMMODATION: 3,
  ADD_TRANSPORT: 4,
  PUBLISH_FIRST_PLAN: 5,
  COMPARE_PLANS: 6,
  PROPOSE_ALTERNATIVE: 7,
  GIVE_OPINION: 8,
  CONFIRM_PLAN: 9,
  INVITE_MEMBER: 10,
};

export const rankTripActionsDeterministically = (
  eligibleActions: ReadonlyArray<TripAction>
): ReadonlyArray<TripAction> =>
  [...eligibleActions].sort(
    (left, right) => priority[left.actionId] - priority[right.actionId]
  );

export const resolveEligibleTripActions = (
  context: TripDecisionContext,
  actor: RoomActor
): ReadonlyArray<TripAction> => {
  if (context.conflict) return [];
  if (context.isConfirmed) {
    return actor.can("room:view") ? [actions.VIEW_ITINERARY] : [];
  }

  const decisions = new Map<DecisionId, string>(
    resolveTripDecisions(context).map(({ id, status }) => [id, status])
  );
  const eligible: TripAction[] = [];

  if (actor.can("plan:create")) {
    if (context.firstPlanDraft) {
      if (decisions.get("PLAN_IDENTITY") === "INCOMPLETE") {
        eligible.push(actions.EDIT_PLAN_BASIC);
      }
      if (decisions.get("TRAVEL_ROUTE") === "INCOMPLETE") {
        eligible.push(actions.DEFINE_ROUTE);
      }
      if (decisions.get("ACCOMMODATION") === "INCOMPLETE") {
        eligible.push(actions.ADD_ACCOMMODATION);
      }
      if (decisions.get("TRANSPORT") === "INCOMPLETE") {
        eligible.push(actions.ADD_TRANSPORT);
      }
      if (["PLAN_IDENTITY", "TRAVEL_ROUTE", "ACCOMMODATION", "TRANSPORT"].every(
        (id) => decisions.get(id as DecisionId) === "COMPLETE"
      )) {
        eligible.push(actions.PUBLISH_FIRST_PLAN);
      }
    } else if (context.planCount === 0) {
      eligible.push(actions.EDIT_PLAN_BASIC);
    } else {
      eligible.push(actions.PROPOSE_ALTERNATIVE);
    }
  }

  if (actor.isHost && decisions.get("MEMBERSHIP") === "INCOMPLETE") {
    eligible.push(actions.INVITE_MEMBER);
  }
  if (
    actor.can("opinion:submit") &&
    context.planCount > 0 &&
    !context.actorHasOpinion
  ) {
    eligible.push(actions.GIVE_OPINION);
  }
  if (actor.can("room:view") && context.planCount >= 2) {
    eligible.push(actions.COMPARE_PLANS);
  }
  if (actor.isHost && context.planCount >= 2) {
    eligible.push(actions.CONFIRM_PLAN);
  }

  return rankTripActionsDeterministically(eligible);
};
