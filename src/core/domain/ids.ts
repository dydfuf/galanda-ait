import { Schema } from "effect";

export const TripIdSchema = Schema.String.pipe(Schema.brand("TripId"));
export type TripId = typeof TripIdSchema.Type;

export const PlanIdSchema = Schema.String.pipe(Schema.brand("PlanId"));
export type PlanId = typeof PlanIdSchema.Type;

export const UserIdSchema = Schema.String.pipe(Schema.brand("UserId"));
export type UserId = typeof UserIdSchema.Type;

export const RevisionSchema = Schema.Number.pipe(Schema.brand("Revision"));
export type Revision = typeof RevisionSchema.Type;

export const InviteTokenSchema = Schema.String.pipe(Schema.brand("InviteToken"));
export type InviteToken = typeof InviteTokenSchema.Type;

