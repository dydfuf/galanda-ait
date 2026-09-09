// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";

import type { ExploreListingItem, ExploreListingsResponse } from "../../contracts/explore.ts";
import { ExploreListingIdSchema, RevisionSchema } from "../../core/domain/ids.ts";
import type { useSessionQuery } from "../../hooks/useSession.ts";
import type { useExploreListingsQuery, useExplorePopularCitiesQuery } from "./queries.ts";

// Mock only the hook fields this page consumes; response fixtures remain fully typed.
type FeedState = Pick<ReturnType<typeof useExploreListingsQuery>,
  "data" | "isPending" | "isError" | "error" | "refetch" | "fetchNextPage" |
  "hasNextPage" | "isFetchingNextPage" | "isFetchNextPageError">;
type SessionState = Pick<ReturnType<typeof useSessionQuery>, "isError" | "error" | "refetch">;
type PopularState = Pick<ReturnType<typeof useExplorePopularCitiesQuery>, "data" | "isError">;

const mocks = vi.hoisted(() => ({
  feed: vi.fn<(...args: Parameters<typeof useExploreListingsQuery>) => FeedState>(),
  session: vi.fn<() => SessionState>(),
  popular: vi.fn<() => PopularState>(),
  refetch: vi.fn<FeedState["refetch"]>(),
  fetchNextPage: vi.fn<FeedState["fetchNextPage"]>(),
  refetchSession: vi.fn<SessionState["refetch"]>(),
}));

vi.mock("./queries.ts", () => ({
  useExploreListingsQuery: mocks.feed,
  useExplorePopularCitiesQuery: mocks.popular,
  EXPLORE_FEED_PAGE_SIZE: 20,
  exploreKeys: {
    all: ["explore"],
    listings: () => ["explore", "listings"],
    popularCities: () => ["explore", "popular-cities"],
  },
}));
vi.mock("../../hooks/useSession.ts", () => ({ useSessionQuery: mocks.session }));
// Save mutation coverage belongs to ExploreSaveToggle's existing tests.
vi.mock("./components/ExploreSaveToggle.tsx", () => ({ ExploreSaveToggle: () => null }));

import { ExplorePage } from "./ExplorePage.tsx";

const listing: ExploreListingItem = {
  listingId: ExploreListingIdSchema.make("listing-spots"),
  status: "LISTED",
  listingRevision: RevisionSchema.make(1),
  saveCount: 0,
  listedAt: "2026-09-05T00:00:00.000Z",
  updatedAt: "2026-09-05T00:00:00.000Z",
  snapshot: {
    title: "오사카 3박 4일",
    destination: "오사카",
    routes: [
      { city: "오사카", arrivalDate: "2026-12-01", departureDate: "2026-12-03" },
      { city: "교토", arrivalDate: "2026-12-03", departureDate: "2026-12-04" },
    ],
    dateRange: { startDate: "2026-12-01", endDate: "2026-12-04", nightCount: 3 },
    stays: [],
    transports: [],
    author: { displayName: "여행자" },
    sourcePlanRevision: RevisionSchema.make(1),
  },
};

const pageData = (items: readonly ExploreListingItem[] = []): NonNullable<FeedState["data"]> => {
  const page: ExploreListingsResponse = { items, rankingMode: "RECENCY_FALLBACK" };
  return { pages: [page], pageParams: [undefined] };
};
const setFeed = (overrides: Partial<FeedState> = {}) => mocks.feed.mockReturnValue({
  data: pageData(),
  isPending: false,
  isError: false,
  error: null,
  refetch: mocks.refetch,
  fetchNextPage: mocks.fetchNextPage,
  hasNextPage: false,
  isFetchingNextPage: false,
  isFetchNextPageError: false,
  ...overrides,
});

function LocationProbe() {
  return <output data-testid="location-search">{useLocation().search}</output>;
}
const view = (entry = "/explore") => (
  <MemoryRouter initialEntries={[entry]}>
    <ExplorePage />
    <LocationProbe />
  </MemoryRouter>
);
const spot = (container: HTMLElement) => container.querySelector('[data-slot="galanda-spot"]');

beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockReturnValue({ isError: false, error: null, refetch: mocks.refetchSession });
  mocks.popular.mockReturnValue({ data: { items: [] }, isError: false });
  setFeed();
});
afterEach(cleanup);

