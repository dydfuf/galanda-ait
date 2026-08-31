import { Context } from "effect";
import type {
  ExploreListingId,
  ParticipantId,
  PlanId,
  Revision,
  TripId,
} from "../domain/ids.ts";
import type { ExplorePlanListing } from "../domain/explore-plan.ts";
import type { ExploreThemeId } from "../domain/explore-theme.ts";
import type {
  NotFoundError,
  RevisionConflictError,
  StateConflictError,
} from "../domain/errors.ts";
import type { RepositoryEffect } from "./repository.ts";

/**
 * Explore listing persistence port (RAON-257 / Goal 14 DISC-2).
 *
 * private persistence record는 public `ExplorePlanListing` envelope에 더해
 * **서버 전용** source reference만 보관한다. 이 source reference는 public
 * projection(`ExplorePlanSnapshot`)에 노출되지 않으며 public DTO와 동일시하지
 * 않는다. source private ID는 repository/use case 내부에서만 사용한다.
 *
 * - `listing`: 공개 가능한 lifecycle envelope + immutable snapshot.
 * - `sourceTripId` / `sourcePlanId` / `sourceAuthorParticipantId`: source
 *   aggregate를 다시 찾기 위한 서버 전용 참조. public read-through를 하지 않고
 *   listing을 relist/auto-unlist 판단하는 use case 내부에서만 쓴다.
 */
export interface ExplorePlanListingRecord {
  readonly listing: ExplorePlanListing;
  readonly sourceTripId: TripId;
  readonly sourcePlanId: PlanId;
  readonly sourceAuthorParticipantId: ParticipantId;
}

/**
 * `listListed` keyset pagination cursor.
 *
 * feed order는 `listedAt DESC, listingId DESC`이므로 cursor는 마지막으로 본
 * row의 `(listedAt, listingId)` tuple이다. 이 tuple보다 "더 오래된" row만
 * 다음 페이지로 반환하면 중복/누락 없는 deterministic paging이 된다.
 */
export interface ExploreListingCursor {
  readonly listedAt: string;
  readonly listingId: ExploreListingId;
}

export interface ExploreListingFilters {
  /** title/destination/route city를 대상으로 하는 case-insensitive literal 검색. */
  readonly query?: string;
  /** 공개 snapshot destination의 case-insensitive literal substring. */
  readonly destination?: string;
  /** 공개 snapshot route city의 case-insensitive literal substring. */
  readonly routeCity?: string;
  /** 공개 snapshot의 server-owned taxonomy stable ID exact match. */
  readonly themeId?: ExploreThemeId;
  /** listing 공개 dateRange가 이 날짜 이후까지 이어져야 한다(overlap lower bound). */
  readonly startDate?: string;
  /** listing 공개 dateRange가 이 날짜 이전에 시작해야 한다(overlap upper bound). */
  readonly endDate?: string;
}

export interface ListListedParams {
  /** 반환할 최대 row 수. adapter는 nextCursor 계산을 위해 limit+1을 조회한다. */
  readonly limit: number;
  /** 이전 페이지의 마지막 cursor. 없으면 첫 페이지. */
  readonly cursor?: ExploreListingCursor;
  /** LISTED public snapshot에만 적용하는 검색/공개 facet 조건. */
  readonly filters?: ExploreListingFilters;
}

export interface ListListedResult {
  /** `listedAt DESC, listingId DESC`로 정렬된 LISTED listing page. */
  readonly page: ReadonlyArray<ExplorePlanListing>;
  /** 다음 페이지가 있으면 마지막 row의 cursor, 없으면 undefined. */
  readonly nextCursor?: ExploreListingCursor;
}

export interface CompareAndSetParams {
  /** 갱신 대상 record 전체(source reference 포함). */
  readonly record: ExplorePlanListingRecord;
  /**
   * CAS가 성공하기 위해 DB에 저장돼 있어야 하는 listing revision.
   * `record.listing.listingRevision`은 이미 증가된 새 revision이다.
   */
  readonly expectedListingRevision: Revision;
}

/**
 * Explore listing 저장소 port.
 *
 * NotFound / RevisionConflict / RepositoryError typed 의미를 유지한다.
 * - NotFoundError: 대상 listing이 없음.
 * - RevisionConflictError: 다른 전이가 먼저 revision을 올린 stale write.
 * - RepositoryError: 인프라 장애 또는 malformed 저장 데이터(fallback 없음).
 */
