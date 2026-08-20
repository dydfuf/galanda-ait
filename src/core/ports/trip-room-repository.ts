import { Context } from "effect";
import type { PlanId, Revision, TripId } from "../domain/ids.ts";
import type {
  PlanMemberOpinion,
  TripMember,
  TripPlan,
  TripRoom,
} from "../domain/room.ts";
import type { ConflictError, NotFoundError } from "../domain/errors.ts";
import type { RepositoryEffect } from "./repository.ts";

export interface CreateRoomParams {
  readonly id: TripId;
  readonly title: string;
  readonly destination?: string;
  readonly startDate?: string;
  readonly endDate?: string;
  /** 방장으로 등록할 사용자. Use Case가 세션에서 결정해 반드시 채워준다 */
  readonly hostUser: TripMember;
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
    readonly getRoom: (
      roomId: TripId
    ) => RepositoryEffect<TripRoom, NotFoundError>;
    readonly getRooms: () => RepositoryEffect<ReadonlyArray<TripRoom>>;
    readonly createRoom: (
      params: CreateRoomParams
    ) => RepositoryEffect<TripRoom, ConflictError>;
    readonly updateRoom: (
      roomId: TripId,
      params: UpdateRoomParams,
      expectedRevision: Revision
    ) => RepositoryEffect<TripRoom, NotFoundError | ConflictError>;
    readonly createPlan: (
      roomId: TripId,
      plan: TripPlan,
      expectedRevision: Revision
    ) => RepositoryEffect<TripRoom, NotFoundError | ConflictError>;
    readonly updatePlan: (
      roomId: TripId,
      plan: TripPlan,
      expectedRevision: Revision
    ) => RepositoryEffect<TripRoom, NotFoundError | ConflictError>;
    readonly deletePlan: (
      roomId: TripId,
      planId: PlanId,
      expectedRevision: Revision
    ) => RepositoryEffect<TripRoom, NotFoundError | ConflictError>;
    readonly confirmPlan: (
      roomId: TripId,
      planId: PlanId,
      expectedRevision: Revision
    ) => RepositoryEffect<TripRoom, NotFoundError | ConflictError>;
    readonly setPlanOpinion: (
      roomId: TripId,
      planId: PlanId,
      opinion: PlanMemberOpinion,
      expectedRevision: Revision
    ) => RepositoryEffect<TripRoom, NotFoundError | ConflictError>;
    readonly joinRoom: (
      roomId: TripId,
      member: TripMember
    ) => RepositoryEffect<TripRoom, NotFoundError | ConflictError>;
  }
>()("galanda/ports/TripRoomRepository") {}


