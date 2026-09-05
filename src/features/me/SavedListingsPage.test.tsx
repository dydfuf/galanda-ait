// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import type { SavedListingItem } from "../../contracts/explore-save.ts";

vi.mock("../explore/save-queries.ts", () => ({
  useSavedListingsQuery: vi.fn(),
  SAVED_FEED_PAGE_SIZE: 20,
}));
vi.mock("../../hooks/useSession.ts", () => ({
  useSessionQuery: vi.fn(),
}));
// 카드 내부 save toggle은 별도 유닛으로 검증하므로 여기서는 렌더만 확인.
vi.mock("../explore/components/ExploreSaveToggle.tsx", () => ({
  ExploreSaveToggle: () => null,
}));

import { useSavedListingsQuery } from "../explore/save-queries.ts";
import { useSessionQuery } from "../../hooks/useSession.ts";
import { SavedListingsPage } from "./SavedListingsPage.tsx";

const mockSaved = vi.mocked(useSavedListingsQuery);
const mockSession = vi.mocked(useSessionQuery);

const savedItem = (id: string, title: string): SavedListingItem => ({
  savedAt: "2026-09-06T00:00:00.000Z",
  listing: {
    listingId: id as SavedListingItem["listing"]["listingId"],
    status: "LISTED",
    listingRevision: 1 as SavedListingItem["listing"]["listingRevision"],
    saveCount: 0,
    listedAt: "2026-09-05T00:00:00.000Z",
    updatedAt: "2026-09-05T00:00:00.000Z",
    snapshot: {
      title,
      destination: "오사카",
      routes: [
        { city: "오사카", arrivalDate: "2026-09-01", departureDate: "2026-09-04" },
      ],
      dateRange: {
        startDate: "2026-09-01",
        endDate: "2026-09-04",
        nightCount: 3,
      },
      stays: [],
      transports: [],
      author: { displayName: "여행자A" },
      sourcePlanRevision:
        3 as SavedListingItem["listing"]["snapshot"]["sourcePlanRevision"],
    },
  },
});

const sessionOk = () =>
  mockSession.mockReturnValue({
    data: { name: "나" },
    isSuccess: true,
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useSessionQuery>);

const result = (over: Partial<ReturnType<typeof useSavedListingsQuery>>) =>
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
  }) as unknown as ReturnType<typeof useSavedListingsQuery>;

const renderPage = () =>
  render(
    <MemoryRouter>
      <SavedListingsPage />
    </MemoryRouter>
  );

describe("SavedListingsPage (RAON-254 DISC-6)", () => {
  it("저장 항목이 없으면 정직한 empty 상태를 노출한다", () => {
    sessionOk();
    mockSaved.mockReturnValue(
      result({ data: { pages: [{ items: [] }], pageParams: [undefined] } })
    );
    const { container } = renderPage();
    expect(screen.getByText("아직 저장한 여행 일정이 없어요")).toBeInTheDocument();
    expect(container.querySelector('img[src$="empty-saved-light.svg"]')).not.toBeNull();
  });

  it("저장한 LISTED 항목만 카드로 노출한다(read-through)", () => {
    sessionOk();
    mockSaved.mockReturnValue(
      result({
        data: {
          pages: [{ items: [savedItem("listing-1", "교토 벚꽃 여행")] }],
          pageParams: [undefined],
        },
      })
    );
    renderPage();
    expect(
      screen.getByRole("link", { name: "교토 벚꽃 여행" })
    ).toBeInTheDocument();
  });

  it("로딩 상태를 배타적으로 노출한다", () => {
    sessionOk();
    mockSaved.mockReturnValue(result({ isPending: true }));
    renderPage();
    expect(
      screen.getByText("저장한 여행 일정을 불러오는 중이에요.")
    ).toBeInTheDocument();
  });

  it("초기 오류는 재시도 액션과 함께 노출한다", () => {
    sessionOk();
    mockSaved.mockReturnValue(
      result({ isError: true, error: new Error("boom") })
    );
    renderPage();
    expect(screen.getByText("저장 목록을 불러오지 못했어요")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeInTheDocument();
  });
});
