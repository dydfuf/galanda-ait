// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import type { SavedListingItem } from "../../../contracts/explore-save.ts";

vi.mock("../../explore/save-queries.ts", () => ({
  useSavedListingsQuery: vi.fn(),
  SAVED_FEED_PAGE_SIZE: 20,
}));
vi.mock("../../../hooks/useSession.ts", () => ({
  useSessionQuery: vi.fn(),
}));

import { useSavedListingsQuery } from "../../explore/save-queries.ts";
import { useSessionQuery } from "../../../hooks/useSession.ts";
import {
  HOME_SAVED_COMPACT_LIMIT,
  SavedIdeasSection,
} from "./SavedIdeasSection.tsx";

const mockSaved = vi.mocked(useSavedListingsQuery);
const mockSession = vi.mocked(useSessionQuery);

const savedItem = (
  id: string,
  title: string,
  savedAt: string
): SavedListingItem => ({
  savedAt,
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
        { city: "교토", arrivalDate: "2026-09-04", departureDate: "2026-09-05" },
      ],
      dateRange: {
        startDate: "2026-09-01",
        endDate: "2026-09-05",
        nightCount: 4,
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

const pages = (items: SavedListingItem[]) =>
  ({ pages: [{ items }], pageParams: [undefined] });

const renderSection = () =>
  render(
    <MemoryRouter>
      <SavedIdeasSection />
    </MemoryRouter>
  );

const heading = () =>
  screen.getByRole("heading", { name: "저장한 여행 아이디어" });

describe("SavedIdeasSection (RAON-256 DISC-9)", () => {
  it("항상 semantic 제목과 실제 /me/saved 전체 보기 link를 렌더한다", () => {
    sessionOk();
    mockSaved.mockReturnValue(savedResult({ data: pages([]) }));
    renderSection();
    expect(heading()).toBeInTheDocument();
    const seeAll = screen.getByRole("link", { name: "전체 보기" });
    expect(seeAll).toHaveAttribute("href", "/me/saved");
  });

  it("저장 항목이 없으면 정직한 empty 안내를 노출한다(fake 카드 없음)", () => {
    sessionOk();
    mockSaved.mockReturnValue(savedResult({ data: pages([]) }));
    renderSection();
    expect(
      screen.getByText(/아직 저장한 여행 아이디어가 없어요/)
    ).toBeInTheDocument();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });

  it("항목 1개는 public 필드와 /explore/:listingId link로 노출한다", () => {
    sessionOk();
    mockSaved.mockReturnValue(
      savedResult({
        data: pages([savedItem("listing-1", "교토 벚꽃 여행", "2026-09-06T00:00:00.000Z")]),
      })
    );
    renderSection();
    const link = screen.getByRole("link", { name: "교토 벚꽃 여행" });
    expect(link).toHaveAttribute("href", "/explore/listing-1");
    // public route/기간/저장 시각만 노출.
    expect(within(link).getByText("오사카 → 교토")).toBeInTheDocument();
    expect(
      within(link).getByText("4박 5일 · 9.1 ~ 9.5")
    ).toBeInTheDocument();
    expect(within(link).getByText(/저장$/)).toBeInTheDocument();
  });

  it("N개일 때 server savedAt 순서를 유지한 채 compact limit까지만 노출한다", () => {
    sessionOk();
    const many = Array.from({ length: HOME_SAVED_COMPACT_LIMIT + 2 }, (_, i) =>
      savedItem(`listing-${i}`, `여행 ${i}`, `2026-09-${10 - i}T00:00:00.000Z`)
    );
    mockSaved.mockReturnValue(savedResult({ data: pages(many) }));
    renderSection();
    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(HOME_SAVED_COMPACT_LIMIT);
    // 서버가 준 순서를 그대로(재정렬 없이) 앞에서부터 노출한다.
    expect(within(rows[0]).getByRole("heading")).toHaveTextContent("여행 0");
    expect(within(rows[1]).getByRole("heading")).toHaveTextContent("여행 1");
    expect(within(rows[2]).getByRole("heading")).toHaveTextContent("여행 2");
    // limit 초과 항목은 렌더하지 않는다.
    expect(
      screen.queryByRole("heading", { name: "여행 3" })
    ).not.toBeInTheDocument();
  });

  it("초기 로딩 상태를 노출한다", () => {
    sessionOk();
    mockSaved.mockReturnValue(savedResult({ isPending: true }));
    renderSection();
    expect(
      screen.getByText(/저장한 여행 아이디어를 불러오는 중이에요/)
    ).toBeInTheDocument();
    // 제목은 로딩 중에도 유지된다.
    expect(heading()).toBeInTheDocument();
  });

  it("초기 오류(캐시 없음)는 재시도 액션과 함께 노출한다", () => {
    sessionOk();
    const refetch = vi.fn();
    mockSaved.mockReturnValue(
      savedResult({ isError: true, error: new Error("boom"), refetch })
    );
    renderSection();
    expect(screen.getByRole("alert")).toBeInTheDocument();
    screen.getByRole("button", { name: "다시 시도" }).click();
    expect(refetch).toHaveBeenCalled();
  });

  it("error가 있어도 캐시된 행을 보존하고 stale 안내 + 재시도를 노출한다", () => {
    sessionOk();
    const refetch = vi.fn();
    mockSaved.mockReturnValue(
      savedResult({
        isError: true,
        error: new Error("boom"),
        refetch,
        data: pages([savedItem("listing-1", "보존된 여행", "2026-09-06T00:00:00.000Z")]),
      })
    );
    renderSection();
    // 캐시된 행은 유지하되 stale data를 최신처럼 표시하지 않는다.
    expect(
      screen.getByRole("link", { name: "보존된 여행" })
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/이전에 불러온 목록/);
    screen.getByRole("button", { name: "목록 다시 확인" }).click();
    expect(refetch).toHaveBeenCalled();
  });

  it("세션 오류 시 이 section만 안내하고 독립 재시도·제목·전체 보기 link를 유지한다", () => {
    const refetchSession = vi.fn();
    mockSession.mockReturnValue({
      data: undefined,
      isSuccess: false,
      isPending: false,
      isError: true,
      error: new Error("세션 오류"),
      refetch: refetchSession,
    } as unknown as ReturnType<typeof useSessionQuery>);
    mockSaved.mockReturnValue(savedResult({ isPending: true }));
    renderSection();
    expect(screen.getByRole("alert")).toHaveTextContent(
      /로그인 정보를 확인할 수 없어/
    );
    screen.getByRole("button", { name: "로그인 정보 다시 확인" }).click();
    expect(refetchSession).toHaveBeenCalled();
    expect(heading()).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "전체 보기" })
    ).toHaveAttribute("href", "/me/saved");
  });

  it("responsive/a11y: min-w-0 overflow-safe 레이아웃과 semantic section을 유지한다", () => {
    sessionOk();
    mockSaved.mockReturnValue(
      savedResult({
        data: pages([savedItem("listing-1", "가".repeat(120), "2026-09-06T00:00:00.000Z")]),
      })
    );
    const { container } = renderSection();
    const section = container.querySelector("section");
    expect(section).not.toBeNull();
    expect(section?.getAttribute("aria-labelledby")).toBe("home-saved-heading");
    const rowHeading = screen.getByRole("heading", { name: "가".repeat(120) });
    expect(rowHeading.className).toContain("[overflow-wrap:anywhere]");
    expect(rowHeading.className).toContain("min-w-0");
    const link = screen.getByRole("link", { name: "가".repeat(120) });
    expect(link.className).toContain("focus-visible:outline-ring");
    expect(link.className).toContain("min-w-0");
  });

  it("private/fake 필드를 노출하지 않는다(author/count/image/추천 없음)", () => {
    sessionOk();
    mockSaved.mockReturnValue(
      savedResult({
        data: pages([savedItem("listing-1", "교토 벚꽃 여행", "2026-09-06T00:00:00.000Z")]),
      })
    );
    const { container } = renderSection();
    // author 표시명은 렌더하지 않는다(needed only가 아님).
    expect(screen.queryByText("여행자A")).not.toBeInTheDocument();
    // fake image/count/activity/추천 요소 없음.
    expect(container.querySelector("img")).toBeNull();
    expect(screen.queryByText(/저장 수|인기|추천/)).not.toBeInTheDocument();
  });
});
