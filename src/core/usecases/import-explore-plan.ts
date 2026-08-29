import { Clock, Effect } from "effect";
import {
  ExploreListingUnavailableError,
  NotFoundError,
  RevisionConflictError,
  ValidationError,
} from "../domain/errors.ts";
import type { RepositoryError } from "../domain/errors.ts";
import {
  copyExploreSnapshotToTripPlan,
  type ExplorePlanListing,
} from "../domain/explore-plan.ts";
import type {
  ExploreListingId,
  PlanId,
  Revision,
  TripId,
} from "../domain/ids.ts";
import type { TripMember, UserSession } from "../domain/room.ts";
import { requireRoomPermission, requireRoomUnconfirmed } from "../domain/auth-guards.ts";
import { mergeParticipantIdentityInRoom } from "../domain/room-transitions.ts";
import { ExplorePlanRepository } from "../ports/explore-plan-repository.ts";
import { IdGenerator } from "../ports/id-generator.ts";
import {
  requireAuthSession,
  requireRegisteredSession,
} from "../ports/session.ts";
import { TripRoomRepository } from "../ports/trip-room-repository.ts";

/**
 * Explore snapshot import use case (RAON-261 / Goal 14 DISC-7).
 *
 * LISTED public snapshot을 사용자의 private VOTING plan으로 복사한다. source
 * private Trip/Plan aggregate를 다시 읽지 않고 오직 `ExplorePlanRepository`가
 * 돌려준 immutable snapshot만 입력으로 쓴다. actor/author는 서버 세션이 결정하며
 * client가 보낸 author/snapshot/status/revision/provenance를 신뢰하지 않는다.
 *
 * ## Auth-first ordering
 * 인증을 listing lookup보다 먼저 수행한다. 미인증/guest 거부는 Explore/Trip
 * repository read를 전혀 하지 않으므로, 권한 없는 호출자가 listing "없음"과
 * "UNLISTED"를 구분(존재 여부 probing)할 수 없다. branch helper는 이미 확인된
 * `UserSession`을 인자로 받아 재조회하지 않으며, target별 auth semantics는 유지한다.
 *
 * ## Target
 * - NEW_TRIP: 등록 세션(계정 연결)을 먼저 요구한다(createTripRoom과 동일). guest는
 *   listing lookup 이전에 AccountUpgradeRequired로 거부된다. 이후 room 생성과 copied
 *   plan 생성을 단일 INSERT(atomic)로 처리하고 partial empty room을 남기지 않는다.
 * - EXISTING_TRIP: authenticated 세션을 먼저 요구하고, room membership +
 *   `plan:create` capability를 서버에서 확인한 뒤 미확정 방에 aggregate revision
 *   CAS로 plan을 추가한다. stale write는 RevisionConflict(409)다.
 *
 * ## No live sync
 * copied plan은 새 ID/소유권/revision=1/status=VOTING/server timestamp를 갖고,
 * 이후 source 수정/unlist와 동기화하지 않는다. provenance(`importedFromExplore
 * ListingId`)만 공개 listing ID로 보존한다(source private ID 아님).
 */

export type ImportExplorePlanTarget =
  | { readonly type: "NEW_TRIP"; readonly title?: string }
  | {
      readonly type: "EXISTING_TRIP";
      readonly tripId: TripId;
      readonly expectedRevision: Revision;
    };

export interface ImportExplorePlanCommand {
  readonly listingId: ExploreListingId;
  readonly target: ImportExplorePlanTarget;
}

export interface ImportExplorePlanResult {
  readonly tripId: TripId;
  readonly planId: PlanId;
}

const nowIso = Effect.map(
  Clock.currentTimeMillis,
  (millis) => new Date(millis).toISOString()
);

/**
 * import 가능한 LISTED listing만 반환한다. read query와 동일한 상태 구분:
 * - record 없음(deleted/invalid/never-existed) → NotFound(404).
 * - UNLISTED → ExploreListingUnavailable(410).
 * source private aggregate는 절대 read-through하지 않는다.
 */
const requireListedListing = (
  listingId: ExploreListingId
): Effect.Effect<
  ExplorePlanListing,
  NotFoundError | ExploreListingUnavailableError | RepositoryError,
  ExplorePlanRepository
> =>
  Effect.gen(function* () {
    const explore = yield* ExplorePlanRepository;
    const record = yield* explore.getById(listingId);
    if (!record) {
      return yield* Effect.fail(
        new NotFoundError({ entity: "ExplorePlanListing", id: listingId })
      );
    }
    if (record.listing.status !== "LISTED") {
      return yield* Effect.fail(new ExploreListingUnavailableError());
    }
    return record.listing;
  });

