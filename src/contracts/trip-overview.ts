import { Schema } from "effect";
import { TripActionIdSchema } from "../core/domain/trip-action.ts";
import {
  TripActivitySummaryDtoSchema,
} from "./trip-activity.ts";

export const ConfirmedPeriodSchema = Schema.Struct({
  startDate: Schema.String,
  endDate: Schema.String,
});
export type ConfirmedPeriod = typeof ConfirmedPeriodSchema.Type;

export const TripOverviewDtoSchema = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  destination: Schema.String,
  revision: Schema.Number,
  isConfirmed: Schema.Boolean,
  confirmedPeriod: Schema.NullOr(ConfirmedPeriodSchema),
  memberCount: Schema.Number,
  memberNames: Schema.Array(Schema.String),
  candidateCount: Schema.Number,
  opinionParticipantCount: Schema.Number,
  hasUnattributedOpinions: Schema.Boolean,
  createdAt: Schema.String,
  updatedAt: Schema.String,
  eligibleActionIds: Schema.Array(TripActionIdSchema),
  activitySummary: Schema.optional(Schema.NullOr(TripActivitySummaryDtoSchema)),
});
export type TripOverviewDto = typeof TripOverviewDtoSchema.Type;

export const TripOverviewListResponseSchema = Schema.Struct({
  items: Schema.Array(TripOverviewDtoSchema),
});
export type TripOverviewListResponse = typeof TripOverviewListResponseSchema.Type;
