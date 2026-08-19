import { Effect, Option } from "effect";
import type { TripId } from "../domain/ids.ts";
import { TripRoomRepository } from "../ports/trip-room-repository.ts";

export const getTripRoom = Effect.fn("getTripRoom")(function* (roomId: TripId) {
  const repo = yield* TripRoomRepository;
  return yield* repo.getRoom(roomId);
});

export const findTripRoom = Effect.fn("findTripRoom")(function* (roomId: TripId) {
  return yield* getTripRoom(roomId).pipe(
    Effect.map(Option.some),
    Effect.catchTag("NotFoundError", () => Effect.succeed(Option.none()))
  );
});

export const getTripRooms = Effect.fn("getTripRooms")(function* () {
  const repo = yield* TripRoomRepository;
  return yield* repo.getRooms();
});
