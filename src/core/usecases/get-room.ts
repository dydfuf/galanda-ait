import { Effect } from "effect";
import type { TripId } from "../domain/ids.ts";
import { TripRoomRepository } from "../ports/trip-room-repository.ts";
import type { NotFoundError } from "../domain/errors.ts";
import type { TripRoom } from "../domain/room.ts";

export const getTripRoom = (
  roomId: TripId
): Effect.Effect<TripRoom, NotFoundError, TripRoomRepository> =>
  Effect.gen(function* () {
    const repo = yield* TripRoomRepository;
    return yield* repo.getRoom(roomId);
  });

export const getTripRooms = (): Effect.Effect<
  ReadonlyArray<TripRoom>,
  never,
  TripRoomRepository
> =>
  Effect.gen(function* () {
    const repo = yield* TripRoomRepository;
    return yield* repo.getRooms();
  });
