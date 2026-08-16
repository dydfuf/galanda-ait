import { Effect } from "effect";
import { TripRoomRepository, type UpdateRoomParams } from "../ports/trip-room-repository.ts";
import type { Revision, TripId } from "../domain/ids.ts";
import type { TripRoom } from "../domain/room.ts";
import type { ConflictError, NotFoundError } from "../domain/errors.ts";

export interface UpdateRoomInput {
  readonly roomId: TripId;
  readonly params: UpdateRoomParams;
  readonly expectedRevision: Revision;
}

export const updateTripRoomUseCase = (
  input: UpdateRoomInput
): Effect.Effect<TripRoom, NotFoundError | ConflictError, TripRoomRepository> =>
  Effect.gen(function* () {
    const repo = yield* TripRoomRepository;
    return yield* repo.updateRoom(input.roomId, input.params, input.expectedRevision);
  });
