import { Schema } from "effect";
import { PlanIdSchema, RevisionSchema, TripIdSchema, UserIdSchema } from "./ids.ts";

export const PlanStatusSchema = Schema.Literals(["DRAFT", "VOTING", "CONFIRMED"]);
export type PlanStatus = typeof PlanStatusSchema.Type;

export const TripPlaceSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  category: Schema.String,
  address: Schema.String,
  latitude: Schema.optional(Schema.Number),
  longitude: Schema.optional(Schema.Number),
});
export type TripPlace = typeof TripPlaceSchema.Type;

export const TripPlanSchema = Schema.Struct({
  id: PlanIdSchema,
  title: Schema.String,
  status: PlanStatusSchema,
  places: Schema.Array(TripPlaceSchema),
  voteCount: Schema.Number,
});
export type TripPlan = typeof TripPlanSchema.Type;

export const TripMemberSchema = Schema.Struct({
  id: UserIdSchema,
  name: Schema.String,
  role: Schema.Literals(["HOST", "MEMBER"]),
});
export type TripMember = typeof TripMemberSchema.Type;

export const TripRoomSchema = Schema.Struct({
  id: TripIdSchema,
  title: Schema.String,
  destination: Schema.String,
  startDate: Schema.String,
  endDate: Schema.String,
  revision: RevisionSchema,
  members: Schema.Array(TripMemberSchema),
  plans: Schema.Array(TripPlanSchema),
  confirmedPlanId: Schema.optional(PlanIdSchema),
});
export type TripRoom = typeof TripRoomSchema.Type;

export const UserSessionSchema = Schema.Struct({
  userId: UserIdSchema,
  name: Schema.String,
  isAuthenticated: Schema.Boolean,
});
export type UserSession = typeof UserSessionSchema.Type;
