// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { UseQueryResult } from "@tanstack/react-query";

import { PlanIdSchema, RecommendationIdSchema, RevisionSchema, TripIdSchema, UserIdSchema } from "../../core/domain/ids.ts";
import type { TripRoom, UserSession } from "../../core/domain/room.ts";
import type { RecommendNextActionResponse } from "../../contracts/recommendation.ts";

vi.mock("../plan-detail/queries.ts", () => ({
  useTripRoomRawQuery: vi.fn<(roomId: string) => UseQueryResult<TripRoom, Error>>(),
}));
vi.mock("../../hooks/useSession.ts", () => ({
  useSessionQuery: vi.fn<() => UseQueryResult<UserSession | null, Error>>(),
}));
vi.mock("../common/use-next-trip-action-recommendation.ts", () => ({
  useNextTripActionRecommendation: vi.fn<() => object>(() => ({
    data: undefined,
    isLoading: false,
    isError: false,
    error: null,
  })),
}));

import { useTripRoomRawQuery } from "../plan-detail/queries.ts";
import { useSessionQuery } from "../../hooks/useSession.ts";
import { useNextTripActionRecommendation } from "../common/use-next-trip-action-recommendation.ts";
import { PlanHomePage } from "./PlanHomePage.tsx";

const mockUseSessionQuery = vi.mocked(useSessionQuery);
const mockUseTripRoomRawQuery = vi.mocked(useTripRoomRawQuery);
const mockUseRecommendation = vi.mocked(useNextTripActionRecommendation);

