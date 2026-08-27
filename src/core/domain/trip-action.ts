import { Schema } from "effect";
import { RecommendationIdSchema } from "./ids.ts";
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

export const RecommendationSurfaceSchema = Schema.Literals([
  "FIRST_PLAN",
  "PLAN_HOME",
  "PLAN_DETAIL",
]);
export type RecommendationSurface = typeof RecommendationSurfaceSchema.Type;

export const RecommendationSourceSchema = Schema.Literals(["RULE", "AI"]);
export type RecommendationSource = typeof RecommendationSourceSchema.Type;

export const RecommendationLifecycleEventNameSchema = Schema.Literals([
  "nba_impression",
  "nba_accept",
  "nba_alternative_selected",
  "nba_skip",
  "nba_action_completed",
]);
export type RecommendationLifecycleEventName =
  typeof RecommendationLifecycleEventNameSchema.Type;

export const NBA_RULE_POLICY_VERSION = "nba-rule-v1";

export const RecommendationLifecycleEventSchema = Schema.Struct({
  eventName: RecommendationLifecycleEventNameSchema,
  recommendationId: RecommendationIdSchema,
  source: RecommendationSourceSchema,
  actionId: TripActionIdSchema,
  reasonCode: RecommendationReasonSchema,
  surface: RecommendationSurfaceSchema,
  policyVersion: Schema.String,
  contextFingerprint: Schema.String,
});
export type RecommendationLifecycleEvent =
  typeof RecommendationLifecycleEventSchema.Type;

export const TripActionSchema = Schema.Struct({
  actionId: TripActionIdSchema,
  decisionId: DecisionIdSchema,
  reasonCode: RecommendationReasonSchema,
});
export type TripAction = typeof TripActionSchema.Type;
