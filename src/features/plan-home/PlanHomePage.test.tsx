// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { UseQueryResult } from "@tanstack/react-query";

import { PlanIdSchema, RevisionSchema, TripIdSchema, UserIdSchema } from "../../core/domain/ids.ts";
import type { TripRoom, UserSession } from "../../core/domain/room.ts";

vi.mock("../plan-detail/queries.ts", () => ({
  useTripRoomRawQuery: vi.fn<(roomId: string) => UseQueryResult<TripRoom, Error>>(),
}));
vi.mock("../../hooks/useSession.ts", () => ({
  useSessionQuery: vi.fn<() => UseQueryResult<UserSession | null, Error>>(),
}));

import { useTripRoomRawQuery } from "../plan-detail/queries.ts";
import { useSessionQuery } from "../../hooks/useSession.ts";
import { PlanHomePage } from "./PlanHomePage.tsx";

const mockUseSessionQuery = vi.mocked(useSessionQuery);
const mockUseTripRoomRawQuery = vi.mocked(useTripRoomRawQuery);

const memberSession: UserSession = {
  participantId: UserIdSchema.make("user-local-me"),
  participantIds: [UserIdSchema.make("user-local-me")],
  accountType: "REGISTERED",
  name: "나",
  isAuthenticated: true,
};

const strangerSession: UserSession = {
  ...memberSession,
  participantId: UserIdSchema.make("user-stranger"),
  participantIds: [UserIdSchema.make("user-stranger")],
};

const baseRoom: TripRoom = {
  id: TripIdSchema.make("trip-1"),
  title: "제주도 힐링 여행",
  destination: "제주도",
  revision: RevisionSchema.make(1),
  members: [{ id: UserIdSchema.make("user-local-me"), name: "나", role: "HOST" }],
  plans: [],
  confirmedPlanId: undefined,
};

const planFixture = (id: string) => ({
  id: PlanIdSchema.make(id),
  title: `${id} 여행안`,
  status: "DRAFT" as const,
  authorId: UserIdSchema.make("user-local-me"),
  authorName: "나",
  places: [],
  voteCount: 0,
});

const roomWithPlans = (count: number, confirmedPlanId?: TripRoom["confirmedPlanId"]): TripRoom => ({
  ...baseRoom,
  confirmedPlanId,
  plans: Array.from({ length: count }, (_, i) => planFixture(`plan-${i + 1}`)),
});

const toQueryResult = <T,>(data: T): UseQueryResult<T, Error> =>
  ({
    data,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn<() => void>(),
  }) as unknown as UseQueryResult<T, Error>;

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/trips/trip-1/plans"]}>
      <Routes>
        <Route path="/trips/:tripId/plans" element={<PlanHomePage />} />
      </Routes>
    </MemoryRouter>,
  );

/** sticky BottomAction이 켜졌는지는 본문 하단 여백 계약(--app-cta-space)으로 간접 확인한다 */
const hasStickyCtaSpace = (container: HTMLElement): boolean =>
  container.querySelector('[class*="--app-cta-space"]') !== null;

describe("PlanHomePage 상태별 CTA 렌더링 (RAON-228)", () => {
  it("후보 0개 + plan:create 가능자는 '첫 여행안 만들기' 버튼을 정확히 하나만 렌더한다 (empty state 전용)", () => {
    mockUseSessionQuery.mockReturnValue(toQueryResult(memberSession));
    mockUseTripRoomRawQuery.mockReturnValue(toQueryResult(roomWithPlans(0)));

    const { container } = renderPage();

    expect(screen.getAllByRole("button", { name: "첫 여행안 만들기" })).toHaveLength(1);
    // empty state에서 sticky BottomAction이 경쟁하면 안 된다
    expect(hasStickyCtaSpace(container)).toBe(false);
  });

  it("후보 1개 + plan:create 가능자는 sticky '새 여행안 제안하기' 하나만 렌더한다", () => {
    mockUseSessionQuery.mockReturnValue(toQueryResult(memberSession));
    mockUseTripRoomRawQuery.mockReturnValue(toQueryResult(roomWithPlans(1)));

    const { container } = renderPage();

    expect(screen.getAllByRole("button", { name: "새 여행안 제안하기" })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "여행안 비교하기" })).not.toBeInTheDocument();
    expect(hasStickyCtaSpace(container)).toBe(true);
  });

  it("후보 2개 이상 + plan:create 가능자는 sticky 비교하기와 section secondary 제안 진입을 함께 노출한다", () => {
    mockUseSessionQuery.mockReturnValue(toQueryResult(memberSession));
    mockUseTripRoomRawQuery.mockReturnValue(toQueryResult(roomWithPlans(2)));

    const { container } = renderPage();

    expect(screen.getAllByRole("button", { name: "여행안 비교하기" })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "새 여행안 제안하기" })).toBeInTheDocument();
    expect(hasStickyCtaSpace(container)).toBe(true);
  });

  it("GUEST에게 mutation CTA(새 여행안 제안하기)를 노출하지 않고 열람 action인 비교하기만 남긴다", () => {
    mockUseSessionQuery.mockReturnValue(toQueryResult(strangerSession));
    mockUseTripRoomRawQuery.mockReturnValue(toQueryResult(roomWithPlans(3)));

    const { container } = renderPage();

    expect(screen.queryByRole("button", { name: "새 여행안 제안하기" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "여행안 비교하기" })).toBeInTheDocument();
    expect(hasStickyCtaSpace(container)).toBe(true);
  });

  it("GUEST + 후보 0개는 어떤 CTA 버튼도 렌더하지 않는다", () => {
    mockUseSessionQuery.mockReturnValue(toQueryResult(strangerSession));
    mockUseTripRoomRawQuery.mockReturnValue(toQueryResult(roomWithPlans(0)));

    const { container } = renderPage();

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(hasStickyCtaSpace(container)).toBe(false);
  });

  it("확정 상태는 '확정 일정 보기' primary 하나로 수렴하고 mutation 진입을 노출하지 않는다", () => {
    mockUseSessionQuery.mockReturnValue(toQueryResult(memberSession));
    mockUseTripRoomRawQuery.mockReturnValue(
      toQueryResult(roomWithPlans(2, PlanIdSchema.make("plan-1"))),
    );

    renderPage();

    expect(screen.getAllByRole("button", { name: "확정 일정 보기" })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "여행안 비교하기" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "새 여행안 제안하기" })).not.toBeInTheDocument();
  });

  it("세션 로딩 중에는 오류 fallback 대신 로딩을 유지해 capability 조기 확정을 막는다", () => {
    mockUseSessionQuery.mockReturnValue(
      ({
        data: undefined,
        isLoading: true,
        isError: false,
        error: null,
        refetch: vi.fn<() => void>(),
      }) as unknown as UseQueryResult<UserSession | null, Error>,
    );
    mockUseTripRoomRawQuery.mockReturnValue(
      ({
        data: undefined,
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn<() => void>(),
      }) as unknown as UseQueryResult<TripRoom, Error>,
    );

    renderPage();

    expect(screen.getByText(/불러오는 중/)).toBeInTheDocument();
    expect(screen.queryByText("여행 정보를 찾을 수 없습니다")).not.toBeInTheDocument();
  });
});
