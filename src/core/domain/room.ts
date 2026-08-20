import { Schema } from "effect";
import { PlanIdSchema, RevisionSchema, TripIdSchema, UserIdSchema } from "./ids.ts";

export const PlanStatusSchema = Schema.Literals(["DRAFT", "VOTING", "CONFIRMED"]);
export type PlanStatus = typeof PlanStatusSchema.Type;

export const BookingStatusSchema = Schema.Literals(["AVAILABLE", "NEED_CHECK", "FULL", "NOT_CHECKED"]);
export type BookingStatus = typeof BookingStatusSchema.Type;

export const PriceRangeSchema = Schema.Struct({
  min: Schema.Number,
  max: Schema.Number,
});
export type PriceRange = typeof PriceRangeSchema.Type;

export const CityStaySchema = Schema.Struct({
  city: Schema.String,
  nights: Schema.Number,
});
export type CityStay = typeof CityStaySchema.Type;

export const AccommodationSnapshotSchema = Schema.Struct({
  id: Schema.String,
  city: Schema.String,
  period: Schema.String,
  nights: Schema.Number,
  hotelName: Schema.String,
  isSearching: Schema.optional(Schema.Boolean),
  bookingStatus: BookingStatusSchema,
  priceRange: Schema.optional(PriceRangeSchema),
  bookingUrl: Schema.optional(Schema.String),
  confirmedBy: Schema.optional(Schema.String),
  confirmedAt: Schema.optional(Schema.String),
});
export type AccommodationSnapshot = typeof AccommodationSnapshotSchema.Type;

export const TransportSnapshotSchema = Schema.Struct({
  id: Schema.String,
  fromCity: Schema.String,
  toCity: Schema.String,
  mode: Schema.String,
  hasTransfer: Schema.Boolean,
  durationText: Schema.String,
  bookingStatus: BookingStatusSchema,
  priceRange: Schema.optional(PriceRangeSchema),
  bookingUrl: Schema.optional(Schema.String),
  confirmedBy: Schema.optional(Schema.String),
  confirmedAt: Schema.optional(Schema.String),
});
export type TransportSnapshot = typeof TransportSnapshotSchema.Type;

export const PlanMemberOpinionSchema = Schema.Struct({
  userId: UserIdSchema,
  userName: Schema.String,
  reaction: Schema.Literals(["LIKE", "OKAY", "HARD"]),
  reason: Schema.optional(Schema.String),
});
export type PlanMemberOpinion = typeof PlanMemberOpinionSchema.Type;
/** 공개 응답에 포함해도 되는 의견 정보. HARD 사유는 작성자 전용 데이터다. */
export type PublicPlanMemberOpinion = Omit<PlanMemberOpinion, "reason">;

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
  proposalReason: Schema.optional(Schema.String),
  authorId: Schema.optional(UserIdSchema),
  authorName: Schema.optional(Schema.String),
  baseHeadcount: Schema.optional(Schema.Number),
  routes: Schema.optional(Schema.Array(CityStaySchema)),
  accommodations: Schema.optional(Schema.Array(AccommodationSnapshotSchema)),
  transports: Schema.optional(Schema.Array(TransportSnapshotSchema)),
  places: Schema.Array(TripPlaceSchema),
  clonedFromPlanId: Schema.optional(PlanIdSchema),
  differenceSummary: Schema.optional(Schema.String),
  memberOpinions: Schema.optional(Schema.Array(PlanMemberOpinionSchema)),
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
