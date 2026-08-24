import { Schema } from "effect";
import {
  ConfirmedItinerarySnapshotSchema,
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
});
export type ConfirmedItineraryResponse = typeof ConfirmedItineraryResponseSchema.Type;

export const ItineraryStateResponseSchema = Schema.Union([
  Schema.Struct({
    status: Schema.Literal("CONFIRMED"),
    itinerary: ConfirmedItineraryResponseSchema,
  }),
  Schema.Struct({ status: Schema.Literal("UNCONFIRMED") }),
  Schema.Struct({ status: Schema.Literal("MISSING") }),
]);
export type ItineraryStateResponse = typeof ItineraryStateResponseSchema.Type;