export class ExplorePlanRepository extends Context.Service<
  ExplorePlanRepository,
  {
    /**
     * 최초 게시. server-only source reference와 함께 새 listing을 저장한다.
     *
     * INSERT는 source `trip_rooms` row를 `SELECT ... FOR UPDATE`로 잠그고 source
     * plan이 기대 revision(`record.listing.snapshot.sourcePlanRevision`)으로
     * 여전히 존재하는지 재검증한 뒤에만 수행하는 단일 transaction이다. 이는
     * delete path(`TripRoomRepository.deletePlanAndAutoUnlist`)의 room CAS와 같은
     * row를 두고 경합해 "source 삭제 → UNLISTED" invariant를 깨는 concurrent
     * first-list race를 차단한다(RAON-244/DISC-10). lock 하에서 source plan이
     * 사라졌거나 revision이 달라졌으면 삭제된 source에 대한 LISTED listing을
     * 만들지 않고 NotFoundError(TripPlan)로 fail-closed한다.
     *
     * INSERT는 unique index(source_trip_id, source_plan_id)에 대해
     * `ON CONFLICT DO NOTHING`으로 수행한다. 같은 source plan을 동시에 게시하려는
     * concurrent first-list(loser)는 conflict를 raw 예외(→ 503)로 흘리지 않고,
     * 같은 transaction에서 기존 row를 다시 읽어 sequential 경로와 동일한 typed
     * 의미로 되돌린다: 기존이 LISTED면 그 immutable listing을 idempotent하게
     * 반환하고(live sync 없음), UNLISTED면 명시적 재게시를 요구하는
     * StateConflictError로 실패한다.
     */
    readonly create: (
      record: ExplorePlanListingRecord
    ) => RepositoryEffect<
      ExplorePlanListing,
      NotFoundError | StateConflictError
    >;

    /** listing ID로 record(공개 envelope + 서버 전용 source ref)를 조회한다. */
    readonly getById: (
      listingId: ExploreListingId
    ) => RepositoryEffect<ExplorePlanListingRecord | undefined>;

    /**
     * source (tripId, planId)로 기존 listing record를 조회한다.
     * relist/중복 게시 판단에 사용하며 server 내부에서만 호출한다.
     */
    readonly findBySource: (
      sourceTripId: TripId,
      sourcePlanId: PlanId
    ) => RepositoryEffect<ExplorePlanListingRecord | undefined>;

    /**
     * source snapshot을 새로 투영해 UNLISTED listing을 재게시한다.
     *
     * 단일 transaction에서 source `trip_rooms` row를 `SELECT ... FOR UPDATE`로
     * 먼저 잠그고, `record.listing.snapshot.sourcePlanRevision`의 source plan이
     * 여전히 존재하는지 재검증한 뒤 listing revision CAS를 수행한다. delete
     * path와 동일한 `room → listing` lock order를 사용해 source 삭제/수정과
     * relist를 직렬화한다. lock 하에서 source가 사라졌거나 revision이 바뀌면
     * listing을 LISTED로 전환하지 않고 NotFoundError(TripPlan)로 fail-closed한다.
     */
    readonly relist: (
      params: CompareAndSetParams
    ) => RepositoryEffect<
      ExplorePlanListing,
      NotFoundError | RevisionConflictError
    >;

    /**
     * listing revision compare-and-set.
     * `WHERE id AND listing_revision = expected` 단일 UPDATE로 lifecycle 전이를
     * atomic하게 적용하고, 실패 시 현재 revision을 조회해 NotFound/Conflict로
     * 분기한다(read-modify-write CAS 우회 금지).
     */
    readonly compareAndSet: (
      params: CompareAndSetParams
    ) => RepositoryEffect<
      ExplorePlanListing,
      NotFoundError | RevisionConflictError
    >;

    /**
     * `LISTED` listing만 `listedAt DESC, listingId DESC`로 keyset paginate한다.
     * UNLISTED row는 제외되며 결과는 deterministic page/nextCursor다.
     */
    readonly listListed: (
      params: ListListedParams
    ) => RepositoryEffect<ListListedResult>;
  }
>()("galanda/ports/ExplorePlanRepository") {}
