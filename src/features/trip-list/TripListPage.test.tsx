// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";

import type { TripRoomViewModel } from "../plan-home/plan-home-view-model.ts";

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

const roomFixture = (
  overrides: Partial<TripRoomViewModel> = {},
): TripRoomViewModel => ({
  id: "trip-ongoing",
  title: "오키나와 가족 여행",
  destination: "오키나와",
  displayStartDate: "2999-04-01",
  displayEndDate: "2999-04-05",
  period: "2999-04-01 ~ 2999-04-05",
  memberCount: 4,
  memberNames: "라온, 민지, 서준, 지수",
  revision: 1,
  confirmedPlanId: undefined,
  confirmedPlanTitle: undefined,
  decisionStatusText: "아직 등록된 여행안이 없어요",
  decisionSubText: "첫 여행안을 제안해보세요.",
  decisionBadgeText: "첫 여행안 필요",
  decisionBadgeVariant: "warning",
  candidateCount: 0,
  totalOpinionCount: 0,
  participatedMemberCount: 0,
  isConfirmed: false,
  plans: [],
  ...overrides,
});

const roomsQueryResult = (
  data: ReadonlyArray<TripRoomViewModel> | undefined,
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
  it("진행 중/지난 여행을 opaque filter와 semantic list로 배타적으로 표시하고 긴 제목을 보존한다", () => {
    const longTitle =
      "가족 모두의 취향을 반영한 아주 긴 오키나와 북부와 남부 일주 여행";
    const ongoingRoom = roomFixture({ title: longTitle });
    const pastRoom = roomFixture({
      id: "trip-past",
      title: "지난 제주 여행",
      destination: "제주도",
      displayStartDate: "2000-01-01",
      displayEndDate: "2000-01-03",
      period: "2000-01-01 ~ 2000-01-03",
    });
    mockUseTripRoomsQuery.mockReturnValue(
      roomsQueryResult([ongoingRoom, pastRoom]),
    );

    renderPage();

    const filter = screen.getByRole("tablist", { name: "여행 목록 필터" });
    expect(filter).toHaveAttribute("data-variant", "default");
    expect(filter).not.toHaveAttribute("data-galanda-surface");

    expect(
      screen.getByRole("tab", { name: "진행 중인 여행 (1)" }),
    ).toHaveAttribute("aria-selected", "true");
    const ongoingList = screen.getByRole("list", { name: "진행 중인 여행" });
    expect(within(ongoingList).getAllByRole("listitem")).toHaveLength(1);
    expect(within(ongoingList).getByText(longTitle).className).toContain(
      "[overflow-wrap:anywhere]",
    );
    expect(screen.queryByText("지난 제주 여행")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "지난 여행 (1)" }));

    expect(
      screen.getByRole("tab", { name: "지난 여행 (1)" }),
    ).toHaveAttribute("aria-selected", "true");
    const pastList = screen.getByRole("list", { name: "지난 여행" });
    expect(within(pastList).getAllByRole("listitem")).toHaveLength(1);
    expect(within(pastList).getByText("지난 제주 여행")).toBeInTheDocument();
    expect(screen.queryByText(longTitle)).not.toBeInTheDocument();
  });

  it("여행 row와 유일한 Primary Action이 실제 route로 이동한다", () => {
    mockUseTripRoomsQuery.mockReturnValue(
      roomsQueryResult([roomFixture({ id: "trip-route" })]),
    );

    const firstView = renderPage();

    fireEvent.click(
      screen.getByRole("button", {
        name: /오키나와 가족 여행, 오키나와, 4\.1 ~ 4\.5, 첫 여행안을 만들어보세요/,
      }),
    );
    expect(screen.getByTestId("location-path")).toHaveTextContent(
      "/trips/trip-route",
    );

    firstView.unmount();
    mockUseTripRoomsQuery.mockReturnValue(roomsQueryResult([]));
    renderPage();

    const primaryActions = screen.getAllByRole("button", {
      name: "새 여행 만들기",
    });
    expect(primaryActions).toHaveLength(1);
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
    expect(screen.queryByRole("list", { name: "진행 중인 여행" })).not.toBeInTheDocument();

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

  it("조회 오류만 alert로 표시하고 다시 시도하면 rooms query를 refetch한다", () => {
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
});
