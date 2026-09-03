// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import type { UseQueryResult } from "@tanstack/react-query";

import {
  PlanIdSchema,
  RevisionSchema,
  TripIdSchema,
  UserIdSchema,
} from "../../core/domain/ids.ts";
import type { TripRoom, UserSession } from "../../core/domain/room.ts";
import type { RecommendNextActionResponse } from "../../contracts/recommendation.ts";
import { getPlanEditorDraftKey } from "../plan-editor/hooks/usePlanEditorState.ts";

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
  localStorage.clear();
  vi.clearAllMocks();
  mockUseRecommendation.mockReturnValue(
    toQueryResult<RecommendNextActionResponse | null>(null),
  );
});

const userMe = UserIdSchema.make("user-me-123");
const userOther = UserIdSchema.make("user-other-456");

const memberSessionMe: UserSession = {
  participantId: userMe,
  participantIds: [userMe],
  accountType: "REGISTERED",
  name: "나",
  isAuthenticated: true,
};

const memberSessionOther: UserSession = {
  participantId: userOther,
  participantIds: [userOther],
  accountType: "REGISTERED",
  name: "다른 사람",
  isAuthenticated: true,
};

const baseRoom: TripRoom = {
  id: TripIdSchema.make("trip-home-cta-1"),
  title: "여름 제주 여행",
  destination: "제주도",
  revision: RevisionSchema.make(1),
  members: [
    { id: userMe, name: "나", role: "HOST" },
    { id: userOther, name: "다른 사람", role: "MEMBER" },
  ],
  plans: [],
  confirmedPlanId: undefined,
};

const toQueryResult = <T,>(data: T): UseQueryResult<T, Error> =>
  ({
    data,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn<() => void>(),
  }) as unknown as UseQueryResult<T, Error>;

function LocationProbe() {
  const location = useLocation();
  return (
    <div style={{ display: "none" }}>
      <span data-testid="location-path">{location.pathname}</span>
      <span data-testid="location-search">{location.search}</span>
      <span data-testid="location-state">
        {JSON.stringify(location.state)}
      </span>
    </div>
  );
}

const renderPage = (initialEntries = [`/trips/${baseRoom.id}/plans`]) =>
  render(
    <MemoryRouter initialEntries={initialEntries}>
      <LocationProbe />
      <Routes>
        <Route path="/trips/:tripId/plans" element={<PlanHomePage />} />
        <Route path="/trips/:tripId/plans/new" element={<p>검토 화면</p>} />
        <Route path="/trips/:tripId/plans/new/:section" element={<p>위자드 질문 화면</p>} />
        <Route path="/trips/:tripId/itinerary" element={<p>확정 일정 화면</p>} />
      </Routes>
    </MemoryRouter>,
  );

