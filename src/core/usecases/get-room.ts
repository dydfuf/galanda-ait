import { Effect, Option } from "effect";
import type { TripId } from "../domain/ids.ts";
import { toViewerRoom } from "../domain/room-visibility.ts";
import { TripRoomRepository } from "../ports/trip-room-repository.ts";
import { requireAuthSession } from "../ports/session.ts";
import { mergeParticipantIdentityInRoom } from "../domain/room-transitions.ts";
import { requireRoomMember } from "../domain/auth-guards.ts";
import { NotFoundError } from "../domain/errors.ts";


export const getTripRoom = Effect.fn("getTripRoom")(function* (roomId: TripId) {
  const session = yield* requireAuthSession();
  const repo = yield* TripRoomRepository;
  const room = yield* repo.getRoom(roomId);
  const merged = mergeParticipantIdentityInRoom(
    room,
    session.participantId,
    session.participantIds
  );
  yield* requireRoomMember(merged, session.participantIds).pipe(
    Effect.mapError(
      () => new NotFoundError({ entity: "TripRoom", id: roomId })
    )
  );
  return toViewerRoom(merged, session.participantIds);
});

export const findTripRoom = Effect.fn("findTripRoom")(function* (roomId: TripId) {
  return yield* getTripRoom(roomId).pipe(
    Effect.map(Option.some),
    Effect.catchTag("NotFoundError", () => Effect.succeed(Option.none()))
  );
});

export const getTripRooms = Effect.fn("getTripRooms")(function* () {
  const session = yield* requireAuthSession();
  const repo = yield* TripRoomRepository;
  return (yield* repo.getRooms(session.participantIds)).map((room) => {
    const merged = mergeParticipantIdentityInRoom(
      room,
      session.participantId,
      session.participantIds
    );
    return toViewerRoom(merged, session.participantIds);
  });
});
