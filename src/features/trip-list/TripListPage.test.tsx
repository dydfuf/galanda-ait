// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";

import type { TripOverviewDto } from "@/contracts/trip-overview.ts";

vi.mock("../plan-home/queries.ts", () => ({
  useTripRoomsQuery: vi.fn(),
}));
vi.mock("../../hooks/useSession.ts", () => ({
  useSessionQuery: vi.fn(),
}));

import { useTripRoomsQuery } from "../plan-home/queries.ts";
import { useSessionQuery } from "../../hooks/useSession.ts";
import { TripListPage } from "./TripListPage.tsx";

const mockUseTripRoomsQuery = vi.mocked(useTripRoomsQuery);
const mockUseSessionQuery = vi.mocked(useSessionQuery);

const tripFixture = (
  overrides: Partial<TripOverviewDto> = {},
): TripOverviewDto => ({
  id: "trip-ongoing",
  title: "오키나와 가족 여행",
  destination: "오키나와",
  revision: 1,
  isConfirmed: false,
  confirmedPeriod: null,
  memberCount: 4,
  memberNames: ["라온", "민지", "서준", "지수"],
  candidateCount: 0,
  opinionParticipantCount: 0,
  hasUnattributedOpinions: false,
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
  eligibleActionIds: ["EDIT_PLAN_BASIC"],
  ...overrides,
});

const roomsQueryResult = (
  data: ReadonlyArray<TripOverviewDto> | undefined,
  overrides: Record<string, unknown> = {},
): ReturnType<typeof useTripRoomsQuery> =>
  ({
    data,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  }) as unknown as ReturnType<typeof useTripRoomsQuery>;

const sessionQueryResult = (
  overrides: Record<string, unknown> = {},
): ReturnType<typeof useSessionQuery> =>
  ({
    data: null,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  }) as unknown as ReturnType<typeof useSessionQuery>;

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location-path">{location.pathname}</output>;
}

function TestApp() {
  return (
    <MemoryRouter initialEntries={["/trips"]}>
      <LocationProbe />
      <Routes>
        <Route path="/trips" element={<TripListPage />} />
        <Route path="*" element={<div>이동 완료</div>} />
      </Routes>
    </MemoryRouter>
  );
}

const renderPage = () => render(<TestApp />);

beforeEach(() => {
  mockUseSessionQuery.mockReset();
  mockUseTripRoomsQuery.mockReset();
  mockUseSessionQuery.mockReturnValue(sessionQueryResult());
  mockUseTripRoomsQuery.mockReturnValue(roomsQueryResult([]));
});