describe("PlanHomeResumeCTA Adversarial Challenge Suite", () => {
  it("사용자 격리: 기기에 다른 사용자의 초안만 있을 경우 현재 로그인한 사용자에게는 '첫 여행안 만들기'를 노출한다", () => {
    // Current session is User Other
    mockUseSessionQuery.mockReturnValue(toQueryResult(memberSessionOther));
    mockUseTripRoomRawQuery.mockReturnValue(toQueryResult(baseRoom));

    // Storage only contains User Me's draft
    localStorage.setItem(
      getPlanEditorDraftKey(userMe, baseRoom.id, "new"),
      JSON.stringify({
        ownerId: userMe,
        title: "User Me의 초안",
        proposalReason: "",
        baseHeadcount: 2,
        routes: [{ city: "제주", arrivalDate: "2026-08-01", departureDate: "2026-08-03" }],
        accommodations: [],
        transports: [],
        updatedAt: "2026-07-20T00:00:00.000Z",
        wizardCursor: {
          section: "route",
          question: "city",
          index: 0,
        },
      }),
    );

    renderPage();

    expect(screen.getByRole("button", { name: "첫 여행안 만들기" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "이어서 작성하기" })).not.toBeInTheDocument();
  });

  it("비로그인/게스트 상태에서는 canCreatePlan이 false이므로 CTA 버튼 없이 안내 텍스트만 안전하게 렌더링된다", () => {
    mockUseSessionQuery.mockReturnValue(toQueryResult(null));
    mockUseTripRoomRawQuery.mockReturnValue(toQueryResult(baseRoom));

    renderPage();

    expect(screen.getByText("아직 여행안이 없어요")).toBeInTheDocument();
    expect(screen.getByText("여행 참여자가 첫 여행안을 만들면 여기에 표시돼요.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "첫 여행안 만들기" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "이어서 작성하기" })).not.toBeInTheDocument();
  });

  it("초안에 저장된 다양한 wizardCursor 위치(route, accommodation, transport)로 정확히 복원 이동한다", async () => {
    mockUseSessionQuery.mockReturnValue(toQueryResult(memberSessionMe));
    mockUseTripRoomRawQuery.mockReturnValue(toQueryResult(baseRoom));

    // Scenario 1: Accommodation status index 1
    localStorage.setItem(
      getPlanEditorDraftKey(userMe, baseRoom.id, "new"),
      JSON.stringify({
        ownerId: userMe,
        title: "작성 중인 초안",
        proposalReason: "",
        baseHeadcount: 2,
        routes: [
          { city: "제주", arrivalDate: "2026-08-01", departureDate: "2026-08-03" },
          { city: "서귀포", arrivalDate: "2026-08-03", departureDate: "2026-08-05" },
        ],
        accommodations: [],
        transports: [],
        updatedAt: "2026-07-20T00:00:00.000Z",
        wizardCursor: {
          section: "accommodation",
          question: "status",
          index: 1,
        },
      }),
    );

    const view = renderPage();
    const resumeBtn = screen.getByRole("button", { name: "이어서 작성하기" });
    fireEvent.click(resumeBtn);

    await waitFor(() => {
      expect(screen.getByTestId("location-path")).toHaveTextContent(
        `/trips/${baseRoom.id}/plans/new/accommodation`,
      );
      expect(screen.getByTestId("location-search")).toHaveTextContent(
        "question=status&index=1",
      );
      expect(screen.getByTestId("location-state")).toHaveTextContent('"tripCreationWizard":true');
      expect(screen.getByTestId("location-state")).toHaveTextContent('"wizardEntrySource":"plans"');
    });

    view.unmount();

    // Scenario 2: Transport duration index 2
    localStorage.setItem(
      getPlanEditorDraftKey(userMe, baseRoom.id, "new"),
      JSON.stringify({
        ownerId: userMe,
        title: "작성 중인 초안",
        proposalReason: "",
        baseHeadcount: 2,
        routes: [
          { city: "제주", arrivalDate: "2026-08-01", departureDate: "2026-08-03" },
          { city: "서귀포", arrivalDate: "2026-08-03", departureDate: "2026-08-05" },
        ],
        accommodations: [],
        transports: [],
        updatedAt: "2026-07-20T00:00:00.000Z",
        wizardCursor: {
          section: "transport",
          question: "duration",
          index: 2,
        },
      }),
    );

    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "이어서 작성하기" }));

    await waitFor(() => {
      expect(screen.getByTestId("location-path")).toHaveTextContent(
        `/trips/${baseRoom.id}/plans/new/transport`,
      );
      expect(screen.getByTestId("location-search")).toHaveTextContent(
        "question=duration&index=2",
      );
    });
  });

  it("스토리지에 깨진 JSON 문자열이 있어도 크래시 없이 '첫 여행안 만들기'로 폴백한다", () => {
    mockUseSessionQuery.mockReturnValue(toQueryResult(memberSessionMe));
    mockUseTripRoomRawQuery.mockReturnValue(toQueryResult(baseRoom));

    localStorage.setItem(
      getPlanEditorDraftKey(userMe, baseRoom.id, "new"),
      "{ corrupt-json-content: 12345, unfinished",
    );

    renderPage();

    expect(screen.getByRole("button", { name: "첫 여행안 만들기" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "이어서 작성하기" })).not.toBeInTheDocument();
  });

  it("여행방이 이미 확정된 경우(confirmedPlanId 존재) 초안이 있더라도 '이어서 작성하기'가 아니라 '확정 일정 보기'를 노출한다", () => {
    mockUseSessionQuery.mockReturnValue(toQueryResult(memberSessionMe));
    mockUseTripRoomRawQuery.mockReturnValue(
      toQueryResult({
        ...baseRoom,
        confirmedPlanId: PlanIdSchema.make("plan-confirmed-1"),
        plans: [
          {
            id: PlanIdSchema.make("plan-confirmed-1"),
            title: "확정된 여행안",
            status: "DRAFT",
            authorId: userMe,
            authorName: "나",
            places: [],
            voteCount: 1,
          },
        ],
      }),
    );

    localStorage.setItem(
      getPlanEditorDraftKey(userMe, baseRoom.id, "new"),
      JSON.stringify({
        ownerId: userMe,
        title: "작성 중이던 초안",
        proposalReason: "",
        baseHeadcount: 2,
        routes: [],
        accommodations: [],
        transports: [],
        updatedAt: "2026-07-20T00:00:00.000Z",
        wizardCursor: {
          section: "route",
          question: "city",
          index: 0,
        },
      }),
    );

    renderPage();

    expect(screen.getByRole("button", { name: "확정 일정 보기" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "이어서 작성하기" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "첫 여행안 만들기" })).not.toBeInTheDocument();
  });
});

