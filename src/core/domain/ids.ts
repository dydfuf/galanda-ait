import { Schema } from "effect";

export const TripIdSchema = Schema.String.pipe(Schema.brand("TripId"));
export type TripId = typeof TripIdSchema.Type;

export const PlanIdSchema = Schema.String.pipe(Schema.brand("PlanId"));
export type PlanId = typeof PlanIdSchema.Type;

export const ItineraryIdSchema = Schema.String.pipe(
  Schema.brand("ItineraryId")
);
export type ItineraryId = typeof ItineraryIdSchema.Type;

/** Explore 공개 listing 식별자. private PlanId와 별도의 branded ID다. */
export const ExploreListingIdSchema = Schema.String.pipe(
  Schema.brand("ExploreListingId")
);
export type ExploreListingId = typeof ExploreListingIdSchema.Type;

export const RecommendationIdSchema = Schema.String.pipe(
  Schema.brand("RecommendationId")
);
export type RecommendationId = typeof RecommendationIdSchema.Type;

export const ParticipantIdSchema = Schema.String.pipe(
  Schema.brand("ParticipantId")
);
export type ParticipantId = typeof ParticipantIdSchema.Type;

/** @deprecated Domain ownership now uses ParticipantId. */
export const UserIdSchema = ParticipantIdSchema;
/** @deprecated Domain ownership now uses ParticipantId. */
export type UserId = ParticipantId;

export const RevisionSchema = Schema.Number.pipe(Schema.brand("Revision"));
export type Revision = typeof RevisionSchema.Type;

export const InviteTokenSchema = Schema.String.check(Schema.isUUID(4)).pipe(
  Schema.brand("InviteToken")
);
export type InviteToken = typeof InviteTokenSchema.Type;
