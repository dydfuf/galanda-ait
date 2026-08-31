import { useInfiniteQuery, useQuery, type InfiniteData } from "@tanstack/react-query";

import {
  getExplorePopularCities,
  getExploreListingDetail,
  getExploreListings,
} from "../../app/api-client.ts";
import type { ExploreListingId } from "../../core/domain/ids.ts";
import {
  normalizeExploreListingsFilters,
  type ExploreListingDetailResponse,
  type ExploreListingsFilters,
  type ExploreListingsResponse,
  type ExplorePopularCitiesResponse,
} from "../../contracts/explore.ts";
import { useSessionQuery } from "../../hooks/useSession.ts";

/** 한 페이지 크기. 서버 상한(EXPLORE_LISTINGS_MAX_LIMIT=50) 안이다. */
export const EXPLORE_FEED_PAGE_SIZE = 20;

export const exploreKeys = {
  all: ["explore"] as const,
  listings: (filters: ExploreListingsFilters = {}) =>
    [
      ...exploreKeys.all,
      "listings",
      normalizeExploreListingsFilters(filters),
    ] as const,
  popularCities: () => [...exploreKeys.all, "popular-cities"] as const,
  detail: (
    listingId: ExploreListingId
  ): readonly ["explore", "detail", ExploreListingId] =>
    [...exploreKeys.all, "detail", listingId] as const,
};

type ExploreCursor = string | undefined;
type ExploreListingsKey = ReturnType<typeof exploreKeys.listings>;

/**
 * Explore 공개 feed infinite query (RAON-260 DISC-4, RAON-270 DISC-F1).
 *
 * - session이 준비된 뒤에만 활성화한다(feed는 authenticated session을 요구).
 * - normalized filter를 query key와 모든 page 요청에 함께 넣어 조건별 cache/cursor가
 *   섞이지 않게 한다.
 * - keyset pagination: 서버가 준 opaque `nextCursor`를 다음 페이지 param으로 쓴다.
 *   `nextCursor`가 없으면 마지막 페이지다.
 * - decode/at-boundary 검증은 api-client가 담당한다.
 */
export const useExploreListingsQuery = (
  filters: ExploreListingsFilters = {}
) => {
  const { isSuccess: isSessionReady } = useSessionQuery();
  const normalizedFilters = normalizeExploreListingsFilters(filters);

  return useInfiniteQuery<
    ExploreListingsResponse,
    Error,
    InfiniteData<ExploreListingsResponse, ExploreCursor>,
    ExploreListingsKey,
    ExploreCursor
  >({
    queryKey: exploreKeys.listings(normalizedFilters),
    initialPageParam: undefined,
    queryFn: ({ pageParam, signal }) =>
      getExploreListings(
        {
          ...normalizedFilters,
          limit: EXPLORE_FEED_PAGE_SIZE,
          cursor: pageParam,
        },
        signal
      ),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: isSessionReady,
  });
};

/** Explore 인기 도시 aggregate. Feed와 독립된 cache/query 상태를 사용한다. */
export const useExplorePopularCitiesQuery = () => {
  const { isSuccess: isSessionReady } = useSessionQuery();

  return useQuery<ExplorePopularCitiesResponse, Error>({
    queryKey: exploreKeys.popularCities(),
    queryFn: ({ signal }) => getExplorePopularCities(signal),
    enabled: isSessionReady,
  });
};

/**
 * Explore 단건 detail query (RAON-263 DISC-5).
 *
 * - session이 준비된 뒤에만 활성화한다(detail도 authenticated session을 요구).
 * - `listingId`로 keyed되어 있어 카드마다 독립적으로 캐시된다.
 * - detail endpoint(`/api/explore/listings/:listingId`)만 호출한다. source
 *   private Trip/Plan route는 절대 호출하지 않는다.
 * - unlisted/deleted/invalid는 api-client가 `ApiClientError`(410/404)로 던지므로
 *   호출 화면이 unavailable/not-found/error를 구분한다. QueryClient는 retry를
 *   비활성화하므로 410/404가 무한 재시도되지 않는다.
 */
export const useExploreListingDetailQuery = (listingId: ExploreListingId) => {
  const { isSuccess: isSessionReady } = useSessionQuery();

  return useQuery<ExploreListingDetailResponse, Error>({
    queryKey: exploreKeys.detail(listingId),
    queryFn: ({ signal }) => getExploreListingDetail(listingId, signal),
    enabled: Boolean(listingId) && isSessionReady,
  });
};