const importIntoNewTrip = Effect.fn("importExplorePlan.newTrip")(
  function* (
    session: UserSession,
    listing: ExplorePlanListing,
    title: string | undefined
  ) {
    // room title: 사용자가 준 title(trim)을 우선하되, 명시적으로 보낸 title이 비면
    // 거부한다. 아예 안 보내면 snapshot.title을 쓴다.
    let roomTitle: string;
    if (title === undefined) {
      roomTitle = listing.snapshot.title;
    } else {
      const trimmed = title.trim();
      if (!trimmed) {
        return yield* Effect.fail(
          new ValidationError({ message: "여행 제목을 입력해주세요." })
        );
      }
      roomTitle = trimmed;
    }

    const ids = yield* IdGenerator;
    const tripId = yield* ids.tripId;
    const planId = yield* ids.planId;
    const publishedAt = yield* nowIso;

    // 새 방은 방장 1명이므로 baseHeadcount=1, destination=snapshot.destination.
    const copy = copyExploreSnapshotToTripPlan({
      snapshot: listing.snapshot,
      planId,
      authorId: session.participantId,
      authorName: session.name,
      baseHeadcount: 1,
      publishedAt,
      listingId: listing.listingId,
    });
    if (!copy.ok) {
      return yield* Effect.fail(new ValidationError({ message: copy.message }));
    }

    const hostUser: TripMember = {
      id: session.participantId,
      name: session.name,
      role: "HOST",
    };

    const repo = yield* TripRoomRepository;
    // room + copied plan을 단일 aggregate write로 저장한다(partial empty room 없음).
    yield* repo.createRoom({
      id: tripId,
      title: roomTitle,
      destination: listing.snapshot.destination,
      hostUser,
      initialPlan: copy.plan,
    });

    return { tripId, planId } satisfies ImportExplorePlanResult;
  }
);

const importIntoExistingTrip = Effect.fn("importExplorePlan.existingTrip")(
  function* (
    session: UserSession,
    listing: ExplorePlanListing,
    tripId: TripId,
    expectedRevision: Revision
  ) {
    const repo = yield* TripRoomRepository;
    const room = mergeParticipantIdentityInRoom(
      yield* repo.getRoom(tripId),
      session.participantId,
      session.participantIds
    );

    // authorization을 실제 revision 노출보다 먼저 수행한다(membership + plan:create).
    const actor = yield* requireRoomPermission(
      room,
      session.participantIds,
      "plan:create",
      "여행방 참여자만 여행 일정을 저장할 수 있습니다."
    );

    // authorization 이후에만 loaded-revision mismatch를 RevisionConflict로 노출한다.
    // 최종 repository CAS가 load→write race를 다시 보호한다.
    if (room.revision !== expectedRevision) {
      return yield* Effect.fail(
        new RevisionConflictError({
          message: "다른 사용자가 이미 방 정보를 수정했습니다.",
          expectedRevision,
          actualRevision: room.revision,
        })
      );
    }

    // 확정된 방에는 새 여행안을 추가하지 않는다.
    yield* requireRoomUnconfirmed(
      room,
      "확정된 여행에서는 여행 일정을 추가할 수 없습니다."
    );

    const ids = yield* IdGenerator;
    const planId = yield* ids.planId;
    const publishedAt = yield* nowIso;

    // baseHeadcount는 기존 editor 기본값과 동일하게 방 멤버 수를 쓴다(source 값 미사용).
    const baseHeadcount = Math.max(1, room.members.length);

    const copy = copyExploreSnapshotToTripPlan({
      snapshot: listing.snapshot,
      planId,
      authorId: session.participantId,
      authorName: actor.member?.name ?? session.name,
      baseHeadcount,
      publishedAt,
      listingId: listing.listingId,
    });
    if (!copy.ok) {
      return yield* Effect.fail(new ValidationError({ message: copy.message }));
    }

    // 기존 방 title/destination은 덮어쓰지 않는다. plan만 추가하고 aggregate CAS.
    yield* repo.saveRoom(
      { ...room, plans: [...room.plans, copy.plan] },
      expectedRevision
    );

    return { tripId, planId } satisfies ImportExplorePlanResult;
  }
);

export const importExplorePlan = Effect.fn("importExplorePlan")(
  function* (command: ImportExplorePlanCommand) {
    // 인증을 listing lookup보다 먼저 수행한다. unauth/guest 실패는 Explore/Trip
    // repository read를 전혀 하지 않으므로 "없음"과 "UNLISTED"를 구분할 수 없다.
    // target별 auth semantics 유지: NEW_TRIP은 등록 세션(계정 연결) 필요,
    // EXISTING_TRIP은 authenticated 세션 필요(방 capability는 이후 확인).
    if (command.target.type === "NEW_TRIP") {
      const session = yield* requireRegisteredSession(
        "여행 일정을 저장하려면 계정 연결이 필요합니다."
      );
      // 인증 성공 이후에만 LISTED snapshot을 읽는다. source private aggregate는 읽지 않는다.
      const listing = yield* requireListedListing(command.listingId);
      return yield* importIntoNewTrip(session, listing, command.target.title);
    }

    const session = yield* requireAuthSession(
      "여행 일정을 저장하려면 로그인이 필요합니다."
    );
    const listing = yield* requireListedListing(command.listingId);
    return yield* importIntoExistingTrip(
      session,
      listing,
      command.target.tripId,
      command.target.expectedRevision
    );
  }
);
