// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import type { ExploreListingItem } from "../../contracts/explore.ts";

vi.mock("./queries.ts", () => ({
  useExploreListingsQuery: vi.fn(),
  EXPLORE_FEED_PAGE_SIZE: 20,
  exploreKeys: { all: ["explore"], listings: () => ["explore", "listings"] },
}));
vi.mock("../../hooks/useSession.ts", () => ({
  useSessionQuery: vi.fn(),
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
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useSessionQuery>);

const exploreResult = (
  over: Record<string, unknown>
): ReturnType<typeof useExploreListingsQuery> =>
  ({
    data: undefined,
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    isFetchNextPageError: false,
    ...over,
  }) as unknown as ReturnType<typeof useExploreListingsQuery>;

const renderPage = () =>
  render(
    <MemoryRouter>
      <ExplorePage />
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
    const refetch = vi.fn();
    mockUseExplore.mockReturnValue(
      exploreResult({ isError: true, error: new Error("boom"), refetch }),
    );
    renderPage();
    expect(screen.getByRole("alert")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("카드는 공개 필드(제목/경로/기간/작성자)만 렌더링한다", () => {
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
    const card = container.querySelector('[data-slot="explore-listing-card"]')!;
    expect(within(card as HTMLElement).getByRole("heading", { level: 3 })).toHaveTextContent(
      "오사카 3박 4일",
    );
    expect(card.textContent).toContain("오사카 → 교토");
    expect(card.textContent).toContain("3박 4일");
    expect(card.textContent).toContain("여행자A");
    // fake popularity/image/count 없음.
    expect(card.querySelector("img")).toBeNull();
    expect(card.textContent).not.toMatch(/저장|인기|조회수/);
  });

  it("hasNextPage면 '더 보기'로 다음 페이지를 요청한다", () => {
    sessionOk();
    const fetchNextPage = vi.fn();
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
    // 기존 카드 유지.
    expect(
      container.querySelector('[data-slot="explore-listing-card"]'),
    ).not.toBeNull();
    expect(screen.getByText("더 불러오는 중이에요.")).toBeVisible();
    // 초기 로딩 상태와 섞이지 않는다.
    expect(container.querySelector('[data-system-state="loading"]')).toBeNull();
  });

  it("다음 페이지 오류는 기존 행을 유지한 채 별도 재시도를 제공한다", () => {
    sessionOk();
    const fetchNextPage = vi.fn();
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
    // 기존 카드 유지 + 초기 error 상태로 대체되지 않음.
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
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useSessionQuery>);
    mockUseExplore.mockReturnValue(exploreResult({ isPending: true }));
    renderPage();
    expect(screen.getByText("로그인 정보를 확인할 수 없어요")).toBeVisible();
  });
});
