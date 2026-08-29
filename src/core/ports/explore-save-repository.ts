import { Context } from "effect";
import type {
  ExploreListingId,
  ParticipantId,
} from "../domain/ids.ts";
import type { ExplorePlanListing } from "../domain/explore-plan.ts";
import type { RepositoryEffect } from "./repository.ts";

/**
 * Explore save persistence port (RAON-254 / Goal 14 DISC-6).
 *
 * save는 reference-only다(snapshot 미복사). saved-list는 항상 현재 listing을
 * read-through해 최신 공개 상태만 반영한다. actor identity는 use case가 session
 * 에서 결정하며, 이 port는 서버가 넘긴 stable ParticipantId만 신뢰한다.
 *
 * ## Identity alias 계약
 *
 * 세션은 canonical `participantId` + alias `participantIds`를 갖는다. identity
 * promotion 후에도 기존 save를 유지하고 논리적 중복 row를 만들지 않기 위해, read/
 * delete/idempotency 판정은 **alias 집합 전체**(`participantIds`)에 대해 수행하고,
 * 새 save row는 **canonical** `participantId`로만 insert한다.
 */
export interface SaveExploreListingParams {
  /** 새 row를 기록할 canonical participant. */
  readonly participantId: ParticipantId;
  /** idempotency 판정 대상 alias 집합(canonical 포함). */
  readonly participantIds: ReadonlyArray<ParticipantId>;
  readonly listingId: ExploreListingId;
  /** ISO UTC. Clock에서 결정한 저장 시각. */
  readonly savedAt: string;
}

export interface ListSavedListingsParams {
  /** 조회 대상 alias 집합(canonical 포함). */
  readonly participantIds: ReadonlyArray<ParticipantId>;
  /** 반환할 최대 row 수. adapter는 nextCursor 계산을 위해 limit+1을 조회한다. */
  readonly limit: number;
  /** 이전 페이지의 마지막 cursor. 없으면 첫 페이지. */
  readonly cursor?: SavedListingCursor;
}

/**
 * saved-list keyset pagination cursor.
 *
 * order는 `savedAt DESC, listingId DESC`이므로 cursor는 마지막으로 본 항목의
 * `(savedAt, listingId)` tuple이다. 이 tuple보다 "더 오래 저장된" row만 다음
 * 페이지로 반환하면 중복/누락 없는 deterministic paging이 된다.
 *
 * ## Alias 중복 제거(dedupe) + savedAt 정책
 *
 * identity promotion 전에 canonical과 alias가 **같은 listing**을 각각 저장했다면
 * alias 집합 조회 시 같은 listing에 대한 row가 2개 이상 나올 수 있다. 이 경우
 * saved-list는 listing당 **정확히 하나**의 논리적 항목만 노출해야 한다(카드 중복 및
 * cursor 오염 방지). adapter는 `(listing_id)` 기준으로 alias row를 grouping해
 * **가장 오래된(원래) savedAt**(`MIN(saved_at)`)을 대표값으로 선택한다. keyset
 * cursor tuple `(savedAt, listingId)`도 이 deduped(대표) savedAt 위에서 동작하므로,
 * 페이지 경계에서 같은 listing이 두 번 나타나지 않는다.
 */
export interface SavedListingCursor {
  readonly savedAt: string;
  readonly listingId: ExploreListingId;
}

/**
 * saved-list 항목. save 시점(`savedAt`)과 **현재** listing(read-through)을 함께
 * 담는다. adapter는 LISTED listing만 join해 반환하므로 UNLISTED/deleted는 제외된다.
 */
export interface SavedListingEntry {
  readonly savedAt: string;
  readonly listing: ExplorePlanListing;
}

export interface ListSavedListingsResult {
  readonly page: ReadonlyArray<SavedListingEntry>;
  readonly nextCursor?: SavedListingCursor;
}

/**
 * Explore save 저장소 port.
 *
 * - `save`: `(participantId, listingId)` composite uniqueness를 이용해 idempotent
 *   하게 저장한다(ON CONFLICT DO NOTHING). alias 집합 중 이미 저장된 row가 있으면
 *   새 row를 만들지 않는다(논리적 중복 방지). 반환값은 "지금 저장돼 있는가"다.
 * - `unsave`: alias 집합 전체에서 해당 listing save를 삭제한다. 대상이 없어도
 *   실패하지 않는다(반복 안전, idempotent).
 * - `isSaved`: alias 집합 중 하나라도 해당 listing을 저장했는지 여부.
 * - `listSaved`: alias 집합의 saved 항목을 LISTED listing과 join해 최신순 페이지로
 *   반환한다(UNLISTED/deleted 제외, read-through).
 */
export class ExploreSaveRepository extends Context.Service<
  ExploreSaveRepository,
  {
    readonly save: (
      params: SaveExploreListingParams
    ) => RepositoryEffect<{ readonly saved: true }>;

    readonly unsave: (params: {
      readonly participantIds: ReadonlyArray<ParticipantId>;
      readonly listingId: ExploreListingId;
    }) => RepositoryEffect<{ readonly saved: false }>;

    readonly isSaved: (params: {
      readonly participantIds: ReadonlyArray<ParticipantId>;
      readonly listingId: ExploreListingId;
    }) => RepositoryEffect<boolean>;

    readonly listSaved: (
      params: ListSavedListingsParams
    ) => RepositoryEffect<ListSavedListingsResult>;
  }
>()("galanda/ports/ExploreSaveRepository") {}
