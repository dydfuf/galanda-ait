// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";

import {
  ParticipantIdSchema,
  PlanIdSchema,
  RevisionSchema,
  TripIdSchema,
} from "../core/domain/ids.ts";
import type {
  TripPlan,
  TripRoom,
  UserSession,
} from "../core/domain/room.ts";

const mocks = vi.hoisted(() => ({
  createPlan: vi.fn<(...args: any[]) => any>(),
  createTrip: vi.fn<(...args: any[]) => any>(),
  goBack: vi.fn<(...args: any[]) => any>(),
  shareTripInvite: vi.fn<(...args: any[]) => any>(),
  useAppNavigation: vi.fn<(...args: any[]) => any>(),
  useCreatePlanMutation: vi.fn<(...args: any[]) => any>(),
  useCreateTripRoomMutation: vi.fn<(...args: any[]) => any>(),
  useNextTripActionRecommendation: vi.fn<(...args: any[]) => any>(),
  useSessionQuery: vi.fn<(...args: any[]) => any>(),
  useTripRoomRawQuery: vi.fn<(...args: any[]) => any>(),
  useTripRoomsQuery: vi.fn<(...args: any[]) => any>(),
}));

vi.mock("../hooks/useAppNavigation.ts", () => ({
  useAppNavigation: mocks.useAppNavigation,
}));
vi.mock("../hooks/useSession.ts", () => ({
  useSessionQuery: mocks.useSessionQuery,
}));
vi.mock("../features/plan-home/queries.ts", () => ({
  useTripRoomsQuery: mocks.useTripRoomsQuery,
}));
vi.mock("../features/plan-detail/queries.ts", () => ({
  useTripRoomRawQuery: mocks.useTripRoomRawQuery,
}));
vi.mock("../features/trip-create/mutations.ts", () => ({
  useCreateTripRoomMutation: mocks.useCreateTripRoomMutation,
}));
vi.mock("../features/plan-editor/mutations.ts", () => ({
  useCreatePlanMutation: mocks.useCreatePlanMutation,
}));
vi.mock("../features/common/use-next-trip-action-recommendation.ts", () => ({
  useNextTripActionRecommendation: mocks.useNextTripActionRecommendation,
}));
vi.mock("../features/invite/share-trip-invite.ts", () => ({
  shareTripInvite: mocks.shareTripInvite,
}));

import type { useAppNavigation } from "../hooks/useAppNavigation.ts";
import type { useSessionQuery } from "../hooks/useSession.ts";
import { PlanCreatePage } from "../features/plan-editor/PlanCreatePage.tsx";
import type { useCreatePlanMutation } from "../features/plan-editor/mutations.ts";
import type { useNextTripActionRecommendation } from "../features/common/use-next-trip-action-recommendation.ts";
import type { useTripRoomRawQuery } from "../features/plan-detail/queries.ts";
import type { useTripRoomsQuery } from "../features/plan-home/queries.ts";
import { TripCreatePage } from "../features/trip-create/TripCreatePage.tsx";
import type { useCreateTripRoomMutation } from "../features/trip-create/mutations.ts";
import { TripListPage } from "../features/trip-list/TripListPage.tsx";
import { TripCompanionSetupPage } from "../features/trip-setup/TripCompanionSetupPage.tsx";
import { PlanHomePage } from "../features/plan-home/PlanHomePage.tsx";

const tripId = TripIdSchema.make("trip-e2e-adv-1");
const planId = PlanIdSchema.make("plan-e2e-adv-1");
const hostId = ParticipantIdSchema.make("participant-host-1");
const peerId = ParticipantIdSchema.make("participant-peer-2");

const baseRoom: TripRoom = {
  id: tripId,
  title: "신규 제주 탐방",
  destination: "",
  revision: RevisionSchema.make(1),
  members: [{ id: hostId, name: "방장", role: "HOST" }],
  plans: [],
  confirmedPlanId: undefined,
};

