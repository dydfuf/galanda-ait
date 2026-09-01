import { Context } from "effect";
import type {
  ItineraryId,
  ParticipantId,
  Revision,
  TripId,
} from "../domain/ids.ts";
import type {
  ConfirmedItinerary,
  ItineraryAcknowledgement,
} from "../domain/confirmed-itinerary.ts";
import type { TripRoom } from "../domain/room.ts";
import type { NotFoundError, RevisionConflictError } from "../domain/errors.ts";
import type { RepositoryEffect } from "./repository.ts";

import type { TripActivityWrite } from "../domain/trip-activity.ts";

export interface ConfirmItineraryParams {
  readonly room: TripRoom;
  readonly expectedRoomRevision: Revision;
  readonly itinerary: ConfirmedItinerary;
  readonly activity: TripActivityWrite;
}

export interface ReviseItineraryParams {
  readonly itinerary: ConfirmedItinerary;
  readonly expectedRevision: Revision;
  readonly activity: TripActivityWrite;
}

export interface AcknowledgeItineraryParams {
  readonly itineraryId: ItineraryId;
  readonly participantId: ParticipantId;
  readonly expectedRevision: Revision;
  readonly acknowledgedAt: string;
}

export class ConfirmedItineraryRepository extends Context.Service<
  ConfirmedItineraryRepository,
  {
    readonly confirm: (
      params: ConfirmItineraryParams
    ) => RepositoryEffect<ConfirmedItinerary, NotFoundError | RevisionConflictError>;
    readonly findByTripId: (
      tripId: TripId
    ) => RepositoryEffect<ConfirmedItinerary | undefined>;
    readonly revise: (
      params: ReviseItineraryParams
    ) => RepositoryEffect<ConfirmedItinerary, NotFoundError | RevisionConflictError>;
    readonly acknowledge: (
      params: AcknowledgeItineraryParams
    ) => RepositoryEffect<ItineraryAcknowledgement, NotFoundError | RevisionConflictError>;
    readonly getAcknowledgements: (
      itineraryId: ItineraryId
    ) => RepositoryEffect<ReadonlyArray<ItineraryAcknowledgement>>;
  }
>()("galanda/ports/ConfirmedItineraryRepository") {}
