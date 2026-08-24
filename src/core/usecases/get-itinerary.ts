import { Effect } from "effect";
import type { TripId } from "../domain/ids.ts";
import { NotFoundError } from "../domain/errors.ts";
import { requireRoomMember } from "../domain/auth-guards.ts";
import { mergeParticipantIdentityInRoom } from "../domain/room-transitions.ts";
import { ConfirmedItineraryRepository } from "../ports/confirmed-itinerary-repository.ts";
import { TripRoomRepository } from "../ports/trip-room-repository.ts";
import { requireAuthSession } from "../ports/session.ts";

export const getTripItinerary = Effect.fn("getTripItinerary")(
  function* (tripId: TripId) {
    const session = yield* requireAuthSession();
    const rooms = yield* TripRoomRepository;
    const room = mergeParticipantIdentityInRoom(
      yield* rooms.getRoom(tripId),
      session.participantId,
      session.participantIds
    );
    yield* requireRoomMember(room, session.participantIds).pipe(
      Effect.mapError(() => new NotFoundError({ entity: "TripRoom", id: tripId }))
    );

    const itineraries = yield* ConfirmedItineraryRepository;
    const itinerary = yield* itineraries.findByTripId(tripId);
    if (itinerary) return { status: "CONFIRMED" as const, itinerary };
    return room.confirmedPlanId
      ? { status: "MISSING" as const }
      : { status: "UNCONFIRMED" as const };
  }
);