const session: UserSession = {
  participantId: hostId,
  participantIds: [hostId],
  accountType: "REGISTERED",
  name: "방장",
  isAuthenticated: true,
};

function LocationProbe() {
  const location = useLocation();
  return (
    <div>
      <output data-testid="location-path">{location.pathname}</output>
      <output data-testid="location-search">{location.search}</output>
    </div>
  );
}

function PlanDetailProbe() {
  const navigate = useNavigate();
  return (
    <div>
      <p>여행안 상세 화면</p>
      <button type="button" onClick={() => navigate(-1)}>
        브라우저 뒤로
      </button>
    </div>
  );
}

function TestApp({ initialEntry = "/trips" }: { initialEntry?: string }) {
  return (
    <MemoryRouter initialEntries={[initialEntry]}>
      <LocationProbe />
      <Routes>
        <Route path="/trips" element={<TripListPage />} />
        <Route path="/trips/new" element={<TripCreatePage />} />
        <Route
          path="/trips/:tripId/setup/companions"
          element={<TripCompanionSetupPage />}
        />
        <Route
          path="/trips/:tripId/plans/new/:section?"
          element={<PlanCreatePage />}
        />
        <Route
          path="/trips/:tripId/plans/:planId"
          element={<PlanDetailProbe />}
        />
        <Route path="/trips/:tripId/plans" element={<PlanHomePage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("End-to-End Adversarial Trip Creation Flow", () => {
  let currentRoom: TripRoom;

  beforeEach(() => {
    localStorage.clear();
    Object.values(mocks).forEach((mock) => mock.mockReset());
    currentRoom = { ...baseRoom, plans: [] };

    mocks.createTrip.mockImplementation(async (variables: any) => {
      currentRoom = { ...currentRoom, title: variables.title };
      return currentRoom;
    });

    mocks.createPlan.mockImplementation(async (variables: any) => {
      const { roomId: _roomId, expectedRevision: _expectedRevision, ...planFields } = variables;
      const created: TripPlan = {
        id: planId,
        authorId: hostId,
        authorName: "방장",
        status: "VOTING",
        voteCount: 0,
        places: [],
        ...planFields,
      };
      currentRoom = {
        ...currentRoom,
        revision: RevisionSchema.make((currentRoom.revision as number) + 1),
        plans: [...currentRoom.plans, created],
      };
      return currentRoom;
    });

    mocks.shareTripInvite.mockResolvedValue("copied");
    mocks.useAppNavigation.mockReturnValue({
      goBack: mocks.goBack,
      platformNavigation: undefined,
    } as unknown as ReturnType<typeof useAppNavigation>);

    mocks.useSessionQuery.mockReturnValue({
      data: session,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useSessionQuery>);

    mocks.useTripRoomRawQuery.mockImplementation(() => ({
      data: currentRoom,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn().mockImplementation(async () => ({
        data: currentRoom,
        isError: false,
      })),
    }) as unknown as ReturnType<typeof useTripRoomRawQuery>);

    mocks.useTripRoomsQuery.mockReturnValue({
      data: [currentRoom],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useTripRoomsQuery>);

    mocks.useCreateTripRoomMutation.mockReturnValue({
      mutateAsync: mocks.createTrip,
      isPending: false,
    } as unknown as ReturnType<typeof useCreateTripRoomMutation>);

    mocks.useCreatePlanMutation.mockReturnValue({
      mutateAsync: mocks.createPlan,
      isPending: false,
    } as unknown as ReturnType<typeof useCreatePlanMutation>);

    mocks.useNextTripActionRecommendation.mockReturnValue({
      data: null,
      isPending: false,
    } as unknown as ReturnType<typeof useNextTripActionRecommendation>);
  });

  it("1. Empirically verifies complete scratch flow: TripCreate -> Companions -> Wizard -> Review -> Publish with zero seeded localStorage", async () => {
    // Zero localStorage
    expect(localStorage.length).toBe(0);

    render(<TestApp initialEntry="/trips/new" />);

    // Stage 1: TripCreatePage
    expect(screen.getByTestId("location-path")).toHaveTextContent("/trips/new");
    const tripTitleInput = screen.getByLabelText("여행 이름 *");
    fireEvent.change(tripTitleInput, { target: { value: "신규 제주 탐방" } });
    fireEvent.click(screen.getByRole("button", { name: "여행 만들고 계속" }));

    // Stage 2: TripCompanionSetupPage
    await waitFor(() =>
      expect(screen.getByTestId("location-path")).toHaveTextContent(
        `/trips/${tripId}/setup/companions`,
      ),
    );
    expect(mocks.createTrip).toHaveBeenCalledWith({ title: "신규 제주 탐방" });

    // Companion Setup -> Proceed to Wizard
    fireEvent.click(screen.getByRole("button", { name: "미정으로 두고 다음" }));

    // Stage 3: FirstPlanWizard - Basic Info (Title)
    await waitFor(() =>
      expect(screen.getByTestId("location-path")).toHaveTextContent(
        `/trips/${tripId}/plans/new/basic`,
      ),
    );
    const progressNav = screen.getByRole("navigation", { name: "여행 만들기 진행 단계" });
    expect(progressNav).toHaveTextContent("3/4");
    expect(progressNav).toHaveTextContent("첫 여행안 · 기본 정보");

    const planTitleInput = await screen.findByLabelText("여행안 제목 *");
    fireEvent.change(planTitleInput, { target: { value: "제주 힐링 투어" } });
    fireEvent.click(screen.getByRole("button", { name: "다음" }));

    // Basic Info - Proposal Reason (Skipped)
    await waitFor(() =>
      expect(screen.getByLabelText("제안 이유 / 한 줄 요약 (선택)")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: "건너뛰기" }));

    // Basic Info - Headcount (Adjust from 1 to 3)
    await waitFor(() =>
      expect(screen.getByRole("group", { name: /비용 기준 인원/ })).toBeInTheDocument(),
    );
    const increaseHeadcountBtn = screen.getByRole("button", { name: "비용 기준 인원 한 명 늘리기" });
    fireEvent.click(increaseHeadcountBtn); // 2
    fireEvent.click(increaseHeadcountBtn); // 3
    fireEvent.click(screen.getByRole("button", { name: "다음: 여행 경로" }));

    // Route - City 0
    await waitFor(() =>
      expect(screen.getByTestId("location-path")).toHaveTextContent(
        `/trips/${tripId}/plans/new/route`,
      ),
    );
    expect(screen.getByRole("navigation", { name: "여행 만들기 진행 단계" })).toHaveTextContent("첫 여행안 · 여행 경로");

    const cityInput = await screen.findByLabelText("방문 도시 *");
    fireEvent.change(cityInput, { target: { value: "제주" } });
    fireEvent.click(screen.getByRole("button", { name: "다음" }));

    // Route - Arrival Date 0
    const arrivalInput = await screen.findByLabelText("도착일 *");
    fireEvent.change(arrivalInput, { target: { value: "2026-10-15" } });
    fireEvent.click(screen.getByRole("button", { name: "다음" }));

    // Route - Departure Date 0
    const departureInput = await screen.findByLabelText("출발일 *");
    fireEvent.change(departureInput, { target: { value: "2026-10-18" } });
    fireEvent.click(screen.getByRole("button", { name: "다음" }));

    // Route - Add City Prompt (finish route step)
    const nextAccBtn = await screen.findByRole("button", { name: "다음: 숙소" });
    fireEvent.click(nextAccBtn);

    // Accommodation - Status 0 (Searching)
    await waitFor(() =>
      expect(screen.getByTestId("location-path")).toHaveTextContent(
        `/trips/${tripId}/plans/new/accommodation`,
      ),
    );
    expect(screen.getByRole("navigation", { name: "여행 만들기 진행 단계" })).toHaveTextContent("첫 여행안 · 숙소");
    const searchingRadio = screen.getByRole("radio", { name: /알아보는 중/ });
    fireEvent.click(searchingRadio);
    fireEvent.click(screen.getByRole("button", { name: "다음: 교통" }));

    // Transport - Leg 0 (Outbound: 서울 -> 제주)
    await waitFor(() =>
      expect(screen.getByTestId("location-path")).toHaveTextContent(
        `/trips/${tripId}/plans/new/transport`,
      ),
    );
    expect(screen.getByRole("navigation", { name: "여행 만들기 진행 단계" })).toHaveTextContent("첫 여행안 · 교통");
    // Endpoints - Leg 0: Fill fromCity ("서울")
    const fromInputLeg0 = await screen.findByLabelText("출발지 *");
    fireEvent.change(fromInputLeg0, { target: { value: "서울" } });
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    // Status (Not Checked)
    const notCheckedLeg0 = await screen.findByRole("radio", { name: /아직 안 정함/ });
    fireEvent.click(notCheckedLeg0);
    fireEvent.click(screen.getByRole("button", { name: "다음" }));

    // Transport - Leg 1 (Return: 제주 -> 서울)
    // Endpoints - Leg 1: Fill toCity ("서울")
    const toInputLeg1 = await screen.findByLabelText("도착지 *");
    fireEvent.change(toInputLeg1, { target: { value: "서울" } });
    fireEvent.click(await screen.findByRole("button", { name: "다음" }));
    // Status (Not Checked) -> Proceed to Review
    const notCheckedLeg1 = await screen.findByRole("radio", { name: /아직 안 정함/ });
    fireEvent.click(notCheckedLeg1);
    fireEvent.click(screen.getByRole("button", { name: "입력 내용 검토하기" }));

    // Stage 4: Review (/trips/:tripId/plans/new)
    await waitFor(() =>
      expect(screen.getByTestId("location-path")).toHaveTextContent(
        `/trips/${tripId}/plans/new`,
      ),
    );
    expect(screen.getByRole("navigation", { name: "여행 만들기 진행 단계" })).toHaveTextContent("4/4");
    expect(screen.getByRole("navigation", { name: "여행 만들기 진행 단계" })).toHaveTextContent("검토");

    // Verify Review Jump Link: Click "기본 정보" row
    const editBasicBtn = screen.getByRole("button", { name: /기본 정보/ });
    fireEvent.click(editBasicBtn);

    // Should jump with returnToReview=true
    await waitFor(() =>
      expect(screen.getByTestId("location-search")).toHaveTextContent("returnToReview=true"),
    );
    expect(screen.getByText("검토로 돌아가기")).toBeInTheDocument();

    // Return to Review via button
    fireEvent.click(screen.getByRole("button", { name: "검토로 돌아가기" }));

    await waitFor(() =>
      expect(screen.getByTestId("location-path")).toHaveTextContent(
        `/trips/${tripId}/plans/new`,
      ),
    );

    // Final Publish Action: "여행안 제안 등록"
    const submitBtn = screen.getByRole("button", { name: "여행안 제안 등록" });
    expect(submitBtn).toBeEnabled();
    fireEvent.click(submitBtn);

    // Verify Create Plan Mutation payload
    await waitFor(() => expect(mocks.createPlan).toHaveBeenCalledTimes(1));
    const mutationArgs = mocks.createPlan.mock.calls[0][0] as any;
    expect(mutationArgs.roomId).toBe(tripId);
    expect(mutationArgs.expectedRevision).toBe(1);
    expect(mutationArgs.title).toBe("제주 힐링 투어");
    expect(mutationArgs.proposalReason).toBeUndefined();
    expect(mutationArgs.baseHeadcount).toBe(3);
    expect(mutationArgs.routes).toEqual([
      { city: "제주", arrivalDate: "2026-10-15", departureDate: "2026-10-18" },
    ]);
    expect(mutationArgs.accommodations[0].isSearching).toBe(true);
    expect(mutationArgs.accommodations[0].hotelName).toBe("");
    expect(mutationArgs.transports[0].bookingStatus).toBe("NOT_CHECKED");
    expect(mutationArgs.transports[1].bookingStatus).toBe("NOT_CHECKED");

    // Verify Navigation to Plan Detail
    await waitFor(() =>
      expect(screen.getByTestId("location-path")).toHaveTextContent(
        `/trips/${tripId}/plans/${planId}`,
      ),
    );

    // Test History Anchor: Clicking browser back from plan detail goes to /trips/:tripId/plans
    fireEvent.click(screen.getByRole("button", { name: "브라우저 뒤로" }));
    await waitFor(() =>
      expect(screen.getByTestId("location-path")).toHaveTextContent(
        `/trips/${tripId}/plans`,
      ),
    );
  });

  it("2. Empirically verifies multi-city route with date gap and repeated same-city visits", async () => {
    render(<TestApp initialEntry={`/trips/${tripId}/plans/new/route?question=city&index=0`} />);

    // Stop 1: 도쿄 (11/01 ~ 11/03)
    fireEvent.change(await screen.findByLabelText("방문 도시 *"), { target: { value: "도쿄" } });
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    fireEvent.change(await screen.findByLabelText("도착일 *"), { target: { value: "2026-11-01" } });
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    fireEvent.change(await screen.findByLabelText("출발일 *"), { target: { value: "2026-11-03" } });
    fireEvent.click(screen.getByRole("button", { name: "다음" }));

    // Add City 2
    fireEvent.click(await screen.findByRole("button", { name: "+ 도시 추가하기" }));

    // Stop 2: 하코네 (11/05 ~ 11/07) -> Gap from 11/03 to 11/05 permitted!
    fireEvent.change(await screen.findByLabelText("방문 도시 *"), { target: { value: "하코네" } });
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    fireEvent.change(await screen.findByLabelText("도착일 *"), { target: { value: "2026-11-05" } });
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    expect(screen.queryByText("이전 도시의 출발일보다 앞선 날짜입니다")).not.toBeInTheDocument();
    fireEvent.change(await screen.findByLabelText("출발일 *"), { target: { value: "2026-11-07" } });
    fireEvent.click(screen.getByRole("button", { name: "다음" }));

    // Add City 3 (Repeated visit to 도쿄) -> Permitted!
    fireEvent.click(await screen.findByRole("button", { name: "+ 도시 추가하기" }));
    fireEvent.change(await screen.findByLabelText("방문 도시 *"), { target: { value: "도쿄" } });
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    fireEvent.change(await screen.findByLabelText("도착일 *"), { target: { value: "2026-11-07" } });
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    fireEvent.change(await screen.findByLabelText("출발일 *"), { target: { value: "2026-11-09" } });
    fireEvent.click(screen.getByRole("button", { name: "다음" }));

    // Proceed to Accommodations
    fireEvent.click(await screen.findByRole("button", { name: "다음: 숙소" }));

    await waitFor(() =>
      expect(screen.getByTestId("location-path")).toHaveTextContent(
        `/trips/${tripId}/plans/new/accommodation`,
      ),
    );
  });

  it("3. Empirically verifies interruption and resume from PlanHome with exact cursor", async () => {
    // Seed draft as if user was in the middle of accommodations
    const draftKey = `galanda_draft_${hostId}_${tripId}_new`;
    localStorage.setItem(
      draftKey,
      JSON.stringify({
        ownerId: hostId,
        title: "진행 중인 도쿄 여행",
        proposalReason: "",
        baseHeadcount: 2,
        routes: [{ city: "도쿄", arrivalDate: "2026-11-01", departureDate: "2026-11-04" }],
        accommodations: [{ id: "acc-1", city: "도쿄", period: "2026-11-01 ~ 2026-11-04", nights: 3, hotelName: "", isSearching: true, bookingStatus: "NOT_CHECKED" }],
        transports: [],
        wizardCursor: { section: "accommodation", question: "status", index: 0 },
        updatedAt: "2026-08-30T00:00:00.000Z",
      }),
    );

    render(<TestApp initialEntry={`/trips/${tripId}/plans`} />);

    // PlanHomePage should render "이어서 작성하기" CTA
    const resumeBtn = await screen.findByRole("button", { name: "이어서 작성하기" });
    expect(resumeBtn).toBeInTheDocument();

    fireEvent.click(resumeBtn);

    // Should navigate directly to saved cursor
    await waitFor(() =>
      expect(screen.getByTestId("location-path")).toHaveTextContent(
        `/trips/${tripId}/plans/new/accommodation`,
      ),
    );
    expect(screen.getByTestId("location-search")).toHaveTextContent("question=status&index=0");
  });

  it("4. Empirically verifies concurrent plan publication transitions submit CTA to alternative plan", async () => {
    // Seed draft with wizardCursor
    const draftKey = `galanda_draft_${hostId}_${tripId}_new`;
    localStorage.setItem(
      draftKey,
      JSON.stringify({
        ownerId: hostId,
        title: "내 첫 여행안",
        proposalReason: "",
        baseHeadcount: 2,
        routes: [{ city: "제주", arrivalDate: "2026-10-15", departureDate: "2026-10-18" }],
        accommodations: [{ id: "acc-1", city: "제주", period: "2026-10-15 ~ 2026-10-18", nights: 3, hotelName: "", isSearching: true, bookingStatus: "NOT_CHECKED" }],
        transports: [
          { id: "tr-1", fromCity: "서울", toCity: "제주", mode: "", hasTransfer: false, durationText: "", bookingStatus: "NOT_CHECKED" },
          { id: "tr-2", fromCity: "제주", toCity: "서울", mode: "", hasTransfer: false, durationText: "", bookingStatus: "NOT_CHECKED" },
        ],
        wizardCursor: { section: "review", question: "title" },
        updatedAt: "2026-08-30T00:00:00.000Z",
      }),
    );

    // Initially 0 plans in currentRoom
    currentRoom = { ...baseRoom, plans: [] };

    const { rerender } = render(<TestApp initialEntry={`/trips/${tripId}/plans/new`} />);

    // Review stage with 0 plans -> "여행안 제안 등록"
    expect(await screen.findByRole("button", { name: "여행안 제안 등록" })).toBeInTheDocument();

    // Now simulate peer participant publishes a plan concurrently
    currentRoom = {
      ...currentRoom,
      revision: RevisionSchema.make(2),
      plans: [
        {
          id: PlanIdSchema.make("plan-peer-1"),
          title: "동행자가 먼저 등록한 플랜",
          proposalReason: "",
          baseHeadcount: 2,
          routes: [{ city: "제주", arrivalDate: "2026-10-15", departureDate: "2026-10-18" }],
          accommodations: [],
          transports: [],
          places: [],
          status: "VOTING",
          authorId: peerId,
          authorName: "동행자",
          voteCount: 0,
        },
      ],
    };

    // Re-render to reflect updated query response
    rerender(<TestApp initialEntry={`/trips/${tripId}/plans/new`} />);

    // Button should smoothly transition to "대안 여행안 등록하기"
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "대안 여행안 등록하기" }),
      ).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: "대안 여행안 등록하기" }));

    await waitFor(() => expect(mocks.createPlan).toHaveBeenCalledTimes(1));
    const mutationArgs = mocks.createPlan.mock.calls[0][0] as {
      expectedRevision: number;
    };
    expect(mutationArgs.expectedRevision).toBe(2);
  });
});
