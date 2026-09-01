// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useTripRoomDetailQuery: vi.fn<(tripId: string) => unknown>(),
}));

vi.mock("../plan-detail/queries.ts", () => ({
  useTripRoomDetailQuery: mocks.useTripRoomDetailQuery,
}));

import { TripRoomEntry } from "./TripRoomEntry.tsx";

function LocationProbe() {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <div>
      <span data-testid="location-pathname">{location.pathname}</span>
      <button
        type="button"
        data-testid="test-back-btn"
        onClick={() => navigate(-1)}
      >
        뒤로
      </button>
    </div>
  );
}

const renderEntry = (
  initialEntries: string[] | string = "/trips/trip-1",
  initialIndex = 0,
) =>
  render(
    <MemoryRouter
      initialEntries={
        Array.isArray(initialEntries) ? initialEntries : [initialEntries]
      }
      initialIndex={initialIndex}
    >
      <LocationProbe />
      <Routes>
        <Route path="/trips" element={<h1>여행 목록 화면</h1>} />
        <Route path="/trips/:tripId" element={<TripRoomEntry />} />
        <Route
          path="/trips/:tripId/plans"
          element={<div data-testid="route-plans">계획 홈 화면</div>}
        />
        <Route
          path="/trips/:tripId/itinerary"
          element={<div data-testid="route-itinerary">일정 홈 화면</div>}
        />
        {/* Param 없는 route에서의 렌더링 테스트 */}
        <Route path="/invalid-entry" element={<TripRoomEntry />} />
      </Routes>
    </MemoryRouter>,
  );

describe("TripRoomEntry 상태 기반 진입 (Issue #96 / RAON-249)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("로딩 중일 때 '여행 정보를 확인하는 중...'을 표시한다", () => {
    mocks.useTripRoomDetailQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    });

    renderEntry("/trips/trip-1");

    expect(screen.getByText("여행 정보를 확인하는 중...")).toBeInTheDocument();
    expect(screen.queryByTestId("route-plans")).not.toBeInTheDocument();
    expect(screen.queryByTestId("route-itinerary")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "주요 화면" }),
    ).not.toBeInTheDocument();
  });

  it("확정된 계획이 없는 방(confirmedPlanId 없음)이면 /plans 로 replace redirect한다", () => {
    mocks.useTripRoomDetailQuery.mockReturnValue({
      data: {
        id: "trip-1",
        confirmedPlanId: undefined,
      },
      isLoading: false,
      isError: false,
    });

    renderEntry("/trips/trip-1");

    expect(screen.getByTestId("route-plans")).toBeInTheDocument();
    expect(screen.getByTestId("location-pathname")).toHaveTextContent(
      "/trips/trip-1/plans",
    );
  });

  it("확정된 계획(confirmedPlanId 있음)이 있는 방이면 /itinerary 로 replace redirect한다", () => {
    mocks.useTripRoomDetailQuery.mockReturnValue({
      data: {
        id: "trip-1",
        confirmedPlanId: "plan-1",
      },
      isLoading: false,
      isError: false,
    });

    renderEntry("/trips/trip-1");

    expect(screen.getByTestId("route-itinerary")).toBeInTheDocument();
    expect(screen.getByTestId("location-pathname")).toHaveTextContent(
      "/trips/trip-1/itinerary",
    );
  });

  it("조회 오류(isError) 시 기존 계약대로 /plans 로 replace redirect한다", () => {
    mocks.useTripRoomDetailQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    });

    renderEntry("/trips/trip-1");

    expect(screen.getByTestId("route-plans")).toBeInTheDocument();
    expect(screen.getByTestId("location-pathname")).toHaveTextContent(
      "/trips/trip-1/plans",
    );
  });

  it("방 데이터가 없을 때(no room) /plans 로 replace redirect한다", () => {
    mocks.useTripRoomDetailQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    });

    renderEntry("/trips/trip-1");

    expect(screen.getByTestId("route-plans")).toBeInTheDocument();
    expect(screen.getByTestId("location-pathname")).toHaveTextContent(
      "/trips/trip-1/plans",
    );
  });

  it("유효하지 않은 tripId 파라미터 시 RouteErrorFallback을 렌더링한다", () => {
    mocks.useTripRoomDetailQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    });

    renderEntry("/invalid-entry");

    expect(
      screen.getByText("유효하지 않은 여행방 식별자입니다."),
    ).toBeInTheDocument();
  });

  it("redirect가 replace이므로 뒤로 가기 시 entry route로 되돌아와 loop가 발생하지 않고 이전 화면으로 복귀한다", () => {
    mocks.useTripRoomDetailQuery.mockReturnValue({
      data: {
        id: "trip-1",
        confirmedPlanId: "plan-1",
      },
      isLoading: false,
      isError: false,
    });

    renderEntry(["/trips", "/trips/trip-1"], 1);

    // 즉시 /trips/trip-1/itinerary 로 replace redirect
    expect(screen.getByTestId("route-itinerary")).toBeInTheDocument();
    expect(screen.getByTestId("location-pathname")).toHaveTextContent(
      "/trips/trip-1/itinerary",
    );

    // 뒤로 가기 클릭 시 /trips/trip-1 이 아닌 /trips 로 복귀해야 함
    fireEvent.click(screen.getByTestId("test-back-btn"));

    expect(screen.getByTestId("location-pathname")).toHaveTextContent("/trips");
    expect(
      screen.getByRole("heading", { level: 1, name: "여행 목록 화면" }),
    ).toBeInTheDocument();
  });

  it("entry 및 redirect 목적지 단계 어디에서도 Global nav가 없다", () => {
    mocks.useTripRoomDetailQuery.mockReturnValue({
      data: {
        id: "trip-1",
        confirmedPlanId: "plan-1",
      },
      isLoading: false,
      isError: false,
    });

    renderEntry("/trips/trip-1");

    expect(
      screen.queryByRole("navigation", { name: "주요 화면" }),
    ).not.toBeInTheDocument();
  });
});
