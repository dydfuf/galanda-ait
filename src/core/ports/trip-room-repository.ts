import { Context } from "effect";
import type { ParticipantId, PlanId, Revision, TripId } from "../domain/ids.ts";
import type { TripMember, TripPlan, TripRoom } from "../domain/room.ts";
import type { ConfirmedItinerary } from "../domain/confirmed-itinerary.ts";
import type {
  NotFoundError,
  RevisionConflictError,
} from "../domain/errors.ts";
import type { RepositoryEffect } from "./repository.ts";

export interface TripOverviewSourceRecord {
  readonly room: TripRoom;
  readonly roomCreatedAt: string;
  readonly roomUpdatedAt: string;
  readonly currentItinerary: ConfirmedItinerary | null;
}

export interface CreateRoomParams {
  readonly id: TripId;
  readonly title: string;
  readonly destination?: string;
  /** 방장으로 등록할 사용자. Use Case가 세션에서 결정해 반드시 채워준다 */
  readonly hostUser: TripMember;
  /**
   * 방 생성과 동시에 하나의 aggregate row에 함께 저장할 서버 전용 초기 plan.
   * (RAON-261 / Goal 14 DISC-7) NEW_TRIP import가 room+plan을 단일 INSERT로
   * atomic하게 저장해 partial empty room을 남기지 않도록 한다. client input이
   * 아니라 use case가 server-side로 구성한 값이며, 없으면 기존처럼 빈 방을 만든다.
   */
  readonly initialPlan?: TripPlan;
}

export interface UpdateRoomParams {
  readonly title?: string;
  readonly destination?: string;
}

/**
 * source plan 삭제와 Explore listing auto-unlist를 하나의 atomic persistence로
 * 묶기 위한 command (RAON-258 / Goal 14 DISC-1, DISC-10).
 *
 * DISC-1에서 source plan 삭제 시 그 plan을 원본으로 하는 LISTED listing은
 * 반드시 함께 게시 중단(auto-unlist)돼야 한다고 결정했다. 서로 다른 테이블에
 * 걸친 두 write가 partial state를 남기지 않도록, room CAS와 listing UNLISTED
 * 전이를 같은 transaction에서 수행하는 명시적 operation으로 표현한다.
 *
 * 모든 값은 auth/authz/미확정 검증을 마친 use case가 서버 측에서 구성한다.
 * client input을 권한이나 시각의 근거로 신뢰하지 않는다.
 */
export interface DeletePlanAndAutoUnlistParams {
  /** plan이 이미 제거된, domain transition 이후의 목표 room 상태. */
  readonly room: TripRoom;
  /** auto-unlist 대상을 찾기 위한 삭제된 source plan ID. */
  readonly sourcePlanId: PlanId;
  /** room CAS가 성공해야 하는 기대 revision. */
  readonly expectedRevision: Revision;
  /** 서버 Clock이 정한 unlist/갱신 시각(ISO). listing updated_at/unlisted_at에 사용. */
  readonly unlistedAt: string;
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
    readonly getRoomOverviewRecords: (
      participantIds: ReadonlyArray<ParticipantId>
    ) => RepositoryEffect<ReadonlyArray<TripOverviewSourceRecord>>;
    readonly createRoom: (params: CreateRoomParams) => RepositoryEffect<TripRoom>;
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
    /**
     * source plan 삭제(room CAS)와 그 plan을 원본으로 하는 LISTED Explore
     * listing의 auto-unlist를 하나의 atomic persistence로 수행한다.
     *
     * - room은 `expectedRevision`으로 compare-and-swap한다. room CAS가 miss하면
     *   listing을 건드리지 않고 기존 NotFound/RevisionConflict 의미를 그대로
     *   전파한다.
     * - `(sourceTripId=room.id, sourcePlanId, status=LISTED)`에 매칭되는 listing이
     *   있으면 UNLISTED로 전이하고 listing_revision을 atomically +1,
     *   updated_at/unlisted_at를 서버 시각으로 갱신하되 listed_at/snapshot/
     *   source revision은 immutable하게 보존한다.
     * - 매칭 listing이 없거나 이미 UNLISTED여도 plan 삭제는 idempotent하게
     *   성공한다(persistence policy 수준의 auto-unlist는 no-op).
     * - 두 write는 같은 transaction에서 수행되어, 어느 쪽 실패든 함께 rollback된다.
     */
    readonly deletePlanAndAutoUnlist: (
      params: DeletePlanAndAutoUnlistParams
    ) => RepositoryEffect<TripRoom, NotFoundError | RevisionConflictError>;
  }
>()("galanda/ports/TripRoomRepository") {}
