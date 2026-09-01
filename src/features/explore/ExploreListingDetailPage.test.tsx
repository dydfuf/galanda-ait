// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import type { ExploreListingItem } from "../../contracts/explore.ts";
import { ApiClientError } from "../../app/api-client.ts";

vi.mock("./queries.ts", () => ({
  useExploreListingDetailQuery: vi.fn(),
}));
vi.mock("../../hooks/useSession.ts", () => ({
  useSessionQuery: vi.fn(),
}));
vi.mock("./components/ExploreSaveToggle.tsx", () => ({
  ExploreSaveToggle: () => null,
}));
vi.mock("./components/ExploreImportAction.tsx", () => ({
  ExploreImportAction: () => (
    <button type="button" data-slot="explore-import-action">
      내 여행으로 가져오기
    </button>
  ),
}));
const goBack = vi.fn();
vi.mock("../../hooks/useAppNavigation.ts", () => ({
  useAppNavigation: vi.fn(),
}));

import { useExploreListingDetailQuery } from "./queries.ts";
import { useSessionQuery } from "../../hooks/useSession.ts";
import { useAppNavigation } from "../../hooks/useAppNavigation.ts";
import { ExploreListingDetailPage } from "./ExploreListingDetailPage.tsx";

const mockDetail = vi.mocked(useExploreListingDetailQuery);
const mockSession = vi.mocked(useSessionQuery);
const mockNav = vi.mocked(useAppNavigation);

const listing = (): ExploreListingItem => ({
  listingId: "listing-1" as ExploreListingItem["listingId"],
  status: "LISTED",
  listingRevision: 1 as ExploreListingItem["listingRevision"],
  saveCount: 0,
  listedAt: "2026-09-05T00:00:00.000Z",
  updatedAt: "2026-09-05T00:00:00.000Z",
  snapshot: {
    title: "오사카 3박 4일",
    destination: "오사카",
    routes: [
      { city: "오사카", arrivalDate: "2026-09-01", departureDate: "2026-09-04" },
    ],
    dateRange: { startDate: "2026-09-01", endDate: "2026-09-04", nightCount: 3 },
    stays: [],
    transports: [],
    author: { displayName: "여행자A" },
    sourcePlanRevision: 3 as ExploreListingItem["snapshot"]["sourcePlanRevision"],
  },
});

const sessionOk = () =>
  mockSession.mockReturnValue({
    data: { name: "나" },
    isSuccess: true,
    isError: false,
    error: null,
  } as unknown as ReturnType<typeof useSessionQuery>);

const detailResult = (
  over: Record<string, unknown>
): ReturnType<typeof useExploreListingDetailQuery> =>
  ({
    data: undefined,
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    ...over,
  }) as unknown as ReturnType<typeof useExploreListingDetailQuery>;

const setNav = (platformNavigation?: unknown) => {
  goBack.mockClear();
  mockNav.mockReturnValue({
    navigate: vi.fn(),
    goBack,
    location: { pathname: "/explore/listing-1" },
    platformNavigation,
  } as unknown as ReturnType<typeof useAppNavigation>);
};

const renderAt = (path = "/explore/listing-1") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/explore/:listingId" element={<ExploreListingDetailPage />} />
      </Routes>
    </MemoryRouter>
  );

describe("ExploreListingDetailPage (RAON-263 DISC-5)", () => {
  it("로딩 상태를 배타적으로 노출한다", () => {
    sessionOk();
    setNav();
    mockDetail.mockReturnValue(detailResult({ isPending: true }));
    const { container } = renderAt();
    expect(
      container.querySelector('[data-system-state="loading"]')
    ).not.toBeNull();
  });

  it("LISTED detail을 공개 필드로 렌더하고 nav DOM이 없다(Global shell 밖)", () => {
    sessionOk();
    setNav();
    mockDetail.mockReturnValue(detailResult({ data: listing() }));
    const { container } = renderAt();
    expect(
      container.querySelector('[data-slot="explore-listing-detail"]')
    ).not.toBeNull();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "오사카 3박 4일"
    );
    // Global bottom nav landmark가 없어야 한다.
    expect(
      screen.queryByRole("navigation", { name: "주요 화면" })
    ).not.toBeInTheDocument();
    // DISC-6/8: save + import action slot이 주입된다(더 이상 비어 있지 않다).
    expect(
      container.querySelector('[data-slot="explore-listing-detail-action"]')
    ).not.toBeNull();
    expect(
      container.querySelector('[data-slot="explore-import-action"]')
    ).not.toBeNull();
  });

  it("Web에서는 PageHeader back을 렌더하고 클릭 시 /explore fallback으로 goBack한다", () => {
    sessionOk();
    setNav(undefined); // platformNavigation 없음 → Web
    mockDetail.mockReturnValue(detailResult({ data: listing() }));
    renderAt();
    const back = screen.getByRole("button", { name: "뒤로 가기" });
    fireEvent.click(back);
    expect(goBack).toHaveBeenCalledWith("/explore");
  });

  it("AIT(platformNavigation)에서는 Web header를 렌더하지 않는다(native ownership)", () => {
    sessionOk();
    setNav({ setAccessoryButtons: vi.fn() }); // platformNavigation 존재 → AIT
    mockDetail.mockReturnValue(detailResult({ data: listing() }));
    renderAt();
    expect(
      screen.queryByRole("button", { name: "뒤로 가기" })
    ).not.toBeInTheDocument();
  });

  it("410(LISTING_UNAVAILABLE)은 unavailable 상태로 구분해 안내한다", () => {
    sessionOk();
    setNav();
    mockDetail.mockReturnValue(
      detailResult({
        isError: true,
        error: new ApiClientError({
          status: 410,
          message: "gone",
          code: "LISTING_UNAVAILABLE",
        }),
      })
    );
    renderAt();
    expect(screen.getByText("공개가 중단된 여행 일정이에요")).toBeVisible();
  });

  it("404는 not-found 상태로 구분해 안내한다", () => {
    sessionOk();
    setNav();
    mockDetail.mockReturnValue(
      detailResult({
        isError: true,
        error: new ApiClientError({ status: 404, message: "nf", code: "NOT_FOUND" }),
      })
    );
    renderAt();
    expect(screen.getByText("여행 일정을 찾을 수 없어요")).toBeVisible();
  });

  it("그 외 오류는 재시도 가능한 error 상태로 안내한다", () => {
    sessionOk();
    setNav();
    const refetch = vi.fn();
    mockDetail.mockReturnValue(
      detailResult({
        isError: true,
        error: new ApiClientError({ status: 503, message: "down" }),
        refetch,
      })
    );
    renderAt();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("세션 조회 실패는 로그인 오류로 구분해 안내한다", () => {
    mockSession.mockReturnValue({
      data: null,
      isSuccess: false,
      isError: true,
      error: new Error("session down"),
    } as unknown as ReturnType<typeof useSessionQuery>);
    setNav();
    mockDetail.mockReturnValue(detailResult({ isPending: true }));
    renderAt();
    expect(screen.getByText("로그인 정보를 확인할 수 없어요")).toBeVisible();
  });
});
