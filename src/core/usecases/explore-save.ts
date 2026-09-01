import { Clock, Effect } from "effect";
import {
  ExploreSaveRepository,
  type ListSavedListingsResult,
  type SavedListingCursor,
} from "../ports/explore-save-repository.ts";
import { requireAuthSession } from "../ports/session.ts";
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
 * save는 snapshot을 복사하지 않고 listing reference + save interval만 저장한다.
 * saved-list는 항상 현재 listing을 read-through하므로 UNLISTED/deleted는 제외되고
 * 최신 공개 snapshot만 노출된다.
 *
 * ## Public read boundary
 *
 * save transaction과 public aggregate는 `ExploreSaveRepository`가 소유한다.
 * private `TripRoomRepository`를 read-through하지 않는다.
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
 * - LISTED 여부와 interval write/count는 repository transaction에서 함께 확인한다.
 * - 이미 저장돼 있으면(alias 포함) no-op이고 authoritative count를 반환한다.
 */
export const saveExploreListing = Effect.fn("saveExploreListing")(
  function* (command: SaveExploreListingCommand) {
    const session = yield* requireAuthSession(
      "여행 일정을 저장하려면 로그인이 필요합니다."
    );

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
 * - alias 집합 전체에서 해당 listing의 active interval을 닫는다. 대상이 없어도
 *   실패하지 않는다(반복 호출 안전, idempotent).
 */
export const unsaveExploreListing = Effect.fn("unsaveExploreListing")(
  function* (command: UnsaveExploreListingCommand) {
    const session = yield* requireAuthSession(
      "저장을 해제하려면 로그인이 필요합니다."
    );

    const saves = yield* ExploreSaveRepository;
    const unsavedAt = yield* nowIso;
    return yield* saves.unsave({
      participantIds: session.participantIds,
      listingId: command.listingId,
      unsavedAt,
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
    return saved;
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