describe("ExplorePage empty-state illustrations", () => {
  it("uses the decorative exploration illustration only for an unfiltered empty result", () => {
    const { container } = render(view());
    expect(spot(container)).toHaveAttribute("data-spot", "empty-explore");
    expect(spot(container)).toHaveAttribute("aria-hidden", "true");
    expect(spot(container)).toHaveClass("size-32", "shrink-0");
    expect(screen.getByText("아직 공개된 여행 일정이 없어요")).toBeVisible();
    expect(screen.queryByRole("button", { name: "필터 초기화" })).not.toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    for (const image of spot(container)!.querySelectorAll("img")) {
      expect(image).toHaveAttribute("width", "128");
      expect(image).toHaveAttribute("height", "128");
      expect(image).toHaveAttribute("alt", "");
    }
  });

  it.each([
    "query=beach", "destination=Osaka", "routeCity=Kyoto", "cityId=osaka",
    "startDate=2026-12-01", "endDate=2026-12-04",
  ])("uses the search illustration for the applied filter %s", (search) => {
    const { container } = render(view(`/explore?${search}`));
    expect(spot(container)).toHaveAttribute("data-spot", "empty-search");
    expect(screen.getByText("조건에 맞는 여행 일정이 없어요")).toBeVisible();
    expect(screen.getByRole("button", { name: "필터 초기화" })).toBeVisible();
  });

  it("does not confuse edited or cleared drafts with the submitted query", async () => {
    const { container } = render(view());
    const input = screen.getByRole("searchbox", { name: "일정 검색" });
    const form = screen.getByRole("form", { name: "공개 여행 일정 검색" });
    fireEvent.change(input, { target: { value: "beach" } });
    expect(spot(container)).toHaveAttribute("data-spot", "empty-explore");
    expect(screen.getByTestId("location-search")).toHaveTextContent(/^$/);
    fireEvent.submit(form);
    await waitFor(() => expect(spot(container)).toHaveAttribute("data-spot", "empty-search"));
    expect(screen.getByTestId("location-search")).toHaveTextContent("query=beach");
    fireEvent.change(input, { target: { value: "" } });
    expect(spot(container)).toHaveAttribute("data-spot", "empty-search");
    fireEvent.submit(form);
    await waitFor(() => expect(spot(container)).toHaveAttribute("data-spot", "empty-explore"));
    expect(screen.getByTestId("location-search")).toHaveTextContent(/^$/);
    expect(screen.getByRole("searchbox", { name: "일정 검색" })).toBe(input);
  });

  it("preserves the existing empty-result reset action, URL and query normalization", async () => {
    const { container } = render(view("/explore?query=beach&cityId=osaka"));
    fireEvent.click(screen.getByRole("button", { name: "필터 초기화" }));
    await waitFor(() => expect(spot(container)).toHaveAttribute("data-spot", "empty-explore"));
    expect(screen.getByTestId("location-search")).toHaveTextContent(/^$/);
    expect(screen.getByRole("searchbox", { name: "일정 검색" })).toHaveValue("");
    expect(mocks.feed).toHaveBeenLastCalledWith({
      query: undefined, destination: undefined, routeCity: undefined, cityId: undefined,
      themeId: undefined, startDate: undefined, endDate: undefined,
    });
  });

  it("does not treat whitespace or an invalid city URL as an applied filter", async () => {
    const { container } = render(view("/explore?query=%20%20&cityId=not-a-city"));
    await waitFor(() => expect(screen.getByTestId("location-search")).toHaveTextContent(/^$/));
    expect(spot(container)).toHaveAttribute("data-spot", "empty-explore");
  });

  it("keeps loading separate even when the applied URL contains a query", () => {
    setFeed({ data: undefined, isPending: true });
    const { container } = render(view("/explore?query=beach"));
    expect(container.querySelector('[data-system-state="loading"]')).not.toBeNull();
    expect(spot(container)).toBeNull();
    expect(screen.queryByText("조건에 맞는 여행 일정이 없어요")).not.toBeInTheDocument();
  });

  it.each([false, true])("keeps fetch failure retryable without an empty picture (cached empty: %s)", (cached) => {
    setFeed({ data: cached ? pageData() : undefined, isError: true, error: new Error("조회 실패") });
    const { container } = render(view());
    expect(spot(container)).toBeNull();
    expect(screen.getByText("여행 일정을 불러오지 못했어요")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(mocks.refetch).toHaveBeenCalledTimes(1);
  });

  it("keeps session failure ahead of an otherwise empty feed", () => {
    mocks.session.mockReturnValue({ isError: true, error: new Error("세션 실패"), refetch: mocks.refetchSession });
    const { container } = render(view());
    expect(spot(container)).toBeNull();
    expect(screen.getByText("로그인 정보를 확인할 수 없어요")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(mocks.refetchSession).toHaveBeenCalledTimes(1);
    expect(mocks.refetch).not.toHaveBeenCalled();
  });

  it("keeps existing listings and the next-page action instead of showing an empty picture", () => {
    setFeed({ data: pageData([listing]), hasNextPage: true });
    const { container } = render(view());
    expect(spot(container)).toBeNull();
    expect(screen.getByText("오사카 3박 4일")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "더 보기" }));
    expect(mocks.fetchNextPage).toHaveBeenCalledTimes(1);
  });

  it("does not replace cached listings during next-page loading or failure", () => {
    setFeed({ data: pageData([listing]), hasNextPage: true, isFetchingNextPage: true });
    const { container, rerender } = render(view());
    expect(spot(container)).toBeNull();
    expect(screen.getByText("더 불러오는 중이에요.")).toBeVisible();
    setFeed({ data: pageData([listing]), hasNextPage: true, isError: true,
      isFetchNextPageError: true, error: new Error("다음 페이지 실패") });
    rerender(view());
    expect(spot(container)).toBeNull();
    expect(screen.getByText("오사카 3박 4일")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(mocks.fetchNextPage).toHaveBeenCalledTimes(1);
  });

  it("mounts an empty picture after loading and removes it when results arrive", () => {
    setFeed({ data: undefined, isPending: true });
    const { container, rerender } = render(view());
    expect(spot(container)).toBeNull();
    setFeed();
    rerender(view());
    expect(spot(container)).toHaveAttribute("data-spot", "empty-explore");
    setFeed({ data: pageData([listing]) });
    rerender(view());
    expect(spot(container)).toBeNull();
    expect(screen.getByText("오사카 3박 4일")).toBeVisible();
  });
});
