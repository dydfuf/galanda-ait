import { Schema } from "effect";
import { InviteTokenSchema } from "./ids.ts";
import { TravelDateSchema } from "./room.ts";

export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1_000;

export const IssuedInviteSchema = Schema.Struct({
  token: InviteTokenSchema,
  expiresAt: Schema.String,
});
export type IssuedInvite = typeof IssuedInviteSchema.Type;

/** Login-free allowlist. Internal IDs and member/plan details never cross this boundary. */
export const PublicInviteSummarySchema = Schema.Struct({
  title: Schema.String,
  inviterName: Schema.String,
  participantCount: Schema.Number,
  destination: Schema.optional(Schema.String),
  startDate: Schema.optional(TravelDateSchema),
  endDate: Schema.optional(TravelDateSchema),
  alreadyJoined: Schema.Boolean,
});
export type PublicInviteSummary = typeof PublicInviteSummarySchema.Type;
