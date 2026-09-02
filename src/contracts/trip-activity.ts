import { Schema } from "effect";
import {
  TripActivityTypeSchema,
  type TripActivityType,
} from "../core/domain/trip-activity.ts";

export type { TripActivityType };

export const MAX_ACTIVITY_SEQUENCE = 9_223_372_036_854_775_807n;

export const ActivitySequenceSchema = Schema.String.check(
  Schema.makeFilter(
    (s: string) => {
      if (!/^[1-9]\d*$/.test(s)) return false;
      try {
        const val = BigInt(s);
        return val >= 1n && val <= MAX_ACTIVITY_SEQUENCE;
      } catch {
        return false;
      }
    },
    {
      message: "1 이상 9223372036854775807 이하의 양의 정수 문자열이어야 합니다.",
    }
  )
);
export type ActivitySequence = typeof ActivitySequenceSchema.Type;

export const TripActivityTargetDtoSchema = Schema.Union([
  Schema.Struct({
    type: Schema.Literal("PLAN"),
    path: Schema.String,
    planId: Schema.String,
  }),
  Schema.Struct({
    type: Schema.Literal("PLAN_COMPARE"),
    path: Schema.String,
  }),
  Schema.Struct({
    type: Schema.Literal("ITINERARY"),
    path: Schema.String,
  }),
  Schema.Struct({
    type: Schema.Literal("PLAN_HOME"),
    path: Schema.String,
  }),
]);
export type TripActivityTargetDto = typeof TripActivityTargetDtoSchema.Type;

export const TripActivityEventDtoSchema = Schema.Struct({
  sequence: ActivitySequenceSchema,
  tripId: Schema.String,
  type: TripActivityTypeSchema,
  actorParticipantId: Schema.String,
  actorDisplayName: Schema.NullOr(Schema.String),
  isOwn: Schema.Boolean,
  subjectPlanId: Schema.NullOr(Schema.String),
  subjectTitle: Schema.NullOr(Schema.String),
  roomRevision: Schema.NullOr(Schema.Number),
  itineraryRevision: Schema.NullOr(Schema.Number),
  target: Schema.optional(Schema.NullOr(TripActivityTargetDtoSchema)),
  createdAt: Schema.String,
});
export type TripActivityEventDto = typeof TripActivityEventDtoSchema.Type;

export const LatestUnreadActivitySummaryDtoSchema = Schema.Struct({
  type: TripActivityTypeSchema,
  actorDisplayName: Schema.NullOr(Schema.String),
  subjectTitle: Schema.NullOr(Schema.String),
  createdAt: Schema.String,
});
export type LatestUnreadActivitySummaryDto =
  typeof LatestUnreadActivitySummaryDtoSchema.Type;

export const TripActivitySummaryDtoSchema = Schema.Struct({
  tripId: Schema.String,
  unreadCount: Schema.Number,
  latestUnreadSummary: Schema.NullOr(LatestUnreadActivitySummaryDtoSchema),
  lastSeenSequence: Schema.NullOr(ActivitySequenceSchema),
});
export type TripActivitySummaryDto = typeof TripActivitySummaryDtoSchema.Type;

export const TripActivityQuerySchema = Schema.Struct({
  beforeSequence: Schema.optional(ActivitySequenceSchema),
  limit: Schema.optional(Schema.NumberFromString),
});
export type TripActivityQuery = typeof TripActivityQuerySchema.Type;

export const TripActivityPageResponseSchema = Schema.Struct({
  items: Schema.Array(TripActivityEventDtoSchema),
  hasMore: Schema.Boolean,
  nextBeforeSequence: Schema.NullOr(ActivitySequenceSchema),
  latestSequence: Schema.NullOr(ActivitySequenceSchema),
  lastSeenSequence: Schema.NullOr(ActivitySequenceSchema),
  unreadCount: Schema.Number,
});
export type TripActivityPageResponse =
  typeof TripActivityPageResponseSchema.Type;

export const MarkTripActivityReadRequestSchema = Schema.Struct({
  throughSequence: ActivitySequenceSchema,
});
export type MarkTripActivityReadRequest =
  typeof MarkTripActivityReadRequestSchema.Type;

