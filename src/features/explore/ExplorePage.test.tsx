// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";

import type { ExploreListingItem } from "../../contracts/explore.ts";

vi.mock("./queries.ts", () => ({
  useExploreListingsQuery: vi.fn<(...args: unknown[]) => unknown>(),
  EXPLORE_FEED_PAGE_SIZE: 20,
  exploreKeys: { all: ["explore"], listings: () => ["explore", "listings"] },
}));
vi.mock("../../hooks/useSession.ts", () => ({
  useSessionQuery: vi.fn<(...args: unknown[]) => unknown>(),
}));
vi.mock("./components/ExploreSaveToggle.tsx", () => ({
  ExploreSaveToggle: () => null,
}));

import { useExploreListingsQuery } from "./queries.ts";
import { useSessionQuery } from "../../hooks/useSession.ts";
import { ExplorePage } from "./ExplorePage.tsx";

const mockUseExplore = vi.mocked(useExploreListingsQuery);
const mockUseSession = vi.mocked(useSessionQuery);

const item = (over: { id: string; title?: string }): ExploreListingItem => ({
  listingId: over.id as ExploreListingItem["listingId"],
  status: "LISTED",
  listingRevision: 1 as ExploreListingItem["listingRevision"],
  listedAt: "2026-09-05T00:00:00.000Z",
  updatedAt: "2026-09-05T00:00:00.000Z",
  snapshot: {
    title: over.title ?? "오사카 3박 4일",
    destination: "오사카",
    routes: [
      { city: "오사카", arrivalDate: "2026-09-01", departureDate: "2026-09-03" },
      { city: "교토", arrivalDate: "2026-09-03", departureDate: "2026-09-04" },
    ],
    dateRange: { startDate: "2026-09-01", endDate: "2026-09-04", nightCount: 3 },
    stays: [],
    transports: [],
    author: { displayName: "여행자A" },
    sourcePlanRevision: 3 as ExploreListingItem["snapshot"]["sourcePlanRevision"],
  },
});

const sessionOk = () =>
  mockUseSession.mockReturnValue({
    data: { name: "나" },
    isSuccess: true,
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn<(...args: unknown[]) => unknown>(),
  } as unknown as ReturnType<typeof useSessionQuery>);

const exploreResult = (
  over: Record<string, unknown>,
): ReturnType<typeof useExploreListingsQuery> =>
  ({
    data: undefined,
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn<(...args: unknown[]) => unknown>(),
    fetchNextPage: vi.fn<(...args: unknown[]) => unknown>(),
    hasNextPage: false,
    isFetchingNextPage: false,
    isFetchNextPageError: false,
    ...over,
  }) as unknown as ReturnType<typeof useExploreListingsQuery>;

const LocationProbe = () => {
  const location = useLocation();
  return <output data-testid="location-search">{location.search}</output>;
};

const renderPage = (initialEntry = "/explore") =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <ExplorePage />
      <LocationProbe />
    </MemoryRouter>,
  );

