import { Effect } from "effect";
import { TripRoomRepository, type CreateRoomParams } from "../ports/trip-room-repository.ts";
import type { TripRoom } from "../domain/room.ts";
import type { NotFoundError } from "../domain/errors.ts";

export type CreateRoomInput = CreateRoomParams;

export const createTripRoomUseCase = (
  input: CreateRoomInput
): Effect.Effect<TripRoom, NotFoundError, TripRoomRepository> =>
  Effect.gen(function* () {
    const repo = yield* TripRoomRepository;

    return yield* repo.createRoom(input);
  });

