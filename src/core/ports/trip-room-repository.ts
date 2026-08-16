import { Context, Effect } from "effect";
import type { PlanId, Revision, TripId } from "../domain/ids.ts";
import type { TripRoom } from "../domain/room.ts";
import type { ConflictError, NotFoundError } from "../domain/errors.ts";

export class TripRoomRepository extends Context.Service<
  TripRoomRepository,
  {
    readonly getRoom: (roomId: TripId) => Effect.Effect<TripRoom, NotFoundError>;
    readonly getRooms: () => Effect.Effect<ReadonlyArray<TripRoom>>;
    readonly confirmPlan: (
      roomId: TripId,
      planId: PlanId,
      expectedRevision: Revision
    ) => Effect.Effect<TripRoom, NotFoundError | ConflictError>;
  }
>()("galanda/ports/TripRoomRepository") {}