beforeEach(() => {
  mockUseRecommendation.mockReturnValue(
    toQueryResult<RecommendNextActionResponse | null>(null),
  );
});

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

  it("GUEST에게 공통 NBA recommendation CTA를 노출하지 않는다", () => {
    mockUseSessionQuery.mockReturnValue(toQueryResult(strangerSession));
    mockUseTripRoomRawQuery.mockReturnValue(toQueryResult(roomWithPlans(3)));

    const { container } = renderPage();

    expect(screen.queryByRole("button", { name: "새 여행안 제안하기" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "여행안 비교하기" })).not.toBeInTheDocument();
    expect(hasStickyCtaSpace(container)).toBe(false);
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

  it("확정 상태도 GUEST에게 itinerary recommendation을 노출하지 않는다", () => {
    mockUseSessionQuery.mockReturnValue(toQueryResult(strangerSession));
    mockUseTripRoomRawQuery.mockReturnValue(
      toQueryResult(roomWithPlans(2, PlanIdSchema.make("plan-1"))),
    );

    const { container } = renderPage();

    expect(screen.queryByRole("button", { name: "확정 일정 보기" })).not.toBeInTheDocument();
    expect(hasStickyCtaSpace(container)).toBe(false);
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

describe("PlanHomePage regression contract (RAON-229)", () => {
  it("추천은 진행 상태 뒤에 compact하게 노출되고 건너뛰면 기존 primary로 복귀한다", () => {
    mockUseSessionQuery.mockReturnValue(toQueryResult(memberSession));
    mockUseTripRoomRawQuery.mockReturnValue(toQueryResult(roomWithPlans(2)));
    mockUseRecommendation.mockReturnValue(toQueryResult({
      recommendationId: RecommendationIdSchema.make("recommendation-1"),
      primary: {
        actionId: "GIVE_OPINION",
        reasonCode: "SHARE_PLAN_OPINION",
      },
      alternatives: [{ actionId: "COMPARE_PLANS" }],
      source: "AI",
      policyVersion: "nba-ai-v1",
      tripRevision: RevisionSchema.make(1),
      contextFingerprint: "fingerprint",
    }));

    const { container } = renderPage();

    const decisionSection = screen.getByRole("region", { name: "진행 상태" });
    const recommendationSection = screen.getByRole("region", {
      name: "다음으로 하면 좋은 일",
    });
    const candidatesSection = screen.getByRole("region", { name: "여행안" });
    expect(
      decisionSection.compareDocumentPosition(recommendationSection) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      recommendationSection.compareDocumentPosition(candidatesSection) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "여행안에 의견 남기기" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "대신 여행안 비교하기" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "여행안 비교하기" })).not.toBeInTheDocument();
    expect(hasStickyCtaSpace(container)).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "지금은 건너뛰기" }));

    expect(screen.queryByRole("region", { name: "다음으로 하면 좋은 일" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "여행안 비교하기" })).toBeInTheDocument();
    expect(hasStickyCtaSpace(container)).toBe(true);
  });

  it("여행 정보 → 진행 상태 → 여행안과 카드 accessible name 순서를 고정한다", () => {
    const room: TripRoom = {
      ...baseRoom,
      members: [
        ...baseRoom.members,
        { id: UserIdSchema.make("user-member"), name: "민지", role: "MEMBER" },
        { id: UserIdSchema.make("user-another"), name: "서준", role: "MEMBER" },
      ],
      plans: [
        {
          ...planFixture("plan-1"),
          title: "맛집과 온천을 모두 챙기는 아주 긴 기본 여행안",
          routes: [{ city: "도쿄", arrivalDate: "2026-09-01", departureDate: "2026-09-06" }],
          differenceSummary: "도쿄 체류를 늘리고 하코네 온천 숙박을 추가하는 긴 핵심 차이 요약",
          memberOpinions: [
            { userId: UserIdSchema.make("user-local-me"), userName: "나", reaction: "LIKE" },
            { userId: UserIdSchema.make("user-member"), userName: "민지", reaction: "OKAY" },
            { userId: UserIdSchema.make("user-another"), userName: "서준", reaction: "HARD" },
          ],
        },
        {
          ...planFixture("plan-2"),
          authorId: undefined,
          authorName: undefined,
          differenceSummary: "교토 숙박 집중",
          memberOpinions: [
            { userId: UserIdSchema.make("user-member"), userName: "민지", reaction: "OKAY" },
          ],
        },
        {
          ...planFixture("plan-3"),
          authorId: UserIdSchema.make("user-another"),
          authorName: "서준",
          memberOpinions: [],
        },
      ],
    };
    mockUseSessionQuery.mockReturnValue(toQueryResult(memberSession));
    mockUseTripRoomRawQuery.mockReturnValue(toQueryResult(room));

    renderPage();

    const tripSection = screen.getByRole("region", { name: "여행 정보" });
    const decisionSection = screen.getByRole("region", { name: "진행 상태" });
    const candidatesSection = screen.getByRole("region", { name: "여행안" });
    expect(tripSection.compareDocumentPosition(decisionSection) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(decisionSection.compareDocumentPosition(candidatesSection) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    expect(screen.getByRole("heading", { level: 1, name: "제주도 힐링 여행" })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "제안된 여행안" })).toBeInTheDocument();
    expect(screen.getByRole("link", {
      name: /기본안 맛집과 온천.*5박 6일.*나 제안.*긴 핵심 차이 요약.*좋아요 1명.*괜찮아요 1명.*어려워요 1명.*내 의견 좋아요/,
    })).toHaveAttribute("href", "/trips/trip-1/plans/plan-1");
    expect(screen.getByRole("link", { name: /대안 1.*작성자 미확인 제안.*괜찮아요 1명.*내 의견 아직 없음/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /대안 2.*서준 제안.*아직 의견이 없어요/ })).toBeInTheDocument();
  });

  it.each([
    ["HOST", memberSession, true],
    [
      "MEMBER",
      { ...memberSession, participantId: UserIdSchema.make("user-member"), participantIds: [UserIdSchema.make("user-member")] },
      true,
    ],
    ["GUEST", strangerSession, false],
  ] as const)("%s의 3+ plan CTA 권한을 고정한다", (_role, session, canCreate) => {
    mockUseSessionQuery.mockReturnValue(toQueryResult(session));
    mockUseTripRoomRawQuery.mockReturnValue(toQueryResult({
      ...roomWithPlans(3),
      members: [
        ...baseRoom.members,
        { id: UserIdSchema.make("user-member"), name: "민지", role: "MEMBER" },
      ],
    }));

    renderPage();

    expect(Boolean(screen.queryByRole("button", { name: "여행안 비교하기" }))).toBe(canCreate);
    expect(Boolean(screen.queryByRole("button", { name: "새 여행안 제안하기" }))).toBe(canCreate);
  });

  it("확정 카드는 색상과 무관하게 '확정안' accessible name을 제공한다", () => {
    mockUseSessionQuery.mockReturnValue(toQueryResult(memberSession));
    mockUseTripRoomRawQuery.mockReturnValue(toQueryResult(
      roomWithPlans(2, PlanIdSchema.make("plan-1")),
    ));

    renderPage();

    expect(screen.getByRole("link", { name: /확정안 plan-1 여행안/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "확정 일정 보기" })).toBeInTheDocument();
  });
});
