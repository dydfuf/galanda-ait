// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type * as HomeTripDashboardModule from "./components/HomeTripDashboard.tsx";

vi.mock("../plan-home/queries.ts", () => ({ useTripRoomsQuery: vi.fn() }));
vi.mock("../explore/save-queries.ts", () => ({ useSavedListingsQuery: vi.fn(), SAVED_FEED_PAGE_SIZE: 20 }));
vi.mock("../../hooks/useSession.ts", () => ({ useSessionQuery: vi.fn() }));
vi.mock("./components/HomeNextAction.tsx", () => ({ HomeNextAction: () => null }));
vi.mock("./components/HomeTripDashboard.tsx", async (importOriginal) => ({
  ...await importOriginal<typeof HomeTripDashboardModule>(),
  HomeTripCard: () => <p>현재 여행 카드</p>,
}));
vi.mock("../explore/components/ExploreListingCard.tsx", () => ({
  ExploreListingCard: () => <p>저장한 여행 카드</p>,
}));

import { useTripRoomsQuery } from "../plan-home/queries.ts";
import { useSavedListingsQuery } from "../explore/save-queries.ts";
import { useSessionQuery } from "../../hooks/useSession.ts";
import type { TripOverviewDto } from "../../contracts/trip-overview.ts";
import { HomePage } from "./HomePage.tsx";
import { SavedListingsPage } from "../me/SavedListingsPage.tsx";

const trip: TripOverviewDto = {
  id: "trip-spot-test", title: "여행", destination: "교토", revision: 1,
  isConfirmed: true, confirmedPeriod: { startDate: "2999-06-01", endDate: "2999-06-05" },
  memberCount: 1, memberNames: ["여행자"], candidateCount: 1,
  opinionParticipantCount: 0, hasUnattributedOpinions: false,
  createdAt: "2026-08-01T00:00:00.000Z", updatedAt: "2026-08-01T00:00:00.000Z",
  eligibleActionIds: ["EDIT_PLAN_BASIC"],
};
const mockRooms = (over: Partial<ReturnType<typeof useTripRoomsQuery>> = {}) =>
  vi.mocked(useTripRoomsQuery).mockReturnValue({
    data: [], isPending: false, isError: false, error: null, refetch: vi.fn(), ...over,
  } as unknown as ReturnType<typeof useTripRoomsQuery>);
const mockSaved = (over: Partial<ReturnType<typeof useSavedListingsQuery>> = {}) =>
  vi.mocked(useSavedListingsQuery).mockReturnValue({
    data: { pages: [{ items: [] }], pageParams: [undefined] },
    isPending: false, isError: false, error: null, refetch: vi.fn(), fetchNextPage: vi.fn(),
    hasNextPage: false, isFetchingNextPage: false, isFetchNextPageError: false, ...over,
  } as unknown as ReturnType<typeof useSavedListingsQuery>);
const renderHome = () => render(<MemoryRouter><HomePage /></MemoryRouter>);
const renderSaved = () => render(<MemoryRouter><SavedListingsPage /></MemoryRouter>);
const spot = (container: HTMLElement) => container.querySelector('[data-slot="galanda-spot"]');

beforeEach(() => {
  vi.clearAllMocks();
  mockRooms();
  mockSaved();
  vi.mocked(useSessionQuery).mockReturnValue({
    isError: false, error: null, refetch: vi.fn(),
  } as unknown as ReturnType<typeof useSessionQuery>);
});

describe("Home and saved empty-state illustration integration", () => {
  it("uses the first-trip illustration without changing creation/explore destinations", () => {
    const { container } = renderHome();
    expect(spot(container)).toHaveAttribute("data-spot", "empty-trips");
    expect(screen.getByRole("link", { name: "새 여행 만들기" })).toHaveAttribute("href", "/trips/new");
    const explore = screen.getByRole("link", { name: "여행 탐색" });
    expect(explore).toHaveAttribute("href", "/explore");
    expect(explore.querySelector("svg")).toHaveAttribute("data-icon", "explore");
  });

  it("distinguishes past-only trips from a first trip and preserves both actions", () => {
    mockRooms({ data: [{ ...trip, confirmedPeriod: { startDate: "2020-01-01", endDate: "2020-01-05" } }] });
    const { container } = renderHome();
    expect(spot(container)).toHaveAttribute("data-spot", "create-trip");
    expect(screen.getByRole("link", { name: "새 여행 만들기" })).toHaveAttribute("href", "/trips/new");
    expect(screen.getByRole("link", { name: "내 여행 보기" })).toHaveAttribute("href", "/trips");
  });

  it("does not flash an empty illustration during the initial home request", () => {
    mockRooms({ data: undefined, isPending: true });
    const { container } = renderHome();
    expect(spot(container)).toBeNull();
    expect(container.querySelector('[data-system-state="loading"]')).toHaveAttribute("role", "status");
    expect(screen.getByText("여행 정보를 불러오는 중이에요.")).toBeInTheDocument();
  });

  it("keeps home errors and retries separate from empty trips", () => {
    const refetch = vi.fn();
    mockRooms({ data: undefined, isError: true, error: new Error("offline"), refetch });
    const { container } = renderHome();
    expect(spot(container)).toBeNull();
    expect(screen.getByRole("alert")).toHaveTextContent("여행 정보를 불러오지 못했어요");
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it("preserves cached trips and the stale warning instead of showing an empty illustration", () => {
    mockRooms({ data: [trip], isError: true, error: new Error("offline") });
    const { container } = renderHome();
    expect(spot(container)).toBeNull();
    expect(screen.getByText("현재 여행 카드")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("이전에 불러온 정보예요");
  });

  it("renders the empty-saved illustration only in the saved list's empty state", () => {
    const { container } = renderSaved();
    expect(spot(container)).toHaveAttribute("data-spot", "empty-saved");
    expect(screen.getByRole("status")).toHaveTextContent("아직 저장한 여행 일정이 없어요");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("keeps saved-list loading separate from an empty collection", () => {
    mockSaved({ data: undefined, isPending: true });
    const { container } = renderSaved();
    expect(spot(container)).toBeNull();
    expect(container.querySelector('[data-system-state="loading"]')).toHaveAttribute("role", "status");
    expect(screen.getByText("저장한 여행 일정을 불러오는 중이에요.")).toBeInTheDocument();
  });

  it("keeps saved-list errors and retries separate from an empty collection", () => {
    const refetch = vi.fn();
    mockSaved({ data: undefined, isError: true, error: new Error("offline"), refetch });
    const { container } = renderSaved();
    expect(spot(container)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it("does not turn a session failure into an empty saved collection", () => {
    const refetch = vi.fn();
    vi.mocked(useSessionQuery).mockReturnValue({
      isError: true, error: new Error("session"), refetch,
    } as unknown as ReturnType<typeof useSessionQuery>);
    const { container } = renderSaved();
    expect(spot(container)).toBeNull();
    expect(screen.getByRole("alert")).toHaveTextContent("로그인 정보를 확인할 수 없어요");
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(refetch).toHaveBeenCalledOnce();
  });
});
