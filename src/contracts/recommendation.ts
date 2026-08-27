import { Schema } from "effect";
import {
  RecommendationReasonSchema,
  RecommendationSourceSchema,
  RecommendationSurfaceSchema,
  TripActionIdSchema,
} from "../core/domain/trip-action.ts";
import { RecommendationIdSchema } from "../core/domain/ids.ts";
import { PlanPublishCompletionSchema } from "../core/domain/room.ts";
import { TripRecommendationConflictSchema } from "../core/domain/trip-decision.ts";

export const DraftRecommendationSnapshotSchema = Schema.Struct({
  ...PlanPublishCompletionSchema.fields,
  conflict: Schema.optional(TripRecommendationConflictSchema),
});
export type DraftRecommendationSnapshot =
  typeof DraftRecommendationSnapshotSchema.Type;

export const RecommendNextActionRequestSchema = Schema.Struct({
  surface: RecommendationSurfaceSchema,
  draft: Schema.optional(DraftRecommendationSnapshotSchema),
});
export type RecommendNextActionRequest =
  typeof RecommendNextActionRequestSchema.Type;

export const RecommendNextActionResponseSchema = Schema.Struct({
  recommendationId: RecommendationIdSchema,
  primary: Schema.Struct({
    actionId: TripActionIdSchema,
    reasonCode: RecommendationReasonSchema,
  }),
  alternatives: Schema.Array(
    Schema.Struct({ actionId: TripActionIdSchema })
  ),
  source: RecommendationSourceSchema,
  contextFingerprint: Schema.String,
});
export type RecommendNextActionResponse =
  typeof RecommendNextActionResponseSchema.Type;
