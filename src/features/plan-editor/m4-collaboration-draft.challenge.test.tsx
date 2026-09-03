// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";

import {
  ParticipantIdSchema,
  PlanIdSchema,
  RevisionSchema,
  TripIdSchema,
} from "../../core/domain/ids.ts";
import type { TripPlan, TripRoom, UserSession } from "../../core/domain/room.ts";
import {
  getPlanEditorDraftKey,
  parsePlanEditorDraft,
  type StoredPlanEditorDraft,
} from "./hooks/usePlanEditorState.ts";
import { ApiClientError } from "../../app/api-client.ts";

let mockOnlineStatus = true;
vi.mock("../../hooks/useOnlineStatus.ts", () => ({
  useOnlineStatus: () => mockOnlineStatus,
}));
vi.mock("../plan-detail/queries.ts", () => ({
  useTripRoomRawQuery: vi.fn<() => unknown>(),
}));
vi.mock("../../hooks/useSession.ts", () => ({
  useSessionQuery: vi.fn<() => unknown>(),
}));
vi.mock("./mutations.ts", () => ({
  useCreatePlanMutation: vi.fn<() => unknown>(),
}));
vi.mock("../common/use-next-trip-action-recommendation.ts", () => ({
  useNextTripActionRecommendation: vi.fn<() => unknown>(() => ({
    data: null,
    isPending: false,
  })),
}));

import { useSessionQuery } from "../../hooks/useSession.ts";
import { useTripRoomRawQuery } from "../plan-detail/queries.ts";
import { useCreatePlanMutation } from "./mutations.ts";
import { PlanCreatePage } from "./PlanCreatePage.tsx";

const mockUseSessionQuery = vi.mocked(useSessionQuery);
const mockUseTripRoomRawQuery = vi.mocked(useTripRoomRawQuery);
const mockUseCreatePlanMutation = vi.mocked(useCreatePlanMutation);

const tripId = TripIdSchema.make("trip-m4-adversarial-1");
const hostId = ParticipantIdSchema.make("user-host-1");
const peerId = ParticipantIdSchema.make("user-peer-2");
const basePath = `/trips/${tripId}/plans/new`;

const mockFirstPublishedPlan: TripPlan = {
  id: PlanIdSchema.make("plan-first-published"),
  title: "동행자가 먼저 등록한 1안",
  proposalReason: "선착순 등록",
  baseHeadcount: 2,
  status: "VOTING",
  authorId: peerId,
  authorName: "동행자",
  places: [],
  voteCount: 0,
  routes: [
    { city: "오사카", arrivalDate: "2026-12-01", departureDate: "2026-12-03" },
  ],
  accommodations: [
    {
      id: "stay-peer-1",
      city: "오사카",
      period: "2026-12-01 ~ 2026-12-03",
      nights: 2,
      hotelName: "난바 호텔",
      bookingStatus: "AVAILABLE",
    },
  ],
  transports: [
    {
      id: "tr-peer-1",
      fromCity: "인천",
      toCity: "오사카",
      mode: "항공",
      hasTransfer: false,
      durationText: "1시간 40분",
      bookingStatus: "AVAILABLE",
    },
    {
      id: "tr-peer-2",
      fromCity: "오사카",
      toCity: "인천",
      mode: "항공",
      hasTransfer: false,
      durationText: "1시간 40분",
      bookingStatus: "AVAILABLE",
    },
  ],
};

const initialEmptyRoom: TripRoom = {
  id: tripId,
  title: "오사카 여행방",
  destination: "오사카",
  revision: RevisionSchema.make(1),
  members: [
    { id: hostId, name: "방장", role: "HOST" },
    { id: peerId, name: "동행자", role: "MEMBER" },
  ],
  plans: [],
  confirmedPlanId: undefined,
};

const roomWithPeerPlan: TripRoom = {
  ...initialEmptyRoom,
  revision: RevisionSchema.make(2),
  plans: [mockFirstPublishedPlan],
};

const hostSession: UserSession = {
  participantId: hostId,
  participantIds: [hostId],
  accountType: "REGISTERED",
  name: "방장",
  isAuthenticated: true,
};

