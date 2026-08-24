import { Schema } from "effect";
import {
  ConfirmedItinerarySnapshotSchema,
  ItineraryAcknowledgementSchema,
  ItineraryChangeSchema,
  IsoDateTimeSchema,
} from "../core/domain/confirmed-itinerary.ts";
import {
  ItineraryIdSchema,
  ParticipantIdSchema,
  PlanIdSchema,
  RevisionSchema,
  TripIdSchema,
} from "../core/domain/ids.ts";

export const ConfirmedItineraryResponseSchema = Schema.Struct({
  id: ItineraryIdSchema,
  tripId: TripIdSchema,
  sourcePlanId: PlanIdSchema,
  sourcePlanRevision: RevisionSchema,
  currentRevision: RevisionSchema,
  snapshot: ConfirmedItinerarySnapshotSchema,
  createdBy: ParticipantIdSchema,
  createdAt: IsoDateTimeSchema,
  changedBy: Schema.optional(ParticipantIdSchema),
  changedAt: Schema.optional(IsoDateTimeSchema),
  changes: Schema.optional(Schema.Array(ItineraryChangeSchema)),
});
export type ConfirmedItineraryResponse = typeof ConfirmedItineraryResponseSchema.Type;

export const ItineraryStateResponseSchema = Schema.Union([
  Schema.Struct({
    status: Schema.Literal("CONFIRMED"),
    itinerary: ConfirmedItineraryResponseSchema,
    canEdit: Schema.Boolean,
    acknowledgements: Schema.Array(ItineraryAcknowledgementSchema),
    viewerAcknowledgedRevision: Schema.optional(RevisionSchema),
    unacknowledgedCount: Schema.Number,
  }),
  Schema.Struct({ status: Schema.Literal("UNCONFIRMED") }),
  Schema.Struct({ status: Schema.Literal("MISSING") }),
]);
export type ItineraryStateResponse = typeof ItineraryStateResponseSchema.Type;

export const ConfirmItineraryResultSchema = Schema.Struct({
  status: Schema.Literal("CONFIRMED"),
  itinerary: ConfirmedItineraryResponseSchema,
});
export type ConfirmItineraryResult = typeof ConfirmItineraryResultSchema.Type;

export const ItineraryAcknowledgementResponseSchema =
  ItineraryAcknowledgementSchema;
