import { Context } from "effect";
import type { Revision, TripId } from "../domain/ids.ts";
import type { ConfirmedItinerary } from "../domain/confirmed-itinerary.ts";
import type { TripRoom } from "../domain/room.ts";
import type { NotFoundError, RevisionConflictError } from "../domain/errors.ts";
import type { RepositoryEffect } from "./repository.ts";

export interface ConfirmItineraryParams {
  readonly room: TripRoom;
  readonly expectedRoomRevision: Revision;
  readonly itinerary: ConfirmedItinerary;
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
  }
>()("galanda/ports/ConfirmedItineraryRepository") {}
