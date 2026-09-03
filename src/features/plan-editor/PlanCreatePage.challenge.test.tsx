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

vi.mock("../plan-detail/queries.ts", () => ({
  useTripRoomRawQuery: vi.fn(),
}));
vi.mock("../../hooks/useSession.ts", () => ({
  useSessionQuery: vi.fn(),
}));
vi.mock("./mutations.ts", () => ({
  useCreatePlanMutation: vi.fn(),
}));
vi.mock("../common/use-next-trip-action-recommendation.ts", () => ({
  useNextTripActionRecommendation: vi.fn(() => ({
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

const tripId = TripIdSchema.make("trip-challenge-1");
const hostId = ParticipantIdSchema.make("participant-host-1");
const peerId = ParticipantIdSchema.make("participant-peer-2");
const basePath = `/trips/${tripId}/plans/new`;

const mockPlan1: TripPlan = {
  id: PlanIdSchema.make("plan-existing-1"),
  title: "기존 1번 여행안",
  proposalReason: "기존 여행안 이유",
  baseHeadcount: 3,
  status: "DRAFT",
  authorId: hostId,
  authorName: "방장",
  places: [],
  voteCount: 0,
  routes: [
    { city: "부산", arrivalDate: "2026-11-01", departureDate: "2026-11-03" },
  ],
  accommodations: [
    {
      id: "stay-p1",
      city: "부산",
      period: "2026-11-01 ~ 2026-11-03",
      nights: 2,
      hotelName: "해운대 호텔",
      bookingStatus: "AVAILABLE",
    },
  ],
  transports: [
    {
      id: "tr-p1",
      fromCity: "서울",
      toCity: "부산",
      mode: "KTX",
      hasTransfer: false,
      durationText: "2시간 30분",
      bookingStatus: "AVAILABLE",
    },
    {
      id: "tr-p2",
      fromCity: "부산",
      toCity: "서울",
      mode: "KTX",
      hasTransfer: false,
      durationText: "2시간 30분",
      bookingStatus: "AVAILABLE",
    },
  ],
};

const emptyRoom: TripRoom = {
  id: tripId,
  title: "도쿄 여행",
  destination: "도쿄",
  revision: RevisionSchema.make(1),
  members: [
    { id: hostId, name: "방장", role: "HOST" },
    { id: peerId, name: "동행자", role: "MEMBER" },
  ],
  plans: [],
  confirmedPlanId: undefined,
};

const roomWithExistingPlan: TripRoom = {
  ...emptyRoom,
  revision: RevisionSchema.make(2),
  plans: [mockPlan1],
};

const session: UserSession = {
  participantId: hostId,
  participantIds: [hostId],
  accountType: "REGISTERED",
  name: "방장",
  isAuthenticated: true,
};

const queryResult = (
  data: TripRoom = emptyRoom,
  refetch = vi.fn().mockResolvedValue({ data, isError: false }),
): ReturnType<typeof useTripRoomRawQuery> =>
  ({
    data,
    isLoading: false,
    isError: false,
    error: null,
    refetch,
  }) as unknown as ReturnType<typeof useTripRoomRawQuery>;

const sessionResult = (
  data: UserSession | null = session,
): ReturnType<typeof useSessionQuery> =>
  ({
    data,
    isLoading: false,
    isError: false,
    error: null,
  }) as ReturnType<typeof useSessionQuery>;

const mutationResult = (
  mutateAsync = vi.fn().mockResolvedValue(roomWithExistingPlan),
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
  mockUseSessionQuery.mockReset();
  mockUseTripRoomRawQuery.mockReset();
  mockUseCreatePlanMutation.mockReset();
  mockUseSessionQuery.mockReturnValue(sessionResult());
  mockUseTripRoomRawQuery.mockReturnValue(queryResult());
  mockUseCreatePlanMutation.mockReturnValue(mutationResult());
});

describe("PlanCreatePage Empirical Challenge", () => {
  describe("1. Mode Bifurcation Verification", () => {
    it("First plan creation (0 plans, no clone) mounts FirstPlanWizard on question routes", async () => {
      mockUseTripRoomRawQuery.mockReturnValue(queryResult(emptyRoom));

      renderPage(`${basePath}/basic?question=title`);

      // Progress bar should be 4-stage and indicate Step 3: First Plan / Basic Info
      const progress = await screen.findByRole("navigation", {
        name: "여행 만들기 진행 단계",
      });
      expect(progress).toHaveTextContent("3/4");
      expect(progress).toHaveTextContent("첫 여행안 · 기본 정보");

      // Wizard question shell elements
      expect(screen.getByText("여행안의 이름을 지어주세요")).toBeInTheDocument();
      expect(screen.getByLabelText("여행안 제목 *")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "다음" })).toBeInTheDocument();
    });

    it("First plan creation at review endpoint mounts Review Stage with 4-stage Progress Bar and PlanEditorSections", async () => {
      mockUseTripRoomRawQuery.mockReturnValue(queryResult(emptyRoom));

      // Preset a valid draft in localStorage so validation passes
      localStorage.setItem(
        getPlanEditorDraftKey(hostId, tripId, "new"),
        JSON.stringify({
          ownerId: hostId,
          title: "유효한 여행안",
          proposalReason: "여유로운 힐링",
          baseHeadcount: 2,
          routes: [{ city: "도쿄", arrivalDate: "2026-10-01", departureDate: "2026-10-04" }],
          accommodations: [{ id: "acc-1", city: "도쿄", period: "2026-10-01 ~ 2026-10-04", nights: 3, hotelName: "호텔", bookingStatus: "AVAILABLE" }],
          transports: [
            { id: "tr-1", fromCity: "인천", toCity: "도쿄", mode: "항공", hasTransfer: false, durationText: "2시간", bookingStatus: "AVAILABLE" },
            { id: "tr-2", fromCity: "도쿄", toCity: "인천", mode: "항공", hasTransfer: false, durationText: "2시간", bookingStatus: "AVAILABLE" },
          ],
          updatedAt: "2026-08-18T00:00:00.000Z",
        }),
      );

      renderPage(basePath);

      // Review progress: Step 4/4 검토·등록
      const progress = await screen.findByRole("navigation", {
        name: "여행 만들기 진행 단계",
      });
      expect(progress).toHaveTextContent("4/4");
      expect(progress).toHaveTextContent("검토");

      // Review action button
      expect(
        screen.getByRole("button", { name: "여행안 제안 등록" }),
      ).toBeInTheDocument();
    });

    it("Clone mode (?cloneFrom=plan-id) bypasses FirstPlanWizard and uses PlanEditorSections without 4-stage wizard progress", async () => {
      mockUseTripRoomRawQuery.mockReturnValue(queryResult(roomWithExistingPlan));

      renderPage(`${basePath}?cloneFrom=${mockPlan1.id}`);

      // Must NOT render 4-stage trip creation progress
      expect(
        screen.queryByRole("navigation", { name: "여행 만들기 진행 단계" }),
      ).not.toBeInTheDocument();

      // Must render Section Editor header for clone mode
      expect(
        screen.getByRole("heading", {
          level: 1,
          name: "복제해 새 대안 제안하기",
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "대안 여행안 제안하기" }),
      ).toBeInTheDocument();
    });

    it("Second / subsequent plan creation (room has plans, direct entry without wizard state) uses Section Editor", async () => {
      mockUseTripRoomRawQuery.mockReturnValue(queryResult(roomWithExistingPlan));

      renderPage(`${basePath}/basic`);

      // Must NOT render 4-stage trip creation progress
      expect(
        screen.queryByRole("navigation", { name: "여행 만들기 진행 단계" }),
      ).not.toBeInTheDocument();

      // Must render standard Section Editor heading
      expect(screen.getByRole("heading", { level: 1, name: "기본 정보" })).toBeVisible();
      expect(screen.getByRole("button", { name: "편집 완료" })).toBeEnabled();
    });

    it("Collaboration boundary: preserves active wizard draft as alternative plan if peer publishes first plan concurrently", async () => {
      // User started drafting with wizard
      localStorage.setItem(
        getPlanEditorDraftKey(hostId, tripId, "new"),
        JSON.stringify({
          ownerId: hostId,
          title: "방장의 첫 여행안 초안",
          proposalReason: "온천 코스",
          baseHeadcount: 2,
          routes: [{ city: "도쿄", arrivalDate: "2026-10-01", departureDate: "2026-10-04" }],
          accommodations: [{ id: "acc-1", city: "도쿄", period: "2026-10-01 ~ 2026-10-04", nights: 3, hotelName: "호텔", bookingStatus: "AVAILABLE" }],
          transports: [
            { id: "tr-1", fromCity: "인천", toCity: "도쿄", mode: "항공", hasTransfer: false, durationText: "2시간", bookingStatus: "AVAILABLE" },
            { id: "tr-2", fromCity: "도쿄", toCity: "인천", mode: "항공", hasTransfer: false, durationText: "2시간", bookingStatus: "AVAILABLE" },
          ],
          wizardCursor: { section: "basic", question: "title" },
          updatedAt: "2026-08-18T00:00:00.000Z",
        }),
      );

      // Meanwhile, room now has 1 plan published by peer
      mockUseTripRoomRawQuery.mockReturnValue(queryResult(roomWithExistingPlan));

      renderPage(`${basePath}/basic?question=title`);

      // Wizard mode is maintained because savedWizardCursor is present!
      const progress = await screen.findByRole("navigation", {
        name: "여행 만들기 진행 단계",
      });
      expect(progress).toHaveTextContent("3/4");
      expect(progress).toHaveTextContent("첫 여행안 · 기본 정보");

      expect(screen.getByLabelText("여행안 제목 *")).toHaveValue("방장의 첫 여행안 초안");
    });
  });

  describe("2. Draft Auto-save and Hydration Across Basic Questions", () => {
    it("Auto-saves draft and wizardCursor to localStorage as user edits and transitions through questions", async () => {
      mockUseTripRoomRawQuery.mockReturnValue(queryResult(emptyRoom));
      renderPage(`${basePath}/basic?question=title`);

      const draftKey = getPlanEditorDraftKey(hostId, tripId, "new");

      // Step 1: Title input
      const titleInput = await screen.findByLabelText("여행안 제목 *");
      fireEvent.change(titleInput, { target: { value: "새로운 오사카 여행" } });

      // Check auto-save in localStorage
      await waitFor(() => {
        const raw = localStorage.getItem(draftKey);
        expect(raw).toBeTruthy();
        const draft = parsePlanEditorDraft(raw);
        expect(draft?.title).toBe("새로운 오사카 여행");
        expect(draft?.wizardCursor?.question).toBe("title");
      });

      // Advance to Proposal Reason
      const nextBtn = screen.getByRole("button", { name: "다음" });
      fireEvent.click(nextBtn);

      await waitFor(() => {
        expect(screen.getByLabelText("제안 이유 / 한 줄 요약 (선택)")).toBeInTheDocument();
        expect(screen.getByTestId("location-search")).toHaveTextContent("question=proposal-reason");
      });

      // Check wizardCursor updated to proposal-reason
      await waitFor(() => {
        const draft = parsePlanEditorDraft(localStorage.getItem(draftKey));
        expect(draft?.wizardCursor?.question).toBe("proposal-reason");
      });

      // Step 2: Enter Proposal Reason
      const proposalInput = screen.getByLabelText("제안 이유 / 한 줄 요약 (선택)");
      fireEvent.change(proposalInput, { target: { value: "미식과 유니버설 스튜디오" } });

      await waitFor(() => {
        const draft = parsePlanEditorDraft(localStorage.getItem(draftKey));
        expect(draft?.proposalReason).toBe("미식과 유니버설 스튜디오");
      });

      // Advance to Headcount
      fireEvent.click(screen.getByRole("button", { name: "다음" }));

      await waitFor(() => {
        expect(screen.getByRole("group", { name: /비용 기준 인원/ })).toBeInTheDocument();
        expect(screen.getByTestId("location-search")).toHaveTextContent("question=headcount");
      });

      // Check wizardCursor updated to headcount
      await waitFor(() => {
        const draft = parsePlanEditorDraft(localStorage.getItem(draftKey));
        expect(draft?.wizardCursor?.question).toBe("headcount");
      });

      // Step 3: Increment Headcount from 2 to 4
      const incBtn = screen.getByRole("button", { name: "비용 기준 인원 한 명 늘리기" });
      fireEvent.click(incBtn);
      fireEvent.click(incBtn);

      await waitFor(() => {
        const draft = parsePlanEditorDraft(localStorage.getItem(draftKey));
        expect(draft?.baseHeadcount).toBe(4);
      });
    });

    it("Hydrates draft state and resumes at saved question upon fresh page load", async () => {
      const draftKey = getPlanEditorDraftKey(hostId, tripId, "new");
      const savedDraft: StoredPlanEditorDraft = {
        ownerId: hostId,
        title: "후쿠오카 힐링 여행",
        proposalReason: "온천과 라멘 투어",
        baseHeadcount: 3,
        routes: [],
        accommodations: [],
        transports: [],
        wizardCursor: { section: "basic", question: "headcount" },
        updatedAt: "2026-09-02T12:00:00.000Z",
      };
      localStorage.setItem(draftKey, JSON.stringify(savedDraft));

      mockUseTripRoomRawQuery.mockReturnValue(queryResult(emptyRoom));

      // User visits basic question=headcount
      renderPage(`${basePath}/basic?question=headcount`);

      await waitFor(() => {
        expect(screen.getByRole("group", { name: /비용 기준 인원/ })).toBeInTheDocument();
      });

      expect(screen.getByText("3명")).toBeInTheDocument();

      // Go back to proposal reason -> check hydrated proposal reason
      fireEvent.click(screen.getByRole("button", { name: "이전" }));
      await waitFor(() => {
        expect(screen.getByLabelText("제안 이유 / 한 줄 요약 (선택)")).toHaveValue("온천과 라멘 투어");
      });

      // Go back to title -> check hydrated title
      fireEvent.click(screen.getByRole("button", { name: "이전" }));
      await waitFor(() => {
        expect(screen.getByLabelText("여행안 제목 *")).toHaveValue("후쿠오카 힐링 여행");
      });
    });

    it("Seamlessly handles legacy draft lacking wizardCursor without crashing", async () => {
      const draftKey = getPlanEditorDraftKey(hostId, tripId, "new");
      const legacyDraft = {
        ownerId: hostId,
        title: "레거시 초안 제목",
        proposalReason: "레거시 이유",
        baseHeadcount: 2,
        routes: [],
        accommodations: [],
        transports: [],
        updatedAt: "2026-08-01T00:00:00.000Z",
      };
      localStorage.setItem(draftKey, JSON.stringify(legacyDraft));

      mockUseTripRoomRawQuery.mockReturnValue(queryResult(emptyRoom));

      renderPage(`${basePath}/basic`);

      // Should default safely to basic/title
      const titleInput = await screen.findByLabelText("여행안 제목 *");
      expect(titleInput).toHaveValue("레거시 초안 제목");
    });

    it("Maintains user draft isolation: does NOT hydrate peer's draft", async () => {
      // Peer has a draft saved
      const peerDraftKey = getPlanEditorDraftKey(peerId, tripId, "new");
      localStorage.setItem(
        peerDraftKey,
        JSON.stringify({
          ownerId: peerId,
          title: "동행자의 비밀 초안",
          proposalReason: "비밀",
          baseHeadcount: 5,
          routes: [],
          accommodations: [],
          transports: [],
          updatedAt: "2026-08-01T00:00:00.000Z",
        }),
      );

      mockUseTripRoomRawQuery.mockReturnValue(queryResult(emptyRoom));
      // Current session is hostId
      mockUseSessionQuery.mockReturnValue(sessionResult(session));

      renderPage(`${basePath}/basic?question=title`);

      const titleInput = await screen.findByLabelText("여행안 제목 *");
      // Must NOT contain peer's draft
      expect(titleInput).toHaveValue("");
    });
  });

  describe("3. URL Normalization, Focus Management, and IME Composition", () => {
    it("Normalizes invalid question parameter to default question of section", async () => {
      mockUseTripRoomRawQuery.mockReturnValue(queryResult(emptyRoom));

      renderPage(`${basePath}/basic?question=invalid_unknown_question`);

      await waitFor(() => {
        expect(screen.getByLabelText("여행안 제목 *")).toBeInTheDocument();
      });
    });

    it("Autofocuses input on cursor transitions", async () => {
      mockUseTripRoomRawQuery.mockReturnValue(queryResult(emptyRoom));

      renderPage(`${basePath}/basic?question=title`);

      const titleInput = await screen.findByLabelText("여행안 제목 *");
      expect(titleInput).toHaveFocus();

      fireEvent.change(titleInput, { target: { value: "제목 입력" } });
      fireEvent.click(screen.getByRole("button", { name: "다음" }));

      await waitFor(() => {
        const proposalInput = screen.getByLabelText("제안 이유 / 한 줄 요약 (선택)");
        expect(proposalInput).toHaveFocus();
      });
    });

    it("Guards against IME composition Enter submissions", async () => {
      mockUseTripRoomRawQuery.mockReturnValue(queryResult(emptyRoom));

      renderPage(`${basePath}/basic?question=title`);

      const titleInput = await screen.findByLabelText("여행안 제목 *");
      fireEvent.change(titleInput, { target: { value: "제주도" } });

      // Simulate IME composition Enter (keyCode 229 or isComposing = true)
      fireEvent.keyDown(titleInput, { key: "Enter", isComposing: true, keyCode: 229 });

      // Should remain on title question
      expect(screen.getByLabelText("여행안 제목 *")).toBeInTheDocument();
      expect(screen.queryByLabelText("제안 이유 / 한 줄 요약 (선택)")).not.toBeInTheDocument();

      // Non-composing Enter submits to next question
      fireEvent.keyDown(titleInput, { key: "Enter", isComposing: false });

      await waitFor(() => {
        expect(screen.getByLabelText("제안 이유 / 한 줄 요약 (선택)")).toBeInTheDocument();
      });
    });
  });

  describe("4. Review Return-to-Review and Jump Handling", () => {
    it("Directly returns to Review (/plans/new) when editing from review with returnToReview=true", async () => {
      // Valid draft
      localStorage.setItem(
        getPlanEditorDraftKey(hostId, tripId, "new"),
        JSON.stringify({
          ownerId: hostId,
          title: "도쿄 여행안",
          proposalReason: "여유로운 힐링",
          baseHeadcount: 2,
          routes: [{ city: "도쿄", arrivalDate: "2026-10-01", departureDate: "2026-10-04" }],
          accommodations: [{ id: "acc-1", city: "도쿄", period: "2026-10-01 ~ 2026-10-04", nights: 3, hotelName: "호텔", bookingStatus: "AVAILABLE" }],
          transports: [
            { id: "tr-1", fromCity: "인천", toCity: "도쿄", mode: "항공", hasTransfer: false, durationText: "2시간", bookingStatus: "AVAILABLE" },
            { id: "tr-2", fromCity: "도쿄", toCity: "인천", mode: "항공", hasTransfer: false, durationText: "2시간", bookingStatus: "AVAILABLE" },
          ],
          updatedAt: "2026-08-18T00:00:00.000Z",
        }),
      );

      mockUseTripRoomRawQuery.mockReturnValue(queryResult(emptyRoom));
      renderPage(basePath);

      // In Review stage, click "기본 정보" 수정 link
      const basicEditLink = await screen.findByRole("button", { name: /기본 정보/ });
      fireEvent.click(basicEditLink);

      await waitFor(() => {
        expect(screen.getByLabelText("여행안 제목 *")).toBeInTheDocument();
        expect(screen.getByTestId("location-search")).toHaveTextContent("returnToReview=true");
      });

      // Bottom buttons should show "검토로 돌아가기" and "다음"
      expect(screen.getByRole("button", { name: "검토로 돌아가기" })).toBeInTheDocument();

      // Modify title and click 다음 -> should return directly to review
      const titleInput = screen.getByLabelText("여행안 제목 *");
      fireEvent.change(titleInput, { target: { value: "수정된 도쿄 여행안" } });

      const nextBtn = screen.getByRole("button", { name: "다음" });
      fireEvent.click(nextBtn);

      await waitFor(() => {
        expect(screen.getByTestId("location-path")).toHaveTextContent(basePath);
        expect(screen.getByTestId("location-search")).toBeEmptyDOMElement();
      });
      expect(screen.getByRole("navigation", { name: "여행 만들기 진행 단계" })).toHaveTextContent("4/4");
    });
  });
});
