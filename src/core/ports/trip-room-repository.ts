import { Context, Effect } from "effect";
import type { PlanId, Revision, TripId } from "../domain/ids.ts";
import type { PlanMemberOpinion, TripMember, TripPlan, TripRoom } from "../domain/room.ts";
import type { ConflictError, NotFoundError } from "../domain/errors.ts";

export interface CreateRoomParams {
  readonly title: string;
  readonly destination?: string;
  readonly startDate?: string;
  readonly endDate?: string;
  readonly hostUser?: TripMember;
}

export interface UpdateRoomParams {
  readonly title?: string;
  readonly destination?: string;
  readonly startDate?: string;
  readonly endDate?: string;
}

export class TripRoomRepository extends Context.Service<
  TripRoomRepository,
  {
    readonly getRoom: (roomId: TripId) => Effect.Effect<TripRoom, NotFoundError>;
    readonly getRooms: () => Effect.Effect<ReadonlyArray<TripRoom>>;
    readonly createRoom: (
      params: CreateRoomParams
    ) => Effect.Effect<TripRoom, ConflictError>;
    readonly updateRoom: (
      roomId: TripId,
      params: UpdateRoomParams,
      expectedRevision: Revision
    ) => Effect.Effect<TripRoom, NotFoundError | ConflictError>;
    readonly createPlan: (
      roomId: TripId,
      plan: TripPlan,
      expectedRevision: Revision
    ) => Effect.Effect<TripRoom, NotFoundError | ConflictError>;
    readonly updatePlan: (
      roomId: TripId,
      plan: TripPlan,
      expectedRevision: Revision
    ) => Effect.Effect<TripRoom, NotFoundError | ConflictError>;
    readonly deletePlan: (
      roomId: TripId,
      planId: PlanId,
      expectedRevision: Revision
    ) => Effect.Effect<TripRoom, NotFoundError | ConflictError>;
    readonly confirmPlan: (
      roomId: TripId,
      planId: PlanId,
      expectedRevision: Revision
    ) => Effect.Effect<TripRoom, NotFoundError | ConflictError>;
    readonly setPlanOpinion: (
      roomId: TripId,
      planId: PlanId,
      opinion: PlanMemberOpinion,
      expectedRevision: Revision
    ) => Effect.Effect<TripRoom, NotFoundError | ConflictError>;
    readonly joinRoom: (
      roomId: TripId,
      member: TripMember
    ) => Effect.Effect<TripRoom, NotFoundError | ConflictError>;
  }
>()("galanda/ports/TripRoomRepository") {}