const queryResult = (
  data: TripRoom = initialEmptyRoom,
  refetch = vi.fn<() => Promise<{ data: TripRoom; isError: boolean }>>().mockResolvedValue({ data, isError: false }),
): ReturnType<typeof useTripRoomRawQuery> =>
  ({
    data,
    isLoading: false,
    isError: false,
    error: null,
    refetch,
  }) as unknown as ReturnType<typeof useTripRoomRawQuery>;

const sessionResult = (
  data: UserSession | null = hostSession,
  isLoading = false,
  isError = false,
): ReturnType<typeof useSessionQuery> =>
  ({
    data,
    isLoading,
    isError,
    error: null,
  }) as ReturnType<typeof useSessionQuery>;

const mutationResult = (
  mutateAsync = vi.fn<(cmd: unknown) => Promise<TripRoom>>().mockResolvedValue(roomWithPeerPlan),
  isPending = false,
): ReturnType<typeof useCreatePlanMutation> =>
  ({ mutateAsync, isPending }) as unknown as ReturnType<
    typeof useCreatePlanMutation
  >;

function LocationProbe() {
  const location = useLocation();
  return (
    <>
      <output data-testid="location-path">{location.pathname}</output>
      <output data-testid="location-search">{location.search}</output>
      <output data-testid="location-state">
        {JSON.stringify(location.state)}
      </output>
    </>
  );
}

type TestInitialEntry =
  | string
  | {
      readonly pathname: string;
      readonly search?: string;
      readonly state?: Record<string, unknown>;
    };

function TestApp({
  initialEntry = basePath,
}: {
  readonly initialEntry?: TestInitialEntry;
}) {
  return (
    <MemoryRouter initialEntries={[initialEntry]}>
      <LocationProbe />
      <Routes>
        <Route
          path="/trips/:tripId/plans/new/:section?"
          element={<PlanCreatePage />}
        />
        <Route
          path="/trips/:tripId/plans/:planId"
          element={<p>완료 화면</p>}
        />
        <Route path="/trips/:tripId/plans" element={<p>여행방 목록</p>} />
        <Route path="/trips/:tripId/setup/companions" element={<p>동행자 초대</p>} />
        <Route path="*" element={<p>기타 경로</p>} />
      </Routes>
    </MemoryRouter>
  );
}

const renderPage = (initialEntry: TestInitialEntry = basePath) =>
  render(<TestApp initialEntry={initialEntry} />);

beforeEach(() => {
  localStorage.clear();
  mockOnlineStatus = true;
  mockUseSessionQuery.mockReset();
  mockUseTripRoomRawQuery.mockReset();
  mockUseCreatePlanMutation.mockReset();
  mockUseSessionQuery.mockReturnValue(sessionResult());
  mockUseTripRoomRawQuery.mockReturnValue(queryResult());
  mockUseCreatePlanMutation.mockReturnValue(mutationResult());
});

