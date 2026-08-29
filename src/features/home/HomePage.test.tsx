// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("../explore/save-queries.ts", () => ({
  useSavedListingsQuery: vi.fn(),
  SAVED_FEED_PAGE_SIZE: 20,
}));
vi.mock("../../hooks/useSession.ts", () => ({
  useSessionQuery: vi.fn(),
}));

import { useSavedListingsQuery } from "../explore/save-queries.ts";
import { useSessionQuery } from "../../hooks/useSession.ts";
import type { SavedListingItem } from "../../contracts/explore-save.ts";
import { HomePage } from "./HomePage.tsx";

const mockSaved = vi.mocked(useSavedListingsQuery);
const mockSession = vi.mocked(useSessionQuery);

const savedItem = (id: string, title: string): SavedListingItem => ({
  savedAt: "2026-09-06T00:00:00.000Z",
  listing: {
    listingId: id as SavedListingItem["listing"]["listingId"],
    status: "LISTED",
    listingRevision: 1 as SavedListingItem["listing"]["listingRevision"],
    listedAt: "2026-09-05T00:00:00.000Z",
    updatedAt: "2026-09-05T00:00:00.000Z",
    snapshot: {
      title,
      destination: "교토",
      routes: [
        { city: "교토", arrivalDate: "2026-09-01", departureDate: "2026-09-04" },
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

const savedResult = (
  over: Partial<ReturnType<typeof useSavedListingsQuery>>
) =>
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

const renderHome = () =>
  render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>
  );

const expectCoreShortcuts = () => {
  expect(screen.getByRole("heading", { name: "홈" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /내 여행/ })).toHaveAttribute(
    "href",
    "/trips"
  );
  expect(screen.getByRole("link", { name: /탐색/ })).toHaveAttribute(
    "href",
    "/explore"
  );
};

describe("HomePage (RAON-256 DISC-9)", () => {
  it("저장 section이 오류여도 홈 제목/바로 가기 핵심 콘텐츠를 유지한다", () => {
    sessionOk();
    mockSaved.mockReturnValue(
      savedResult({ isError: true, error: new Error("boom") })
    );
    renderHome();
    expectCoreShortcuts();
    // 저장 section은 오류 안내만 하고 핵심을 막지 않는다.
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("저장 section이 로딩 중이어도 홈 핵심 콘텐츠를 막지 않는다", () => {
    sessionOk();
    mockSaved.mockReturnValue(savedResult({ isPending: true }));
    renderHome();
    expectCoreShortcuts();
    expect(
      screen.getByText(/저장한 여행 아이디어를 불러오는 중이에요/)
    ).toBeInTheDocument();
  });

  it("저장 항목이 있으면 홈에 저장한 여행 아이디어 section을 함께 보여준다", () => {
    sessionOk();
    mockSaved.mockReturnValue(
      savedResult({
        data: {
          pages: [{ items: [savedItem("listing-1", "교토 벚꽃 여행")] }],
          pageParams: [undefined],
        },
      })
    );
    renderHome();
    expectCoreShortcuts();
    expect(
      screen.getByRole("heading", { name: "저장한 여행 아이디어" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "교토 벚꽃 여행" })
    ).toHaveAttribute("href", "/explore/listing-1");
  });
});
