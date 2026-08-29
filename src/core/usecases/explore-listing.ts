import { Clock, Effect } from "effect";
import {
  ExplorePlanRepository,
  type ExploreListingCursor,
  type ExplorePlanListingRecord,
  type ListListedResult,
} from "../ports/explore-plan-repository.ts";
import { TripRoomRepository } from "../ports/trip-room-repository.ts";
import { IdGenerator } from "../ports/id-generator.ts";
import { requireAuthSession, requireRegisteredSession } from "../ports/session.ts";
import { getRoomActor, isPlanAuthor } from "../domain/auth-guards.ts";
import {
  projectExplorePlanSnapshot,
  type ExplorePlanListing,
} from "../domain/explore-plan.ts";
import {
  RevisionSchema,
  type ExploreListingId,
  type PlanId,
  type Revision,
  type TripId,
} from "../domain/ids.ts";
import {
  ExploreListingUnavailableError,
  ForbiddenError,
  NotFoundError,
  RevisionConflictError,
  StateConflictError,
  ValidationError,
} from "../domain/errors.ts";
import type { RepositoryError } from "../domain/errors.ts";
import { mergeParticipantIdentityInRoom } from "../domain/room-transitions.ts";
import type { TripPlan, TripRoom, UserSession } from "../domain/room.ts";

/**
 * Explore list·unlist·relist use case (RAON-259 / Goal 14 DISC-3).
 *
 * 각 전이는 명시적 use case다. generic publish/PlanPublishCompletion을 재사용하지
 * 않는다. actor는 항상 `requireRegisteredSession`으로 서버가 결정하며, client가
 * 보낸 userId/role/authorId/snapshot을 신뢰하지 않는다.
 */

/**
 * source room membership + strict plan authorship을 서버에서 검증한다.
 *
 * - room이 없으면 NotFound.
 * - session이 room member가 아니면(outsider) private room 존재 여부가 노출되지
 *   않도록 NotFound로 숨긴다(존재 oracle 방지).
 * - plan이 room에 없으면 NotFound.
 * - strict `isPlanAuthor`만 통과한다. HOST라도 타인 plan은 불가하며,
 *   requirePlanAuthor의 legacy HOST 복구 fallback은 사용하지 않는다.
 */
const requireSourceAuthorship = (
  session: UserSession,
  sourceTripId: TripId,
  sourcePlanId: PlanId
): Effect.Effect<
  { readonly room: TripRoom; readonly plan: TripPlan },
  NotFoundError | ForbiddenError | RepositoryError,
  TripRoomRepository
> =>
  Effect.gen(function* () {
    const repo = yield* TripRoomRepository;
    const room = mergeParticipantIdentityInRoom(
      yield* repo.getRoom(sourceTripId),
      session.participantId,
      session.participantIds
    );

    // membership concealment: outsider에게는 room/plan 존재를 노출하지 않는다.
    const actor = getRoomActor(room, session.participantIds);
    if (!actor.isMember) {
      return yield* Effect.fail(
        new NotFoundError({ entity: "TripRoom", id: sourceTripId })
      );
    }

    const plan = room.plans.find((candidate) => candidate.id === sourcePlanId);
    if (!plan) {
      return yield* Effect.fail(
        new NotFoundError({ entity: "TripPlan", id: sourcePlanId })
      );
    }

    // strict authorship: HOST 복구 fallback 없이 작성자 본인만 허용한다.
    if (!isPlanAuthor(room, plan, session.participantIds)) {
      return yield* Effect.fail(
        new ForbiddenError({
          reason: "여행안 작성자만 Explore에 게시할 수 있습니다.",
        })
      );
    }

    return { room, plan };
  });

const nowIso = Effect.map(
  Clock.currentTimeMillis,
  (millis) => new Date(millis).toISOString()
);

export interface ListPlanInExploreCommand {
  readonly sourceTripId: TripId;
  readonly sourcePlanId: PlanId;
}

