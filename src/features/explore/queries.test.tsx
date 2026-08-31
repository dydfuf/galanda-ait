// @vitest-environment jsdom
import type { PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../app/api-client.ts", () => ({
  getExplorePopularCities: vi.fn(),
  getExploreListingDetail: vi.fn(),
  getExploreListings: vi.fn(),
}));
vi.mock("../../hooks/useSession.ts", () => ({
  useSessionQuery: vi.fn(),
}));

import {
  getExplorePopularCities,
  getExploreListingDetail,
  getExploreListings,
} from "../../app/api-client.ts";
import type { ExploreListingId } from "../../core/domain/ids.ts";
import { useSessionQuery } from "../../hooks/useSession.ts";
import {
  EXPLORE_FEED_PAGE_SIZE,
  exploreKeys,
  useExploreListingDetailQuery,
  useExplorePopularCitiesQuery,
  useExploreListingsQuery,
} from "./queries.ts";

const mockGetDetail = vi.mocked(getExploreListingDetail);
const mockGetListings = vi.mocked(getExploreListings);
const mockGetPopularCities = vi.mocked(getExplorePopularCities);
const mockUseSession = vi.mocked(useSessionQuery);

const makeWrapper = (queryClient: QueryClient) =>
  ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

beforeEach(() => {
  mockGetDetail.mockReset();
  mockGetListings.mockReset();
  mockGetPopularCities.mockReset();
  mockUseSession.mockReturnValue({
    isSuccess: true,
  } as ReturnType<typeof useSessionQuery>);
});

describe("useExploreListingsQuery (RAON-270)", () => {
  it("normalized filter를 cache key와 모든 page request에 동일하게 사용한다", async () => {
    mockGetListings
      .mockResolvedValueOnce({ items: [], nextCursor: "cursor-1" })
      .mockResolvedValueOnce({ items: [] });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const { result } = renderHook(
      () =>
        useExploreListingsQuery({
          query: "  오사카  ",
          destination: " 일본 ",
          routeCity: " 교토 ",
          themeId: "food",
          startDate: "2026-09-01",
          endDate: "2026-09-30",
        }),
      { wrapper: makeWrapper(queryClient) }
    );

    await waitFor(() => expect(mockGetListings).toHaveBeenCalledTimes(1));
    expect(mockGetListings).toHaveBeenCalledWith(
      {
        query: "오사카",
        destination: "일본",
        routeCity: "교토",
        themeId: "food",
        startDate: "2026-09-01",
        endDate: "2026-09-30",
        limit: EXPLORE_FEED_PAGE_SIZE,
        cursor: undefined,
      },
      expect.any(AbortSignal)
    );
    expect(queryClient.getQueryCache().getAll()[0]?.queryKey).toEqual(
      exploreKeys.listings({
        query: "오사카",
        destination: "일본",
        routeCity: "교토",
        themeId: "food",
        startDate: "2026-09-01",
        endDate: "2026-09-30",
      })
    );

    await result.current.fetchNextPage();
    await waitFor(() => expect(mockGetListings).toHaveBeenCalledTimes(2));
    expect(mockGetListings).toHaveBeenNthCalledWith(
      2,
      {
        query: "오사카",
        destination: "일본",
        routeCity: "교토",
        themeId: "food",
        startDate: "2026-09-01",
        endDate: "2026-09-30",
        limit: EXPLORE_FEED_PAGE_SIZE,
        cursor: "cursor-1",
      },
      expect.any(AbortSignal)
    );
  });

  it("filter가 다르면 cache key를 분리한다", () => {
    expect(exploreKeys.listings({ destination: "오사카" })).not.toEqual(
      exploreKeys.listings({ destination: "제주" })
    );
    expect(exploreKeys.listings({ themeId: "food" })).not.toEqual(
      exploreKeys.listings({ themeId: "nature" })
    );
  });
});

describe("useExplorePopularCitiesQuery (RAON-272)", () => {
  it("feed와 별도 key로 limit 없는 aggregate endpoint를 조회한다", async () => {
    mockGetPopularCities.mockResolvedValue({
      items: [{ cityId: "osaka", listingCount: 3 }],
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    renderHook(() => useExplorePopularCitiesQuery(), {
      wrapper: makeWrapper(queryClient),
    });

    await waitFor(() => expect(mockGetPopularCities).toHaveBeenCalledTimes(1));
    expect(mockGetPopularCities).toHaveBeenCalledWith(expect.any(AbortSignal));
    expect(queryClient.getQueryCache().getAll()[0]?.queryKey).toEqual(
      exploreKeys.popularCities()
    );
  });
});

describe("useExploreListingDetailQuery", () => {
  it("listingId가 없으면 session이 준비돼도 detail endpoint를 호출하지 않는다", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const { result } = renderHook(
      () => useExploreListingDetailQuery("" as ExploreListingId),
      { wrapper: makeWrapper(queryClient) }
    );

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockGetDetail).not.toHaveBeenCalled();
  });
});