describe("TripListPage", () => {
  it("shows empty art only for a successful empty list, not a failed cached empty list", () => {
    const view = renderPage();
    expect(view.container.querySelector('img[src$="empty-trips-light.svg"]')).not.toBeNull();

    mockUseTripRoomsQuery.mockReturnValue(roomsQueryResult([], { isError: true }));
    view.rerender(<TestApp />);
    expect(view.container.querySelector("img")).toBeNull();
    expect(screen.getByRole("alert")).toHaveTextContent("이전에 불러온 정보");
  });

  it("진행 중 탭은 진행 중 카드와 최근 지난 여행 2건을, 지난 여행 탭은 전체 목록을 표시한다", () => {
    const longTitle =
      "가족 모두의 취향을 반영한 아주 긴 오키나와 북부와 남부 일주 여행";
    const ongoingTrip = tripFixture({
      title: longTitle,
      candidateCount: 1,
      opinionParticipantCount: 2,
      isConfirmed: true,
      confirmedPeriod: { startDate: "2999-04-01", endDate: "2999-04-05" },
    });
    const pastTrips = [
      tripFixture({
        id: "trip-past-oldest",
        title: "오래된 부산 여행",
        destination: "부산",
        isConfirmed: true,
        confirmedPeriod: { startDate: "2000-01-01", endDate: "2000-01-03" },
      }),
      tripFixture({
        id: "trip-past-newest",
        title: "최근 제주 여행",
        destination: "제주도",
        isConfirmed: true,
        confirmedPeriod: { startDate: "2002-01-01", endDate: "2002-01-03" },
      }),
      tripFixture({
        id: "trip-past-middle",
        title: "지난 강릉 여행",
        destination: "강릉",
        isConfirmed: true,
        confirmedPeriod: { startDate: "2001-01-01", endDate: "2001-01-03" },
      }),
    ];
    mockUseTripRoomsQuery.mockReturnValue(
      roomsQueryResult([ongoingTrip, ...pastTrips]),
    );

    renderPage();

    const filter = screen.getByRole("tablist", { name: "여행 목록 필터" });
    expect(filter).toHaveAttribute("data-variant", "default");
    expect(filter).not.toHaveAttribute("data-galanda-surface");
    expect(screen.getByRole("tab", { name: "진행 중 (1)" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      screen.getByRole("link", { name: `${longTitle} 여행 열기` }),
    ).toBeInTheDocument();
    expect(screen.getByText(longTitle).className).toContain(
      "[overflow-wrap:anywhere]",
    );
    expect(
      screen.getByRole("list", { name: "여행 참여자 4명" }),
    ).toBeInTheDocument();

    const preview = screen.getByRole("list", { name: "지난 여행 미리보기" });
    expect(within(preview).getAllByRole("listitem")).toHaveLength(2);
    expect(within(preview).getByText("최근 제주 여행")).toBeInTheDocument();
    expect(within(preview).getByText("지난 강릉 여행")).toBeInTheDocument();
    expect(within(preview).queryByText("오래된 부산 여행")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "지난 여행" }));

    expect(screen.getByRole("tab", { name: "지난 여행" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      screen.queryByRole("link", { name: `${longTitle} 여행 열기` }),
    ).not.toBeInTheDocument();
    const fullPastList = screen.getByRole("list", { name: "지난 여행 전체" });
    expect(within(fullPastList).getAllByRole("listitem")).toHaveLength(3);
    expect(within(fullPastList).getByText("오래된 부산 여행")).toBeInTheDocument();
  });

  it("여행안·의견 집계 상태와 구조화된 참가자 이름을 사실대로 표시한다", () => {
    mockUseTripRoomsQuery.mockReturnValue(
      roomsQueryResult([
        tripFixture({
          id: "trip-no-plan",
          title: "여행안 없는 여행",
          memberCount: 1,
          memberNames: ["김, 라온"],
          candidateCount: 0,
        }),
        tripFixture({
          id: "trip-planning",
          title: "계획 중인 여행",
          candidateCount: 2,
          opinionParticipantCount: 2,
          memberCount: 3,
        }),
        tripFixture({
          id: "trip-legacy-opinion",
          title: "집계 전 여행",
          candidateCount: 2,
          opinionParticipantCount: 1,
          hasUnattributedOpinions: true,
        }),
      ]),
    );

    renderPage();

    const noPlanCard = screen.getByRole("link", {
      name: "여행안 없는 여행 여행 열기",
    });
    expect(within(noPlanCard).getByText("여행안 0개 · 첫 여행안을 작성해주세요")).toBeVisible();
    const participantList = within(noPlanCard).getByRole("list", {
      name: "여행 참여자 1명",
    });
    expect(within(participantList).getAllByRole("listitem")).toHaveLength(1);
    expect(within(participantList).getByTitle("김, 라온")).toBeVisible();

    const planningCard = screen.getByRole("link", {
      name: "계획 중인 여행 여행 열기",
    });
    expect(
      within(planningCard).getByText("의견 참여 2/3명 · 여행안 2개"),
    ).toBeVisible();

    const legacyCard = screen.getByRole("link", {
      name: "집계 전 여행 여행 열기",
    });
    expect(
      within(legacyCard).getByText("후보 여행안 2개"),
    ).toBeVisible();
  });

  it("여행 카드와 유일한 Primary Action이 실제 route로 이동한다", () => {
    mockUseTripRoomsQuery.mockReturnValue(
      roomsQueryResult([tripFixture({ id: "trip-route" })]),
    );

    const firstView = renderPage();

    fireEvent.click(
      screen.getByRole("link", { name: "오키나와 가족 여행 여행 열기" }),
    );
    expect(screen.getByTestId("location-path")).toHaveTextContent(
      "/trips/trip-route",
    );

    firstView.unmount();
    mockUseTripRoomsQuery.mockReturnValue(roomsQueryResult([]));
    const secondView = renderPage();

    const pageBody = secondView.container.querySelector<HTMLElement>(
      '[data-slot="trip-list-page"]',
    );
    expect(pageBody?.className).toContain(
      "pb-[max(var(--app-cta-space),calc(var(--app-bottom-action-height,0px)+16px))]",
    );
    expect(pageBody?.className).not.toContain("pb-(--app-page-padding-bottom)");

    const primaryActions = screen.getAllByRole("button", {
      name: "새 여행 만들기",
    });
    expect(primaryActions).toHaveLength(1);
    expect(document.querySelector('[data-slot="bottom-action"]')).toBeNull();
    const floatingLayer = primaryActions[0].closest("div.fixed");
    expect(floatingLayer).not.toBeNull();
    expect(floatingLayer).toHaveStyle({
      bottom: "calc(var(--global-nav-height, 0px) + 1rem)",
    });
    const fabContainer = primaryActions[0].parentElement;
    expect(fabContainer?.className).toContain(
      "min-[960px]:max-w-[calc(var(--content-max-width)+20rem)]",
    );
    fireEvent.click(primaryActions[0]);
    expect(screen.getByTestId("location-path")).toHaveTextContent(
      "/trips/new",
    );
  });

  it("로딩과 성공한 0건 empty state를 동시에 표시하지 않는다", () => {
    mockUseTripRoomsQuery.mockReturnValue(
      roomsQueryResult(undefined, { isLoading: true }),
    );

    const view = renderPage();

    expect(
      view.container.querySelector('[data-system-state="loading"]'),
    ).toHaveTextContent("여행 목록을 불러오는 중이에요.");
    expect(screen.queryByText("진행 중인 여행이 없어요")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /여행 열기/ }),
    ).not.toBeInTheDocument();

    mockUseTripRoomsQuery.mockReturnValue(roomsQueryResult([]));
    view.rerender(<TestApp />);

    expect(
      view.container.querySelector('[data-system-state="empty"]'),
    ).toHaveTextContent("진행 중인 여행이 없어요");
    expect(
      screen.queryByText("여행 목록을 불러오는 중이에요."),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("초기 조회 오류만 alert로 표시하고 다시 시도하면 rooms query를 refetch한다", () => {
    const refetch = vi.fn();
    mockUseTripRoomsQuery.mockReturnValue(
      roomsQueryResult(undefined, {
        isError: true,
        error: new Error("네트워크 연결을 확인해주세요."),
        refetch,
      }),
    );

    const { container } = renderPage();

    expect(screen.getByRole("alert")).toHaveTextContent(
      "여행 목록을 불러오지 못했어요",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "네트워크 연결을 확인해주세요.",
    );
    expect(container.querySelectorAll('[data-system-state="error"]')).toHaveLength(1);
    expect(container.querySelector('[data-system-state="loading"]')).toBeNull();
    expect(container.querySelector('[data-system-state="empty"]')).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("캐시된 여행이 있으면 최신 조회 실패를 밝히면서 기존 목록을 유지한다", () => {
    const refetch = vi.fn();
    mockUseTripRoomsQuery.mockReturnValue(
      roomsQueryResult([tripFixture()], {
        isError: true,
        error: new Error("offline"),
        refetch,
      }),
    );

    renderPage();

    expect(screen.getByRole("alert")).toHaveTextContent(
      "표시된 내용은 이전에 불러온 정보예요.",
    );
    expect(
      screen.getByRole("link", { name: "오키나와 가족 여행 여행 열기" }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "여행 정보 다시 확인" }),
    );
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