describe("ExplorePage (RAON-260 DISC-4)", () => {
  it("초기 로딩 상태만 배타적으로 노출한다", () => {
    sessionOk();
    mockUseExplore.mockReturnValue(exploreResult({ isPending: true }));
    const { container } = renderPage();
    expect(
      container.querySelector('[data-system-state="loading"]'),
    ).not.toBeNull();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(
      container.querySelector('[data-slot="explore-listing-card"]'),
    ).toBeNull();
  });

  it("빈 결과는 정직한 empty 상태로 노출한다", () => {
    sessionOk();
    mockUseExplore.mockReturnValue(
      exploreResult({ data: { pages: [{ items: [] }], pageParams: [undefined] } }),
    );
    const { container } = renderPage();
    expect(container.querySelector('[data-system-state="empty"]')).not.toBeNull();
    expect(screen.getByText("아직 공개된 여행 일정이 없어요")).toBeVisible();
  });

  it("초기 오류는 error 상태 + 재시도 액션으로 노출한다", () => {
    sessionOk();
    const refetch = vi.fn<(...args: unknown[]) => unknown>();
    mockUseExplore.mockReturnValue(
      exploreResult({ isError: true, error: new Error("boom"), refetch }),
    );
    renderPage();
    expect(screen.getByRole("alert")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("h1→h2→h3 단일 section hierarchy에서 item을 한 번만 렌더링한다", () => {
    sessionOk();
    mockUseExplore.mockReturnValue(
      exploreResult({
        data: {
          pages: [{ items: [item({ id: "l1" })] }],
          pageParams: [undefined],
        },
      }),
    );
    const { container } = renderPage();
    const section = screen.getByRole("region", { name: "새로 공개된 여행 일정" });

    expect(screen.getByRole("heading", { level: 1, name: "탐색" })).toBeVisible();
    expect(
      within(section).getByRole("heading", {
        level: 2,
        name: "새로 공개된 여행 일정",
      }),
    ).toBeVisible();
    expect(
      within(section).getByRole("heading", { level: 3, name: "오사카 3박 4일" }),
    ).toBeVisible();
    expect(screen.getAllByText("오사카 3박 4일")).toHaveLength(1);
    expect(
      container.querySelectorAll('[data-slot="explore-listing-card"]'),
    ).toHaveLength(1);
  });

  it("카드는 실제 공개 필드와 semantic visual만 사용하고 근거 없는 탐색 UI는 만들지 않는다", () => {
    sessionOk();
    mockUseExplore.mockReturnValue(
      exploreResult({
        data: {
          pages: [{ items: [item({ id: "l1" })] }],
          pageParams: [undefined],
        },
      }),
    );
    const { container } = renderPage();
    const card = container.querySelector<HTMLElement>(
      '[data-slot="explore-listing-card"]',
    )!;
    const visual = card.querySelector<HTMLElement>(
      '[data-slot="explore-destination-visual"]',
    )!;

    expect(visual).toHaveClass("bg-primary-muted");
    expect(visual).toHaveTextContent("오사카");
    expect(card).toHaveTextContent("오사카 → 교토");
    expect(card).toHaveTextContent("3박 4일");
    expect(card).toHaveTextContent("여행자A");
    expect(card).toHaveTextContent("공개일 2026.09.05");
    expect(card.querySelector("img")).toBeNull();
    expect(container.querySelector("ol")).toBeNull();
    expect(screen.getByRole("searchbox", { name: "일정 검색" })).toBeVisible();
    expect(container).not.toHaveTextContent(
      /지금 뜨는|인기 도시|순위|가격|인원|알림|전체보기|조회수/,
    );
  });

  it("URL filter를 query에 복원하고 form 변경을 canonical URL과 server query에 반영한다", async () => {
    sessionOk();
    mockUseExplore.mockReturnValue(
      exploreResult({
        data: {
          pages: [{ items: [item({ id: "l1" })] }],
          pageParams: [undefined],
        },
      })
    );

    renderPage(
      "/explore?query=%20%20%EC%98%A4%EC%82%AC%EC%B9%B4%20%20&destination=%EC%9D%BC%EB%B3%B8&themeId=food&startDate=2026-09-01"
    );

    expect(screen.getByRole("searchbox", { name: "일정 검색" })).toHaveValue(
      "오사카"
    );
    expect(screen.getByLabelText("목적지")).toHaveValue("일본");
    expect(screen.getByRole("button", { name: "미식" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByLabelText("겹치는 기간 시작일")).toHaveValue(
      "2026-09-01"
    );
    expect(mockUseExplore).toHaveBeenLastCalledWith({
      query: "오사카",
      destination: "일본",
      routeCity: undefined,
      themeId: "food",
      startDate: "2026-09-01",
      endDate: undefined,
    });

    await waitFor(() =>
      expect(screen.getByTestId("location-search")).toHaveTextContent(
        "query=%EC%98%A4%EC%82%AC%EC%B9%B4"
      )
    );

    fireEvent.change(screen.getByLabelText("경유 도시"), {
      target: { value: "교토" },
    });
    const submitButton = screen.getByRole("button", { name: "검색하기" });
    submitButton.focus();
    fireEvent.click(submitButton);

    await waitFor(() =>
      expect(screen.getByTestId("location-search")).toHaveTextContent(
        "routeCity=%EA%B5%90%ED%86%A0"
      )
    );
    expect(submitButton).toHaveFocus();
    expect(mockUseExplore).toHaveBeenLastCalledWith({
      query: "오사카",
      destination: "일본",
      routeCity: "교토",
      themeId: "food",
      startDate: "2026-09-01",
      endDate: undefined,
    });

    const resetButton = screen.getByRole("button", { name: "초기화" });
    resetButton.focus();
    fireEvent.click(resetButton);
    await waitFor(() =>
      expect(screen.getByTestId("location-search").textContent).toBe("")
    );
    expect(resetButton).toHaveFocus();
  });

  it("hasNextPage면 '더 보기'로 다음 페이지를 요청한다", () => {
    sessionOk();
    const fetchNextPage = vi.fn<(...args: unknown[]) => unknown>();
    mockUseExplore.mockReturnValue(
      exploreResult({
        data: { pages: [{ items: [item({ id: "l1" })] }], pageParams: [undefined] },
        hasNextPage: true,
        fetchNextPage,
      }),
    );
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "더 보기" }));
    expect(fetchNextPage).toHaveBeenCalledTimes(1);
  });

  it("다음 페이지 로딩 중에도 기존 행을 보존하고 별도 로딩 표시를 낸다", () => {
    sessionOk();
    mockUseExplore.mockReturnValue(
      exploreResult({
        data: { pages: [{ items: [item({ id: "l1" })] }], pageParams: [undefined] },
        hasNextPage: true,
        isFetchingNextPage: true,
      }),
    );
    const { container } = renderPage();
    expect(
      container.querySelector('[data-slot="explore-listing-card"]'),
    ).not.toBeNull();
    expect(screen.getByText("더 불러오는 중이에요.")).toBeVisible();
    expect(container.querySelector('[data-system-state="loading"]')).toBeNull();
  });

  it("다음 페이지 오류는 기존 행을 유지한 채 별도 재시도를 제공한다", () => {
    sessionOk();
    const fetchNextPage = vi.fn<(...args: unknown[]) => unknown>();
    mockUseExplore.mockReturnValue(
      exploreResult({
        data: { pages: [{ items: [item({ id: "l1" })] }], pageParams: [undefined] },
        hasNextPage: true,
        isError: true,
        isFetchNextPageError: true,
        error: new Error("next boom"),
        fetchNextPage,
      }),
    );
    const { container } = renderPage();
    expect(
      container.querySelector('[data-slot="explore-listing-card"]'),
    ).not.toBeNull();
    expect(container.querySelector('[data-system-state="error"]')).toBeNull();
    expect(screen.getByRole("alert")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(fetchNextPage).toHaveBeenCalledTimes(1);
  });

  it("세션 조회 실패는 로그인 오류로 구분해 안내한다", () => {
    mockUseSession.mockReturnValue({
      data: null,
      isSuccess: false,
      isPending: false,
      isError: true,
      error: new Error("session down"),
      refetch: vi.fn<(...args: unknown[]) => unknown>(),
    } as unknown as ReturnType<typeof useSessionQuery>);
    mockUseExplore.mockReturnValue(exploreResult({ isPending: true }));
    renderPage();
    expect(screen.getByText("로그인 정보를 확인할 수 없어요")).toBeVisible();
  });
});