describe("M4 Empirical Challenge: Collaboration Boundaries & Concurrent Plan Creation", () => {
  it("Smoothly transitions button to '대안 여행안 등록하기' without input loss when peer creates first plan during review", async () => {
    const draftKey = getPlanEditorDraftKey(hostId, tripId, "new");
    const authorDraft: StoredPlanEditorDraft = {
      ownerId: hostId,
      title: "방장의 정성가득 2안",
      proposalReason: "교토 포함 일정",
      baseHeadcount: 4,
      routes: [
        { city: "오사카", arrivalDate: "2026-12-01", departureDate: "2026-12-03" },
        { city: "교토", arrivalDate: "2026-12-03", departureDate: "2026-12-05" },
      ],
      accommodations: [
        { id: "acc-1", city: "오사카", period: "2026-12-01 ~ 2026-12-03", nights: 2, hotelName: "호텔 A", bookingStatus: "AVAILABLE" },
        { id: "acc-2", city: "교토", period: "2026-12-03 ~ 2026-12-05", nights: 2, hotelName: "료칸 B", bookingStatus: "AVAILABLE" },
      ],
      transports: [
        { id: "tr-1", fromCity: "인천", toCity: "오사카", mode: "항공", hasTransfer: false, durationText: "1시간 40분", bookingStatus: "AVAILABLE" },
        { id: "tr-2", fromCity: "오사카", toCity: "교토", mode: "전철", hasTransfer: false, durationText: "40분", bookingStatus: "AVAILABLE" },
        { id: "tr-3", fromCity: "교토", toCity: "인천", mode: "항공", hasTransfer: false, durationText: "1시간 40분", bookingStatus: "AVAILABLE" },
      ],
      wizardCursor: { section: "review", question: "title" },
      updatedAt: "2026-09-03T00:00:00.000Z",
    };
    localStorage.setItem(draftKey, JSON.stringify(authorDraft));

    let currentRoom = initialEmptyRoom;
    mockUseTripRoomRawQuery.mockImplementation(() =>
      queryResult(currentRoom),
    );

    const alternativePlan: TripPlan = {
      id: PlanIdSchema.make("plan-alternative-2"),
      title: authorDraft.title,
      proposalReason: authorDraft.proposalReason,
      baseHeadcount: authorDraft.baseHeadcount,
      status: "VOTING",
      authorId: hostId,
      authorName: "방장",
      places: [],
      voteCount: 0,
      routes: [...authorDraft.routes],
      accommodations: [...authorDraft.accommodations],
      transports: [...authorDraft.transports],
    };
    const roomWithBothPlans: TripRoom = {
      ...roomWithPeerPlan,
      revision: RevisionSchema.make(3),
      plans: [mockFirstPublishedPlan, alternativePlan],
    };

    const mutateAsync = vi.fn<(cmd: unknown) => Promise<TripRoom>>().mockResolvedValue(roomWithBothPlans);
    mockUseCreatePlanMutation.mockReturnValue(mutationResult(mutateAsync));

    const { rerender } = renderPage(basePath);

    // Initial button text for first plan
    expect(await screen.findByRole("button", { name: "여행안 제안 등록" })).toBeInTheDocument();

    // Now peer publishes first plan! Background query refetches and room gets 1 plan & revision 2
    currentRoom = roomWithPeerPlan;
    rerender(<TestApp initialEntry={basePath} />);

    // Button MUST seamlessly become '대안 여행안 등록하기'
    const altSubmitBtn = await screen.findByRole("button", { name: "대안 여행안 등록하기" });
    expect(altSubmitBtn).toBeInTheDocument();
    expect(altSubmitBtn).toBeEnabled();

    // Form inputs and summary cards MUST NOT be wiped
    expect(screen.getByText("방장의 정성가득 2안")).toBeInTheDocument();
    expect(screen.getByText("오사카 2박 · 교토 2박")).toBeInTheDocument();
    expect(screen.getByText("2곳")).toBeInTheDocument();

    fireEvent.click(altSubmitBtn);

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          roomId: tripId,
          expectedRevision: 2,
          title: "방장의 정성가득 2안",
          proposalReason: "교토 포함 일정",
          baseHeadcount: 4,
          routes: expect.arrayContaining([
            expect.objectContaining({ city: "오사카" }),
            expect.objectContaining({ city: "교토" }),
          ]),
        }),
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId("location-path")).toHaveTextContent(
        `/trips/${tripId}/plans/${alternativePlan.id}`,
      );
    });

    // Verify localStorage draft is cleaned up after successful alternative creation
    expect(localStorage.getItem(draftKey)).toBeNull();
  });

  it("Preserves active question progress and input values when peer publishes plan while user is halfway through questions", async () => {
    // User is on transport status question of stop 0
    const draftKey = getPlanEditorDraftKey(hostId, tripId, "new");
    const halfDraft: StoredPlanEditorDraft = {
      ownerId: hostId,
      title: "동행 중 작성 중이던 계획",
      proposalReason: "맛집 투어",
      baseHeadcount: 3,
      routes: [
        { city: "도쿄", arrivalDate: "2026-11-10", departureDate: "2026-11-12" },
      ],
      accommodations: [
        { id: "acc-tokyo", city: "도쿄", period: "2026-11-10 ~ 2026-11-12", nights: 2, hotelName: "긴자 호텔", bookingStatus: "AVAILABLE" },
      ],
      transports: [
        { id: "tr-tokyo-1", fromCity: "김포", toCity: "도쿄", mode: "", hasTransfer: false, durationText: "", bookingStatus: "NOT_CHECKED" },
        { id: "tr-tokyo-2", fromCity: "도쿄", toCity: "김포", mode: "", hasTransfer: false, durationText: "", bookingStatus: "NOT_CHECKED" },
      ],
      wizardCursor: { section: "transport", question: "status", index: 0 },
      updatedAt: "2026-09-03T00:00:00.000Z",
    };
    localStorage.setItem(draftKey, JSON.stringify(halfDraft));

    // Room gets updated by peer
    mockUseTripRoomRawQuery.mockReturnValue(queryResult(roomWithPeerPlan));

    renderPage(`${basePath}/transport?question=status&index=0`);

    // Wizard mode remains active because savedWizardCursor is set
    expect(await screen.findByRole("heading", { name: /김포에서 도쿄\(으\)로 이동할 교통편을 정하셨나요\?/ })).toBeInTheDocument();
    const decidedOption = screen.getByRole("radio", { name: /정했어요/ });
    expect(decidedOption).toBeInTheDocument();

    // Click '정했어요' -> select decided
    fireEvent.click(decidedOption);

    // Click 다음 -> advances to mode question
    fireEvent.click(screen.getByRole("button", { name: "다음" }));

    await waitFor(() => {
      expect(screen.getByTestId("location-search")).toHaveTextContent("question=mode&index=0");
    });

    // Fill in transport mode (label: 교통수단 *)
    const modeInput = await screen.findByLabelText("교통수단 *");
    fireEvent.change(modeInput, { target: { value: "대한항공 KE703" } });

    // Advance to duration question
    fireEvent.click(screen.getByRole("button", { name: "다음" }));

    await waitFor(() => {
      expect(screen.getByTestId("location-search")).toHaveTextContent("question=duration&index=0");
    });

    // Fill in duration (label: 예상 소요시간 *)
    const durationInput = await screen.findByLabelText("예상 소요시간 *");
    fireEvent.change(durationInput, { target: { value: "2시간 15분" } });

    fireEvent.click(screen.getByRole("button", { name: "다음" }));

    // Verify localStorage updated cleanly with alternative plan data
    await waitFor(() => {
      const saved = parsePlanEditorDraft(localStorage.getItem(draftKey));
      expect(saved?.transports[0].mode).toBe("대한항공 KE703");
      expect(saved?.transports[0].durationText).toBe("2시간 15분");
      expect(saved?.title).toBe("동행 중 작성 중이던 계획");
    });
  });

  it("Recovers gracefully from 409 REVISION_CONFLICT on alternative plan submission without resetting user form inputs", async () => {
    const draftKey = getPlanEditorDraftKey(hostId, tripId, "new");
    const validDraft: StoredPlanEditorDraft = {
      ownerId: hostId,
      title: "동시성 충돌 복구 테스트 계획",
      proposalReason: "충돌 복구 검증",
      baseHeadcount: 2,
      routes: [
        { city: "제주", arrivalDate: "2026-10-01", departureDate: "2026-10-03" },
      ],
      accommodations: [
        { id: "acc-1", city: "제주", period: "2026-10-01 ~ 2026-10-03", nights: 2, hotelName: "그랜드 조선", bookingStatus: "AVAILABLE" },
      ],
      transports: [
        { id: "tr-1", fromCity: "김포", toCity: "제주", mode: "항공", hasTransfer: false, durationText: "1시간", bookingStatus: "AVAILABLE" },
        { id: "tr-2", fromCity: "제주", toCity: "김포", mode: "항공", hasTransfer: false, durationText: "1시간", bookingStatus: "AVAILABLE" },
      ],
      wizardCursor: { section: "review", question: "title" },
      updatedAt: "2026-09-03T00:00:00.000Z",
    };
    localStorage.setItem(draftKey, JSON.stringify(validDraft));

    const roomRevision3: TripRoom = {
      ...roomWithPeerPlan,
      revision: RevisionSchema.make(3),
    };

    let currentRoom = roomWithPeerPlan;
    const refetchMock = vi.fn<() => Promise<{ data: TripRoom; isError: boolean }>>().mockImplementation(async () => {
      currentRoom = roomRevision3;
      return { data: roomRevision3, isError: false };
    });
    mockUseTripRoomRawQuery.mockImplementation(() =>
      queryResult(currentRoom, refetchMock),
    );

    const createdAltPlan: TripPlan = {
      id: PlanIdSchema.make("plan-recovered-3"),
      title: validDraft.title,
      proposalReason: validDraft.proposalReason,
      baseHeadcount: validDraft.baseHeadcount,
      status: "VOTING",
      authorId: hostId,
      authorName: "방장",
      places: [],
      voteCount: 0,
      routes: [...validDraft.routes],
      accommodations: [...validDraft.accommodations],
      transports: [...validDraft.transports],
    };
    const roomAfterSuccess: TripRoom = {
      ...roomRevision3,
      revision: RevisionSchema.make(4),
      plans: [...roomRevision3.plans, createdAltPlan],
    };

    // First mutateAsync call fails with ApiClientError(409, REVISION_CONFLICT), second succeeds
    const mutateAsyncMock = vi
      .fn<(cmd: unknown) => Promise<TripRoom>>()
      .mockRejectedValueOnce(
        new ApiClientError({
          status: 409,
          code: "REVISION_CONFLICT",
          message: "다른 사용자가 먼저 변경했습니다.",
          details: { expectedRevision: 2, actualRevision: 3 },
        })
      )
      .mockResolvedValueOnce(roomAfterSuccess);

    mockUseCreatePlanMutation.mockReturnValue(mutationResult(mutateAsyncMock));

    renderPage(basePath);

    const submitBtn = await screen.findByRole("button", { name: "대안 여행안 등록하기" });
    fireEvent.click(submitBtn);

    // Conflict error should trigger refetch and display conflict alert
    await waitFor(() => {
      expect(refetchMock).toHaveBeenCalled();
      expect(screen.getByRole("alert")).toHaveTextContent("다른 사용자가 먼저 변경했습니다 (v2 → v3). 최신 내용을 확인한 뒤 다시 적용해주세요.");
    });

    // Crucial check: Draft and summary items MUST remain untouched and intact!
    expect(screen.getByText("동시성 충돌 복구 테스트 계획")).toBeInTheDocument();
    expect(screen.getByText("제주 2박")).toBeInTheDocument();

    // User clicks submit again -> will use updated revision 3!
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          roomId: tripId,
          expectedRevision: 3, // Retried with updated revision 3!
          title: "동시성 충돌 복구 테스트 계획",
        }),
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId("location-path")).toHaveTextContent(
        `/trips/${tripId}/plans/${createdAltPlan.id}`,
      );
    });
  });

  it("Prevents stale wizard redirect if user has entered any form progress (title or route)", async () => {
    // Stale empty wizard history (no title, no routes) redirects to /plans
    mockUseTripRoomRawQuery.mockReturnValue(queryResult(roomWithPeerPlan));

    const { unmount } = renderPage({
      pathname: basePath,
      state: { tripCreationWizard: true },
    });

    // Empty state redirects to /plans
    await waitFor(() => {
      expect(screen.getByTestId("location-path")).toHaveTextContent(`/trips/${tripId}/plans`);
    });
    unmount();

    // BUT if user has partial input (e.g. title typed), it should NOT redirect away to /plans
    const partialDraft: StoredPlanEditorDraft = {
      ownerId: hostId,
      title: "작성 중이던 제목",
      proposalReason: "",
      baseHeadcount: 2,
      routes: [],
      accommodations: [],
      transports: [],
      wizardCursor: { section: "basic", question: "title" },
      updatedAt: "2026-09-03T00:00:00.000Z",
    };
    localStorage.setItem(getPlanEditorDraftKey(hostId, tripId, "new"), JSON.stringify(partialDraft));

    renderPage({
      pathname: `${basePath}/basic?question=title`,
      state: { tripCreationWizard: true },
    });

    // Stays on the wizard question page!
    await waitFor(() => {
      expect(screen.getByLabelText("여행안 제목 *")).toHaveValue("작성 중이던 제목");
      expect(screen.getByTestId("location-path")).toHaveTextContent(`${basePath}/basic`);
    });
  });

  it("Guards against submission while offline and preserves localStorage draft intact", async () => {
    const draftKey = getPlanEditorDraftKey(hostId, tripId, "new");
    const validDraft: StoredPlanEditorDraft = {
      ownerId: hostId,
      title: "오프라인 계획",
      proposalReason: "네트워크 단절 테스트",
      baseHeadcount: 2,
      routes: [{ city: "제주", arrivalDate: "2026-10-01", departureDate: "2026-10-03" }],
      accommodations: [{ id: "acc-1", city: "제주", period: "2026-10-01 ~ 2026-10-03", nights: 2, hotelName: "호텔", bookingStatus: "AVAILABLE" }],
      transports: [
        { id: "tr-1", fromCity: "김포", toCity: "제주", mode: "항공", hasTransfer: false, durationText: "1시간", bookingStatus: "AVAILABLE" },
        { id: "tr-2", fromCity: "제주", toCity: "김포", mode: "항공", hasTransfer: false, durationText: "1시간", bookingStatus: "AVAILABLE" },
      ],
      wizardCursor: { section: "review", question: "title" },
      updatedAt: "2026-09-03T00:00:00.000Z",
    };
    localStorage.setItem(draftKey, JSON.stringify(validDraft));

    mockOnlineStatus = false; // Offline!
    mockUseTripRoomRawQuery.mockReturnValue(queryResult(roomWithPeerPlan));
    const mutateAsyncMock = vi.fn<(cmd: unknown) => Promise<TripRoom>>();
    mockUseCreatePlanMutation.mockReturnValue(mutationResult(mutateAsyncMock));

    renderPage(basePath);

    // Button should show disabled offline state
    const submitBtn = await screen.findByRole("button", { name: "온라인 연결 후 등록" });
    expect(submitBtn).toBeDisabled();

    // Mutation should not have been called
    expect(mutateAsyncMock).not.toHaveBeenCalled();

    // Draft in localStorage remains intact!
    expect(localStorage.getItem(draftKey)).not.toBeNull();
  });

  it("Preserves draft in localStorage when server mutation fails with an unhandled 500 error", async () => {
    const draftKey = getPlanEditorDraftKey(hostId, tripId, "new");
    const validDraft: StoredPlanEditorDraft = {
      ownerId: hostId,
      title: "서버 장애 대안 계획",
      proposalReason: "500 에러 처리 검증",
      baseHeadcount: 2,
      routes: [{ city: "부산", arrivalDate: "2026-10-01", departureDate: "2026-10-03" }],
      accommodations: [{ id: "acc-1", city: "부산", period: "2026-10-01 ~ 2026-10-03", nights: 2, hotelName: "호텔", bookingStatus: "AVAILABLE" }],
      transports: [
        { id: "tr-1", fromCity: "서울", toCity: "부산", mode: "KTX", hasTransfer: false, durationText: "2시간 30분", bookingStatus: "AVAILABLE" },
        { id: "tr-2", fromCity: "부산", toCity: "서울", mode: "KTX", hasTransfer: false, durationText: "2시간 30분", bookingStatus: "AVAILABLE" },
      ],
      wizardCursor: { section: "review", question: "title" },
      updatedAt: "2026-09-03T00:00:00.000Z",
    };
    localStorage.setItem(draftKey, JSON.stringify(validDraft));

    mockUseTripRoomRawQuery.mockReturnValue(queryResult(roomWithPeerPlan));
    const mutateAsyncMock = vi.fn<(cmd: unknown) => Promise<TripRoom>>().mockRejectedValue(new Error("Internal Server Error 500"));
    mockUseCreatePlanMutation.mockReturnValue(mutationResult(mutateAsyncMock));

    renderPage(basePath);

    const submitBtn = await screen.findByRole("button", { name: "대안 여행안 등록하기" });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Internal Server Error 500");
    });

    // Crucial check: Draft in localStorage must NOT be deleted on server errors
    const preserved = parsePlanEditorDraft(localStorage.getItem(draftKey));
    expect(preserved?.title).toBe("서버 장애 대안 계획");
  });
});
