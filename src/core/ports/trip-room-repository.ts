import { Context } from "effect";
import type { ParticipantId, Revision, TripId } from "../domain/ids.ts";
import type { TripMember, TripPlan, TripRoom } from "../domain/room.ts";
import type {
  NotFoundError,
  RevisionConflictError,
  StateConflictError,
} from "../domain/errors.ts";
import type { RepositoryEffect } from "./repository.ts";

export interface CreateRoomParams {
  readonly id: TripId;
  readonly title: string;
  readonly destination?: string;
  /** 방장으로 등록할 사용자. Use Case가 세션에서 결정해 반드시 채워준다 */
  readonly hostUser: TripMember;
}

export interface UpdateRoomParams {
  readonly title?: string;
  readonly destination?: string;
}

export class TripRoomRepository extends Context.Service<
  TripRoomRepository,
  {
    readonly getRoom: (
      roomId: TripId
    ) => RepositoryEffect<TripRoom, NotFoundError>;
    readonly getRooms: (
      participantIds: ReadonlyArray<ParticipantId>
    ) => RepositoryEffect<ReadonlyArray<TripRoom>>;
    readonly createRoom: (
      params: CreateRoomParams
    ) => RepositoryEffect<TripRoom, StateConflictError>;
    readonly updateRoom: (
      roomId: TripId,
      params: UpdateRoomParams,
      expectedRevision: Revision
    ) => RepositoryEffect<TripRoom, NotFoundError | RevisionConflictError>;
    readonly createPlan: (
      roomId: TripId,
      plan: TripPlan,
      expectedRevision: Revision
    ) => RepositoryEffect<TripRoom, NotFoundError | RevisionConflictError>;
    readonly updatePlan: (
      roomId: TripId,
      plan: TripPlan,
      expectedRevision: Revision
    ) => RepositoryEffect<TripRoom, NotFoundError | RevisionConflictError>;
    readonly saveRoom: (
      room: TripRoom,
      expectedRevision: Revision
    ) => RepositoryEffect<TripRoom, NotFoundError | RevisionConflictError>;
  }
>()("galanda/ports/TripRoomRepository") {}