/**
 * 최초 게시(list).
 *
 * - membership/plan 존재/strict authorship을 서버에서 검증한다.
 * - `plan.revision`이 반드시 있어야 한다(공개된 revision만 게시 가능).
 * - server-side `projectExplorePlanSnapshot`으로 snapshot을 생성한다(fail-closed).
 * - `findBySource`가 이미 LISTED면 기존 immutable snapshot을 그대로 반환하고
 *   live sync하지 않는다. UNLISTED면 explicit relist를 요구하는 StateConflict.
 * - 새 row는 listingRevision=1, Clock 시각, IdGenerator의 새 listingId로 저장한다.
 */
export const listPlanInExplore = Effect.fn("listPlanInExplore")(
  function* (command: ListPlanInExploreCommand) {
    const session = yield* requireRegisteredSession(
      "Explore에 게시하려면 계정 연결이 필요합니다."
    );

    const { room, plan } = yield* requireSourceAuthorship(
      session,
      command.sourceTripId,
      command.sourcePlanId
    );

    if (plan.revision === undefined) {
      return yield* Effect.fail(
        new ValidationError({
          message: "공개된 여행안 revision만 Explore에 게시할 수 있습니다.",
        })
      );
    }

    const explore = yield* ExplorePlanRepository;

    // 이미 존재하는 listing 확인: LISTED면 immutable snapshot 재반환(live sync 금지),
    // UNLISTED면 explicit relist를 요구한다.
    const existing = yield* explore.findBySource(
      command.sourceTripId,
      command.sourcePlanId
    );
    if (existing) {
      if (existing.listing.status === "LISTED") {
        return existing.listing;
      }
      return yield* Effect.fail(
        new StateConflictError({
          message:
            "이미 게시가 중단된 여행안입니다. 다시 노출하려면 재게시를 사용하세요.",
        })
      );
    }

    // server-side projection (fail-closed): 실패 이유별로 명시적 오류를 낸다.
    const projection = projectExplorePlanSnapshot(room, plan);
    if (!projection.ok) {
      return yield* Effect.fail(projectionFailureError(projection.failure));
    }

    const ids = yield* IdGenerator;
    const listingId = yield* ids.exploreListingId;
    const listedAt = yield* nowIso;

    const listing: ExplorePlanListing = {
      listingId,
      status: "LISTED",
      listingRevision: RevisionSchema.make(1),
      listedAt,
      updatedAt: listedAt,
      snapshot: projection.snapshot,
    };

    const record: ExplorePlanListingRecord = {
      listing,
      sourceTripId: command.sourceTripId,
      sourcePlanId: command.sourcePlanId,
      sourceAuthorParticipantId: session.participantId,
    };

    return yield* explore.create(record);
  }
);

export interface UnlistPlanFromExploreCommand {
  readonly listingId: ExploreListingId;
  readonly expectedRevision: Revision;
}

/**
 * 게시 중단(unlist).
 *
 * - listing의 `sourceAuthorParticipantId`가 session.participantIds 중 하나인
 *   author만 허용한다.
 * - LISTED→UNLISTED, revision +1, updatedAt=unlistedAt=now, listedAt/snapshot 유지.
 * - repository CAS(expectedListingRevision)로 atomic 적용한다.
 * - 이미 UNLISTED면 StateConflict.
 */
export const unlistPlanFromExplore = Effect.fn("unlistPlanFromExplore")(
  function* (command: UnlistPlanFromExploreCommand) {
    const session = yield* requireRegisteredSession(
      "Explore 게시를 중단하려면 계정 연결이 필요합니다."
    );

    const explore = yield* ExplorePlanRepository;
    const record = yield* explore.getById(command.listingId);
    if (!record) {
      return yield* Effect.fail(
        new NotFoundError({
          entity: "ExplorePlanListing",
          id: command.listingId,
        })
      );
    }

    yield* requireListingAuthor(session, record);
    yield* requireExpectedListingRevision(
      record.listing,
      command.expectedRevision
    );

    if (record.listing.status !== "LISTED") {
      return yield* Effect.fail(
        new StateConflictError({
          message: "이미 게시가 중단된 여행안입니다.",
        })
      );
    }

    const unlistedAt = yield* nowIso;
    const nextListing: ExplorePlanListing = {
      ...record.listing,
      status: "UNLISTED",
      listingRevision: RevisionSchema.make(record.listing.listingRevision + 1),
      updatedAt: unlistedAt,
      unlistedAt,
      // listedAt/snapshot 유지(immutable).
    };

    return yield* explore.compareAndSet({
      record: { ...record, listing: nextListing },
      expectedListingRevision: command.expectedRevision,
    });
  }
);

