import { Schema } from "effect";
import { DecisionIdSchema } from "./trip-decision.ts";

export const TripActionIdSchema = Schema.Literals([
  "EDIT_PLAN_BASIC",
  "DEFINE_ROUTE",
  "ADD_ACCOMMODATION",
  "ADD_TRANSPORT",
  "PUBLISH_FIRST_PLAN",
  "INVITE_MEMBER",
  "PROPOSE_ALTERNATIVE",
  "GIVE_OPINION",
  "COMPARE_PLANS",
  "CONFIRM_PLAN",
  "VIEW_ITINERARY",
]);
export type TripActionId = typeof TripActionIdSchema.Type;

export const RecommendationReasonSchema = Schema.Literals([
  "COMPLETE_PLAN_IDENTITY",
  "DEFINE_TRAVEL_ROUTE",
  "ADD_ACCOMMODATION_DETAILS",
  "ADD_TRANSPORT_DETAILS",
  "READY_TO_PUBLISH",
  "INVITE_TRAVEL_COMPANION",
  "ADD_PLAN_ALTERNATIVE",
  "SHARE_PLAN_OPINION",
  "COMPARE_PLAN_OPTIONS",
  "READY_TO_CONFIRM",
  "TRIP_CONFIRMED",
]);
export type RecommendationReason = typeof RecommendationReasonSchema.Type;

export const TripActionSchema = Schema.Struct({
  actionId: TripActionIdSchema,
  decisionId: DecisionIdSchema,
  reasonCode: RecommendationReasonSchema,
});
export type TripAction = typeof TripActionSchema.Type;
