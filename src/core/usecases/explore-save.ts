import { Clock, Effect } from "effect";
import { ExplorePlanRepository } from "../ports/explore-plan-repository.ts";
import {
  ExploreSaveRepository,
  type ListSavedListingsResult,
  type SavedListingCursor,
} from "../ports/explore-save-repository.ts";
import { requireAuthSession } from "../ports/session.ts";
import {
  ExploreListingUnavailableError,
  NotFoundError,
} from "../domain/errors.ts";
import type { ExploreListingId } from "../domain/ids.ts";

/**
 * Explore save·unsave·saved-list use case (RAON-254 / Goal 14 DISC-6).
 *
 * ## Actor identity (session only)
 *
 * actor는 항상 `requireAuthSession`으로 서버가 결정한다. client가 보낸
 * participant/user ID를 절대 신뢰하지 않는다. save는 개인 북마크이므로 GUEST/
 * REGISTERED 모두 허용하며(게시/게시중단과 달리 registered를 요구하지 않는다),
 * identity promotion 후에도 alias 집합 기반 read/delete로 기존 save를 유지한다.
 *
 * ## Reference-only + read-through
 *
 * save는 snapshot을 복사하지 않고 listing reference + savedAt만 저장한다.
 * saved-list는 항상 현재 listing을 read-through하므로 UNLISTED/deleted는 제외되고
 * 최신 공개 snapshot만 노출된다.
 *
 * ## Public read boundary
 *
 * save/saved-list는 `ExplorePlanRepository`(public listing)와 `ExploreSaveRepository`
 * 만 사용한다. private `TripRoomRepository`를 read-through하지 않는다(공개 read는
 * private aggregate에 의존하지 않는다).
 */

const nowIso = Effect.map(
  Clock.currentTimeMillis,
  (millis) => new Date(millis).toISOString()
);

export interface SaveExploreListingCommand {
  readonly listingId: ExploreListingId;
}

/**
 * 공개 listing 저장(save).
 *
 * - LISTED listing만 저장할 수 있다(정책). listing이 없으면 NotFound, UNLISTED면
 *   ExploreListingUnavailable(410). 게시 중단된 것을 새로 저장하도록 허용하지 않는다.
 * - `(participantId, listingId)` composite uniqueness + ON CONFLICT DO NOTHING으로
 *   idempotent하다. 이미 저장돼 있으면(alias 포함) no-op이고 성공으로 응답한다.
 * - 새 row는 canonical `session.participantId`로 insert한다(alias 중복 방지).
 */
export const saveExploreListing = Effect.fn("saveExploreListing")(
  function* (command: SaveExploreListingCommand) {
    const session = yield* requireAuthSession(
      "여행 일정을 저장하려면 로그인이 필요합니다."
    );

    const explore = yield* ExplorePlanRepository;
    const record = yield* explore.getById(command.listingId);

    // 없음: deleted/invalid/never-existed. private fallback 없이 NotFound.
    if (!record) {
      return yield* Effect.fail(
        new NotFoundError({
          entity: "ExplorePlanListing",
          id: command.listingId,
        })
      );
    }

    // UNLISTED: 공개 중단된 listing은 새로 저장할 수 없다(410 gone).
    if (record.listing.status !== "LISTED") {
      return yield* Effect.fail(new ExploreListingUnavailableError());
    }

    const saves = yield* ExploreSaveRepository;
    const savedAt = yield* nowIso;

    return yield* saves.save({
      participantId: session.participantId,
      participantIds: session.participantIds,
      listingId: command.listingId,
      savedAt,
    });
  }
);

export interface UnsaveExploreListingCommand {
  readonly listingId: ExploreListingId;
}

/**
 * 저장 해제(unsave).
 *
 * - alias 집합 전체에서 해당 listing save를 삭제한다. 대상이 없어도 실패하지
 *   않는다(반복 호출 안전, idempotent).
 * - listing 존재/상태를 검사하지 않는다. deleted/UNLISTED listing에 대한 unsave도
 *   idempotent하게 성공한다(저장 참조만 정리).
 */
export const unsaveExploreListing = Effect.fn("unsaveExploreListing")(
  function* (command: UnsaveExploreListingCommand) {
    const session = yield* requireAuthSession(
      "저장을 해제하려면 로그인이 필요합니다."
    );

    const saves = yield* ExploreSaveRepository;
    return yield* saves.unsave({
      participantIds: session.participantIds,
      listingId: command.listingId,
    });
  }
);

export interface GetExploreSaveStateQuery {
  readonly listingId: ExploreListingId;
}

/**
 * 단건 저장 상태 조회.
 *
 * alias 집합 중 하나라도 해당 listing을 저장했으면 true. UI가 toggle 초기 상태와
 * cache invalidation 후 실제 persisted 상태를 정직하게 반영하는 데 쓴다.
 */
export const getExploreSaveState = Effect.fn("getExploreSaveState")(
  function* (query: GetExploreSaveStateQuery) {
    const session = yield* requireAuthSession(
      "저장 상태를 확인하려면 로그인이 필요합니다."
    );

    const saves = yield* ExploreSaveRepository;
    const saved = yield* saves.isSaved({
      participantIds: session.participantIds,
      listingId: query.listingId,
    });
    return { saved };
  }
);

export interface ListSavedExploreListingsQuery {
  /** 한 페이지 최대 row 수. HTTP 경계에서 strict bounded validation을 거친 값. */
  readonly limit: number;
  /** 이전 페이지 마지막 cursor. 없으면 첫 페이지. */
  readonly cursor?: SavedListingCursor;
}

/**
 * 내 저장 목록(saved-list).
 *
 * - actor의 alias 집합에 대해 저장된 항목을 최신순으로 페이지네이션한다.
 * - 현재 LISTED listing만 read-through로 join해 반환한다(UNLISTED/deleted 제외).
 *   UNLISTED는 relist되면 다시 목록에 나타난다(save row는 유지되므로).
 * - 반환은 public envelope + immutable snapshot이라 source private ID가 없다.
 */
export const listSavedExploreListings = Effect.fn("listSavedExploreListings")(
  function* (query: ListSavedExploreListingsQuery) {
    const session = yield* requireAuthSession(
      "저장한 여행 일정을 보려면 로그인이 필요합니다."
    );

    const saves = yield* ExploreSaveRepository;
    const result: ListSavedListingsResult = yield* saves.listSaved({
      participantIds: session.participantIds,
      limit: query.limit,
      cursor: query.cursor,
    });

    return result;
  }
);