export interface RelistPlanInExploreCommand {
  readonly listingId: ExploreListingId;
  readonly expectedRevision: Revision;
}

/**
 * 재게시(relist).
 *
 * - listing author를 검증한 뒤, source room/plan/membership/strict ownership을
 *   다시 확인한다(source 없음/invalid면 fail-closed).
 * - UNLISTED만 허용한다(LISTED면 StateConflict).
 * - 최신 source revision의 새 server projection으로 snapshot을 교체한다.
 * - listingRevision +1, listedAt=updatedAt=now, unlistedAt 제거.
 */
export const relistPlanInExplore = Effect.fn("relistPlanInExplore")(
  function* (command: RelistPlanInExploreCommand) {
    const session = yield* requireRegisteredSession(
      "Explore에 다시 게시하려면 계정 연결이 필요합니다."
    );

    const explore = yield* ExplorePlanRepository;
    const record = yield* explore.getById(command.listingId);
    if (!record) {
      return yield* Effect.fail(
        new NotFoundError({
          entity: "ExplorePlanListing",
          id: command.listingId,
        })
      );
    }

    yield* requireListingAuthor(session, record);
    yield* requireExpectedListingRevision(
      record.listing,
      command.expectedRevision
    );

    if (record.listing.status !== "UNLISTED") {
      return yield* Effect.fail(
        new StateConflictError({
          message: "이미 노출 중인 여행안입니다.",
        })
      );
    }

    // source가 여전히 유효하고, membership·strict ownership이 유지되는지 재확인.
    // source 삭제/권한 상실이면 fail-closed(NotFound/Forbidden).
    const { room, plan } = yield* requireSourceAuthorship(
      session,
      record.sourceTripId,
      record.sourcePlanId
    );

    if (plan.revision === undefined) {
      return yield* Effect.fail(
        new ValidationError({
          message: "공개된 여행안 revision만 다시 게시할 수 있습니다.",
        })
      );
    }

    // 최신 source를 다시 project한 새 snapshot으로 교체(fail-closed).
    const projection = projectExplorePlanSnapshot(room, plan);
    if (!projection.ok) {
      return yield* Effect.fail(projectionFailureError(projection.failure));
    }

    const relistedAt = yield* nowIso;
    const nextListing: ExplorePlanListing = {
      listingId: record.listing.listingId,
      status: "LISTED",
      listingRevision: RevisionSchema.make(record.listing.listingRevision + 1),
      listedAt: relistedAt,
      updatedAt: relistedAt,
      // unlistedAt 제거: 다시 노출 중.
      snapshot: projection.snapshot,
    };

    return yield* explore.compareAndSet({
      record: { ...record, listing: nextListing },
      expectedListingRevision: command.expectedRevision,
    });
  }
);

/**
 * 이미 저장된 revision과 client expected revision이 다르면 state 해석 전에
 * stale write로 분류한다. 이후 실제 CAS는 load 이후 race까지 다시 보호한다.
 */
const requireExpectedListingRevision = (
  listing: ExplorePlanListing,
  expectedRevision: Revision
): Effect.Effect<void, RevisionConflictError> =>
  listing.listingRevision === expectedRevision
    ? Effect.void
    : Effect.fail(
        new RevisionConflictError({
          message: "다른 요청이 이미 Explore listing 상태를 변경했습니다.",
          expectedRevision,
          actualRevision: listing.listingRevision,
        })
      );

/**
 * listing author 검증. listing의 server-only `sourceAuthorParticipantId`가
 * session의 participant alias 중 하나인 경우에만 통과한다.
 */
const requireListingAuthor = (
  session: UserSession,
  record: ExplorePlanListingRecord
): Effect.Effect<void, ForbiddenError> =>
  session.participantIds.includes(record.sourceAuthorParticipantId)
    ? Effect.void
    : Effect.fail(
        new ForbiddenError({
          reason: "게시한 작성자만 이 작업을 수행할 수 있습니다.",
        })
      );