describe("PlanHomeResumeCTA Additional Edge Cases", () => {
  it("draft에 wizardCursor가 빈 객체({}) 또는 알 수 없는 형식일 경우 '첫 여행안 만들기'로 안전하게 폴백한다", () => {
    mockUseSessionQuery.mockReturnValue(toQueryResult(memberSessionMe));
    mockUseTripRoomRawQuery.mockReturnValue(toQueryResult(baseRoom));

    localStorage.setItem(
      getPlanEditorDraftKey(userMe, baseRoom.id, "new"),
      JSON.stringify({
        ownerId: userMe,
        title: "제목만 있는 초안",
        proposalReason: "",
        baseHeadcount: 2,
        routes: [],
        accommodations: [],
        transports: [],
        updatedAt: "2026-07-20T00:00:00.000Z",
        wizardCursor: {},
      }),
    );

    renderPage();

    expect(screen.getByRole("button", { name: "첫 여행안 만들기" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "이어서 작성하기" })).not.toBeInTheDocument();
  });

  it("도시 추가 질문(add-city) 커서를 가진 초안의 경우 정확히 /route?question=add-city&index=0 경로로 복원한다", async () => {
    mockUseSessionQuery.mockReturnValue(toQueryResult(memberSessionMe));
    mockUseTripRoomRawQuery.mockReturnValue(toQueryResult(baseRoom));

    localStorage.setItem(
      getPlanEditorDraftKey(userMe, baseRoom.id, "new"),
      JSON.stringify({
        ownerId: userMe,
        title: "작성 중인 초안",
        proposalReason: "",
        baseHeadcount: 2,
        routes: [{ city: "제주", arrivalDate: "2026-08-01", departureDate: "2026-08-03" }],
        accommodations: [],
        transports: [],
        updatedAt: "2026-07-20T00:00:00.000Z",
        wizardCursor: {
          section: "route",
          question: "add-city",
          index: 0,
        },
      }),
    );

    renderPage();

    const resumeBtn = screen.getByRole("button", { name: "이어서 작성하기" });
    fireEvent.click(resumeBtn);

    await waitFor(() => {
      expect(screen.getByTestId("location-path")).toHaveTextContent(
        `/trips/${baseRoom.id}/plans/new/route`,
      );
      expect(screen.getByTestId("location-search")).toHaveTextContent(
        "question=add-city&index=0",
      );
    });
  });

  it("이미 1개 이상의 여행안이 등록된 방에서는 로컬 초안이 있더라도 '새 여행안 제안하기'가 우선된다", () => {
    mockUseSessionQuery.mockReturnValue(toQueryResult(memberSessionMe));
    mockUseTripRoomRawQuery.mockReturnValue(
      toQueryResult({
        ...baseRoom,
        plans: [
          {
            id: PlanIdSchema.make("plan-p1"),
            title: "첫 번째 여행안",
            status: "DRAFT",
            authorId: userOther,
            authorName: "다른 사람",
            places: [],
            voteCount: 0,
          },
        ],
      }),
    );

    localStorage.setItem(
      getPlanEditorDraftKey(userMe, baseRoom.id, "new"),
      JSON.stringify({
        ownerId: userMe,
        title: "작성 중인 대안 초안",
        proposalReason: "",
        baseHeadcount: 2,
        routes: [{ city: "제주", arrivalDate: "2026-08-01", departureDate: "2026-08-03" }],
        accommodations: [],
        transports: [],
        updatedAt: "2026-07-20T00:00:00.000Z",
        wizardCursor: {
          section: "route",
          question: "city",
          index: 0,
        },
      }),
    );

    renderPage();

    expect(screen.getByRole("button", { name: "새 여행안 제안하기" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "이어서 작성하기" })).not.toBeInTheDocument();
  });
});
