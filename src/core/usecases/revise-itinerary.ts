import { Clock, Effect } from "effect";
import {
  reviseConfirmedItinerary,
  type ItineraryItemPatch,
} from "../domain/confirmed-itinerary.ts";
import { NotFoundError, ValidationError } from "../domain/errors.ts";
import type { Revision, TripId } from "../domain/ids.ts";
import { requireRoomHost, requireRoomMember } from "../domain/auth-guards.ts";
import { mergeParticipantIdentityInRoom } from "../domain/room-transitions.ts";
import { ConfirmedItineraryRepository } from "../ports/confirmed-itinerary-repository.ts";
import { TripRoomRepository } from "../ports/trip-room-repository.ts";
import { requireAuthSession } from "../ports/session.ts";

export const reviseTripItinerary = Effect.fn("reviseTripItinerary")(
  function* (
    tripId: TripId,
    patches: ReadonlyArray<ItineraryItemPatch>,
    expectedRevision: Revision
  ) {
    const session = yield* requireAuthSession(
      "확정 일정을 수정하려면 로그인이 필요합니다."
    );
    const rooms = yield* TripRoomRepository;
    const room = mergeParticipantIdentityInRoom(
      yield* rooms.getRoom(tripId),
      session.participantId,
      session.participantIds
    );
    yield* requireRoomHost(
      room,
      session.participantIds,
      "방장만 확정 일정을 수정할 수 있습니다."
    );
    const itineraries = yield* ConfirmedItineraryRepository;
    const current = yield* itineraries.findByTripId(tripId);
    if (!current) {
      return yield* Effect.fail(
        new NotFoundError({ entity: "ConfirmedItinerary", id: tripId })
      );
    }
    const changedAt = new Date(yield* Clock.currentTimeMillis).toISOString();
    const revised = reviseConfirmedItinerary(
      current,
      patches,
      session.participantId,
      changedAt
    );
    if (typeof revised === "string") {
      return yield* Effect.fail(new ValidationError({ message: revised }));
    }
    return yield* itineraries.revise({ itinerary: revised, expectedRevision });
  }
);

export const acknowledgeTripItinerary = Effect.fn("acknowledgeTripItinerary")(
  function* (tripId: TripId, expectedRevision: Revision) {
    const session = yield* requireAuthSession(
      "확정 일정을 확인하려면 로그인이 필요합니다."
    );
    const rooms = yield* TripRoomRepository;
    const room = mergeParticipantIdentityInRoom(
      yield* rooms.getRoom(tripId),
      session.participantId,
      session.participantIds
    );
    yield* requireRoomMember(room, session.participantIds);
    const itineraries = yield* ConfirmedItineraryRepository;
    const itinerary = yield* itineraries.findByTripId(tripId);
    if (!itinerary) {
      return yield* Effect.fail(
        new NotFoundError({ entity: "ConfirmedItinerary", id: tripId })
      );
    }
    const acknowledgedAt = new Date(
      yield* Clock.currentTimeMillis
    ).toISOString();
    return yield* itineraries.acknowledge({
      itineraryId: itinerary.id,
      participantId: session.participantId,
      expectedRevision,
      acknowledgedAt,
    });
  }
);