/**
 * Explore feed read query (RAON-260 / Goal 14 DISC-4).
 *
 * data-backed discover query. authenticated session만 요구하고, 다른 Trip
 * membership이나 room ownership은 요구하지 않는다. private aggregate를 조회하지
 * 않으며(`TripRoomRepository` 미의존) 오직 `ExplorePlanRepository.listListed`로
 * 이미 sanitized된 immutable snapshot page만 읽는다.
 *
 * - LISTED snapshot만 반환한다(adapter가 UNLISTED를 제외).
 * - deterministic keyset(`listedAt DESC, listingId DESC`)으로 duplicate/missing
 *   없이 다음 페이지를 반환한다. cursor는 adapter가 계산한 opaque tuple이다.
 * - 반환 결과는 public envelope + immutable snapshot이라 source private ID가 없다.
 */
export interface ListExploreListingsQuery {
  /** 한 페이지 최대 row 수. HTTP 경계에서 strict bounded validation을 거친 값. */
  readonly limit: number;
  /** 이전 페이지 마지막 cursor. 없으면 첫 페이지. */
  readonly cursor?: ExploreListingCursor;
}

export const listExploreListings = Effect.fn("listExploreListings")(
  function* (query: ListExploreListingsQuery) {
    // authenticated session만 요구한다. registered 여부·room membership은 보지 않는다.
    yield* requireAuthSession("탐색을 보려면 로그인이 필요합니다.");

    const explore = yield* ExplorePlanRepository;
    const result: ListListedResult = yield* explore.listListed({
      limit: query.limit,
      cursor: query.cursor,
    });

    return result;
  }
);

/**
 * Explore listing detail read query (RAON-263 / Goal 14 DISC-5).
 *
 * 단일 focused detail을 위한 public read다. feed query와 동일하게 authenticated
 * session만 요구하고, source private aggregate를 read-through하지 않는다
 * (`TripRoomRepository` 미의존). 오직 `ExplorePlanRepository.getById`로 이미
 * sanitized된 immutable record만 읽고, 공개 가능한 상태(LISTED)일 때만 반환한다.
 *
 * 상태 구분(cached private fallback 없음):
 * - record 없음(deleted/invalid/never-existed) → NotFoundError (404).
 * - record는 있으나 UNLISTED(게시 중단) → ExploreListingUnavailableError (410).
 * - LISTED → public envelope + immutable snapshot(LISTED)만 반환.
 */
export interface GetExploreListingDetailQuery {
  readonly listingId: ExploreListingId;
}

export const getExploreListingDetail = Effect.fn("getExploreListingDetail")(
  function* (query: GetExploreListingDetailQuery) {
    // feed와 동일: authenticated session만 요구한다. room membership을 보지 않는다.
    yield* requireAuthSession("탐색을 보려면 로그인이 필요합니다.");

    const explore = yield* ExplorePlanRepository;
    const record = yield* explore.getById(query.listingId);

    // 없음: deleted/invalid/never-existed. cached private fallback 없이 NotFound.
    if (!record) {
      return yield* Effect.fail(
        new NotFoundError({
          entity: "ExplorePlanListing",
          id: query.listingId,
        })
      );
    }

    // UNLISTED: 존재하지만 더 이상 공개하지 않음. NotFound와 구분되는 gone(410).
    if (record.listing.status !== "LISTED") {
      return yield* Effect.fail(new ExploreListingUnavailableError());
    }

    // LISTED: public envelope + immutable snapshot만 반환한다(source ref 제외).
    return record.listing;
  }
);

/** projection 실패를 use case error algebra로 매핑한다(fail-closed). */
const projectionFailureError = (
  failure: Extract<
    ReturnType<typeof projectExplorePlanSnapshot>,
    { ok: false }
  >["failure"]
): ValidationError => {
  switch (failure.kind) {
    case "MISSING_REVISION":
      return new ValidationError({
        message: "공개된 여행안 revision만 Explore에 게시할 수 있습니다.",
      });
    case "UNRESOLVED_AUTHOR":
      return new ValidationError({
        message: "작성자 표시명을 확인할 수 없어 Explore에 게시할 수 없습니다.",
      });
    case "INVALID_ROUTE":
      return new ValidationError({ message: failure.message });
  }
};
