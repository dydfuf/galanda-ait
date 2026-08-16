import { Effect } from "effect";
import { TripRoomRepository } from "../ports/trip-room-repository.ts";
import type { TripId } from "../domain/ids.ts";
import type { TripMember, TripRoom } from "../domain/room.ts";
import type { ConflictError, NotFoundError } from "../domain/errors.ts";

export interface JoinRoomInput {
  readonly roomId: TripId;
  readonly member: TripMember;
}

export const joinTripRoomUseCase = (
  input: JoinRoomInput
): Effect.Effect<TripRoom, NotFoundError | ConflictError, TripRoomRepository> =>
  Effect.gen(function* () {
    const repo = yield* TripRoomRepository;
    return yield* repo.joinRoom(input.roomId, input.member);
  });
