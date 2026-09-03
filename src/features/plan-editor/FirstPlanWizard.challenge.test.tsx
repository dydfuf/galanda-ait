// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";

import { FirstPlanWizard } from "./components/FirstPlanWizard.tsx";
import { PlanCreatePage } from "./PlanCreatePage.tsx";
import {
  parseWizardCursor,
  normalizeWizardCursor,
} from "./first-plan-wizard-flow.ts";
import {
  getPlanEditorDraftKey,
  type PlanEditorFormData,
} from "./hooks/usePlanEditorState.ts";
import {
  ParticipantIdSchema,
  PlanIdSchema,
  RevisionSchema,
  TripIdSchema,
} from "../../core/domain/ids.ts";
import type { TripPlan, TripRoom, UserSession } from "../../core/domain/room.ts";

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

const mockUseSessionQuery = vi.mocked(useSessionQuery);
const mockUseTripRoomRawQuery = vi.mocked(useTripRoomRawQuery);
const mockUseCreatePlanMutation = vi.mocked(useCreatePlanMutation);

const tripId = TripIdSchema.make("trip-challenger-1");
const hostId = ParticipantIdSchema.make("participant-host-challenger");
const summaryPath = `/trips/${tripId}/plans/new`;

const mockRoom: TripRoom = {
  id: tripId,
  title: "도쿄 챌린지 여행",
  destination: "도쿄",
  revision: RevisionSchema.make(3),
  members: [{ id: hostId, name: "방장", role: "HOST" }],
  plans: [],
  confirmedPlanId: undefined,
};

const mockSession: UserSession = {
  participantId: hostId,
  participantIds: [hostId],
  accountType: "REGISTERED",
  name: "방장",
  isAuthenticated: true,
};

const mockFormData: PlanEditorFormData = {
  title: "도쿄 미식 탐방",
  proposalReason: "츠키지 시장과 긴자 오마카세",
  baseHeadcount: 2,
  routes: [
    { city: "도쿄", arrivalDate: "2026-11-01", departureDate: "2026-11-04" },
  ],
  accommodations: [
    {
      id: "acc-1",
      city: "도쿄",
      period: "2026-11-01 ~ 2026-11-04",
      nights: 3,
      hotelName: "도쿄 그랜드 호텔",
      isSearching: false,
      bookingStatus: "AVAILABLE",
    },
  ],
  transports: [
    {
      id: "tr-1",
      fromCity: "인천",
      toCity: "도쿄",
      mode: "항공",
      hasTransfer: false,
      durationText: "2시간 20분",
      bookingStatus: "AVAILABLE",
    },
    {
      id: "tr-2",
      fromCity: "도쿄",
      toCity: "인천",
      mode: "항공",
      hasTransfer: false,
      durationText: "2시간 40분",
      bookingStatus: "AVAILABLE",
    },
  ],
};

function LocationObserver() {
  const location = useLocation();
  return (
    <>
      <output data-testid="challenge-path">{location.pathname}</output>
      <output data-testid="challenge-search">{location.search}</output>
      <output data-testid="challenge-state">{JSON.stringify(location.state)}</output>
    </>
  );
}

function TestRouterApp({ initialEntry = `${summaryPath}/basic?question=title` }: { readonly initialEntry?: string }) {
  return (
    <MemoryRouter initialEntries={[initialEntry]}>
      <LocationObserver />
      <Routes>
        <Route
          path="/trips/:tripId/plans/new/:section?"
          element={<PlanCreatePage />}
        />
        <Route path="/trips/:tripId/plans/:planId" element={<div>완료 화면</div>} />
        <Route path="/trips/:tripId/plans" element={<div>여행방</div>} />
        <Route path="/trips/:tripId/setup/companions" element={<div>동행자 설정</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("Milestone 2 Challenger Suite: FirstPlanWizard & PlanCreatePage", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    mockUseSessionQuery.mockReturnValue({
      data: mockSession,
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useSessionQuery>);
    mockUseTripRoomRawQuery.mockReturnValue({
      data: mockRoom,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn().mockResolvedValue({ data: mockRoom, isError: false }),
    } as unknown as ReturnType<typeof useTripRoomRawQuery>);
    mockUseCreatePlanMutation.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({
        ...mockRoom,
        revision: RevisionSchema.make(4),
        plans: [
          {
            id: PlanIdSchema.make("plan-new-1"),
            status: "DRAFT",
            authorId: hostId,
            authorName: "방장",
            places: [],
            voteCount: 0,
            ...mockFormData,
          } as TripPlan,
        ],
      }),
      isPending: false,
    } as unknown as ReturnType<typeof useCreatePlanMutation>);
  });

  describe("1. Korean IME Composition Enter Suppression & Keyboard Navigation", () => {
    it("IME composition in Title input suppresses Enter progression (isComposing = true, keyCode = 229)", () => {
      const onNext = vi.fn();
      render(
        <FirstPlanWizard
          cursor={{ section: "basic", question: "title" }}
          formData={{ ...mockFormData, title: "제주도" }}
          onNext={onNext}
          onPrevious={vi.fn()}
        />
      );

      const titleInput = screen.getByLabelText("여행안 제목 *");

      // Syllable composition in progress: Enter keydown with isComposing = true
      fireEvent.keyDown(titleInput, {
        key: "Enter",
        isComposing: true,
        keyCode: 229,
      });
      expect(onNext).not.toHaveBeenCalled();

      // Another IME composition event (e.g. macOS Chrome/Safari composition keycode 229)
      fireEvent.keyDown(titleInput, {
        key: "Process",
        isComposing: true,
        keyCode: 229,
      });
      expect(onNext).not.toHaveBeenCalled();

      // Once composition finishes (isComposing: false, keyCode 13), Enter triggers onNext
      fireEvent.keyDown(titleInput, {
        key: "Enter",
        isComposing: false,
        keyCode: 13,
      });
      expect(onNext).toHaveBeenCalledTimes(1);
    });

    it("IME composition in Proposal Reason input suppresses Enter progression", () => {
      const onNext = vi.fn();
      render(
        <FirstPlanWizard
          cursor={{ section: "basic", question: "proposal-reason" }}
          formData={{ ...mockFormData, proposalReason: "온천" }}
          onNext={onNext}
          onPrevious={vi.fn()}
        />
      );

      const proposalInput = screen.getByLabelText("제안 이유 / 한 줄 요약 (선택)");

      fireEvent.keyDown(proposalInput, {
        key: "Enter",
        isComposing: true,
        keyCode: 229,
      });
      expect(onNext).not.toHaveBeenCalled();

      fireEvent.keyDown(proposalInput, {
        key: "Enter",
        isComposing: false,
        keyCode: 13,
      });
      expect(onNext).toHaveBeenCalledTimes(1);
    });

    it("Empty title with IME Enter does not trigger validation error or submit prematurely", () => {
      const onNext = vi.fn();
      render(
        <FirstPlanWizard
          cursor={{ section: "basic", question: "title" }}
          formData={{ ...mockFormData, title: "" }}
          onNext={onNext}
          onPrevious={vi.fn()}
        />
      );

      const titleInput = screen.getByLabelText("여행안 제목 *");
      fireEvent.keyDown(titleInput, {
        key: "Enter",
        isComposing: true,
        keyCode: 229,
      });

      expect(onNext).not.toHaveBeenCalled();
      expect(screen.queryByText("여행안 제목을 입력해주세요.")).not.toBeInTheDocument();
    });
  });

  describe("2. Rapid Double Clicks & Race Condition Defenses", () => {
    it("Rapid clicks on Next button invoke onNext for each click without crashing or jumping steps unexpectedly", () => {
      const onNext = vi.fn();
      render(
        <FirstPlanWizard
          cursor={{ section: "basic", question: "title" }}
          formData={mockFormData}
          onNext={onNext}
          onPrevious={vi.fn()}
        />
      );

      const nextButton = screen.getByRole("button", { name: "다음" });
      fireEvent.click(nextButton);
      fireEvent.click(nextButton);
      fireEvent.click(nextButton);

      expect(onNext).toHaveBeenCalledTimes(3);
    });

    it("Rapid clicks on Headcount Increment (+) disable button immediately upon reaching 20", () => {
      let count = 18;
      const onHeadcountChange = vi.fn((newVal: number) => {
        count = newVal;
      });

      const { rerender } = render(
        <FirstPlanWizard
          cursor={{ section: "basic", question: "headcount" }}
          formData={{ ...mockFormData, baseHeadcount: count }}
          onHeadcountChange={onHeadcountChange}
          onNext={vi.fn()}
          onPrevious={vi.fn()}
        />
      );

      const incBtn = screen.getByRole("button", { name: "비용 기준 인원 한 명 늘리기" });
      expect(incBtn).toBeEnabled();

      // Click 1: 18 -> 19
      fireEvent.click(incBtn);
      expect(onHeadcountChange).toHaveBeenLastCalledWith(19);

      rerender(
        <FirstPlanWizard
          cursor={{ section: "basic", question: "headcount" }}
          formData={{ ...mockFormData, baseHeadcount: 19 }}
          onHeadcountChange={onHeadcountChange}
          onNext={vi.fn()}
          onPrevious={vi.fn()}
        />
      );

      // Click 2: 19 -> 20
      fireEvent.click(incBtn);
      expect(onHeadcountChange).toHaveBeenLastCalledWith(20);

      rerender(
        <FirstPlanWizard
          cursor={{ section: "basic", question: "headcount" }}
          formData={{ ...mockFormData, baseHeadcount: 20 }}
          onHeadcountChange={onHeadcountChange}
          onNext={vi.fn()}
          onPrevious={vi.fn()}
        />
      );

      // Boundary reached: button must now be disabled
      expect(incBtn).toBeDisabled();
      fireEvent.click(incBtn);
      // Value must not exceed 20
      expect(onHeadcountChange).toHaveBeenCalledTimes(2);
    });

    it("Rapid clicks on Headcount Decrement (-) disable button immediately upon reaching 1", () => {
      let count = 2;
      const onHeadcountChange = vi.fn((newVal: number) => {
        count = newVal;
      });

      const { rerender } = render(
        <FirstPlanWizard
          cursor={{ section: "basic", question: "headcount" }}
          formData={{ ...mockFormData, baseHeadcount: count }}
          onHeadcountChange={onHeadcountChange}
          onNext={vi.fn()}
          onPrevious={vi.fn()}
        />
      );

      const decBtn = screen.getByRole("button", { name: "비용 기준 인원 한 명 줄이기" });
      expect(decBtn).toBeEnabled();

      // Click: 2 -> 1
      fireEvent.click(decBtn);
      expect(onHeadcountChange).toHaveBeenLastCalledWith(1);

      rerender(
        <FirstPlanWizard
          cursor={{ section: "basic", question: "headcount" }}
          formData={{ ...mockFormData, baseHeadcount: 1 }}
          onHeadcountChange={onHeadcountChange}
          onNext={vi.fn()}
          onPrevious={vi.fn()}
        />
      );

      // Boundary reached: button is disabled
      expect(decBtn).toBeDisabled();
      fireEvent.click(decBtn);
      expect(onHeadcountChange).toHaveBeenCalledTimes(1);
    });

    it("PlanCreatePage submission guards against rapid double clicks via isSubmittingRef", async () => {
      localStorage.setItem(
        getPlanEditorDraftKey(hostId, tripId, "new"),
        JSON.stringify({
          ownerId: hostId,
          ...mockFormData,
          updatedAt: "2026-09-02T12:00:00.000Z",
        })
      );

      let resolveMutation!: (val: unknown) => void;
      const mutationPromise = new Promise((resolve) => {
        resolveMutation = resolve;
      });
      const mutateAsync = vi.fn(() => mutationPromise);
      mockUseCreatePlanMutation.mockReturnValue({
        mutateAsync,
        isPending: false,
      } as unknown as ReturnType<typeof useCreatePlanMutation>);

      render(<TestRouterApp initialEntry={summaryPath} />);

      const submitBtn = await screen.findByRole("button", { name: "여행안 제안 등록" });
      await waitFor(() => expect(submitBtn).toBeEnabled());

      // Rapid double click
      fireEvent.click(submitBtn);
      fireEvent.click(submitBtn);
      fireEvent.click(submitBtn);

      // mutateAsync must be called exactly once due to isSubmittingRef guard
      expect(mutateAsync).toHaveBeenCalledTimes(1);

      await act(async () => {
        resolveMutation({
          ...mockRoom,
          revision: RevisionSchema.make(4),
          plans: [{ id: "plan-1", ...mockFormData }],
        });
      });
    });
  });

  describe("3. Whitespace-Only Title & Edge Case Title Validation", () => {
    it("Whitespace-only variations (spaces, tabs, newlines, unicode non-breaking spaces) disable Next and reject Enter", () => {
      const whitespaceVariants = [
        "",
        " ",
        "    ",
        "\t\t",
        "\n\r\n",
        "  \t  \n  ",
        "\u00A0\u00A0", // non-breaking space
        "\u3000\u3000", // fullwidth space
      ];

      for (const val of whitespaceVariants) {
        const onNext = vi.fn();
        const { unmount } = render(
          <FirstPlanWizard
            cursor={{ section: "basic", question: "title" }}
            formData={{ ...mockFormData, title: val }}
            onNext={onNext}
            onPrevious={vi.fn()}
          />
        );

        const nextBtn = screen.getByRole("button", { name: "다음" });
        expect(nextBtn).toBeDisabled();

        const input = screen.getByLabelText("여행안 제목 *");
        fireEvent.keyDown(input, { key: "Enter", isComposing: false, keyCode: 13 });
        expect(onNext).not.toHaveBeenCalled();

        // Error message appears after attempted submission
        expect(screen.getByText("여행안 제목을 입력해주세요.")).toBeInTheDocument();

        unmount();
      }
    });

    it("Single visible character surrounded by whitespace is valid", () => {
      const onNext = vi.fn();
      render(
        <FirstPlanWizard
          cursor={{ section: "basic", question: "title" }}
          formData={{ ...mockFormData, title: "   A   " }}
          onNext={onNext}
          onPrevious={vi.fn()}
        />
      );

      const nextBtn = screen.getByRole("button", { name: "다음" });
      expect(nextBtn).toBeEnabled();

      fireEvent.click(nextBtn);
      expect(onNext).toHaveBeenCalledTimes(1);
    });
  });

  describe("4. Stepper Boundaries (1 to 20) & Extreme Values", () => {
    it("Valid headcount bounds [1, 20] evaluate correctly in pure flow and wizard", () => {
      for (let count = 1; count <= 20; count += 1) {
        const { unmount } = render(
          <FirstPlanWizard
            cursor={{ section: "basic", question: "headcount" }}
            formData={{ ...mockFormData, baseHeadcount: count }}
            onNext={vi.fn()}
            onPrevious={vi.fn()}
          />
        );

        const nextBtn = screen.getByRole("button", { name: "다음: 여행 경로" });
        expect(nextBtn).toBeEnabled();
        expect(screen.getByText(`${count}명`)).toBeInTheDocument();
        unmount();
      }
    });

    it("Out-of-bounds headcount (< 1 or > 20) disables Next button", () => {
      const outOfBounds = [0, -1, -50, 21, 50, 100];

      for (const count of outOfBounds) {
        const { unmount } = render(
          <FirstPlanWizard
            cursor={{ section: "basic", question: "headcount" }}
            formData={{ ...mockFormData, baseHeadcount: count }}
            onNext={vi.fn()}
            onPrevious={vi.fn()}
          />
        );

        const nextBtn = screen.getByRole("button", { name: "다음: 여행 경로" });
        expect(nextBtn).toBeDisabled();
        unmount();
      }
    });
  });

  describe("5. Deep Link Navigation Across /plans/new/basic with Valid, Missing, and Invalid Query Parameters", () => {
    it("Navigating to /plans/new/basic without query param normalizes and redirects to ?question=title", async () => {
      render(<TestRouterApp initialEntry={`${summaryPath}/basic`} />);

      await waitFor(() => {
        expect(screen.getByTestId("challenge-path")).toHaveTextContent(`${summaryPath}/basic`);
        expect(screen.getByTestId("challenge-search")).toHaveTextContent("?question=title");
      });
      expect(screen.getByLabelText("여행안 제목 *")).toBeInTheDocument();
    });

    it("Navigating with valid query parameters renders exact corresponding question", async () => {
      // 1. Title
      const { unmount: unmount1 } = render(<TestRouterApp initialEntry={`${summaryPath}/basic?question=title`} />);
      await waitFor(() => {
        expect(screen.getByLabelText("여행안 제목 *")).toBeInTheDocument();
      });
      unmount1();

      // 2. Proposal Reason
      const { unmount: unmount2 } = render(<TestRouterApp initialEntry={`${summaryPath}/basic?question=proposal-reason`} />);
      await waitFor(() => {
        expect(screen.getByLabelText("제안 이유 / 한 줄 요약 (선택)")).toBeInTheDocument();
      });
      unmount2();

      // 3. Headcount
      const { unmount: unmount3 } = render(<TestRouterApp initialEntry={`${summaryPath}/basic?question=headcount`} />);
      await waitFor(() => {
        expect(screen.getByRole("group", { name: /비용 기준 인원/ })).toBeInTheDocument();
      });
      unmount3();
    });

    it("Navigating with invalid question query parameter (e.g. ?question=invalid_xyz) automatically normalizes to title", async () => {
      render(<TestRouterApp initialEntry={`${summaryPath}/basic?question=invalid_xyz`} />);

      await waitFor(() => {
        expect(screen.getByTestId("challenge-path")).toHaveTextContent(`${summaryPath}/basic`);
        expect(screen.getByTestId("challenge-search")).toHaveTextContent("?question=title");
      });
      expect(screen.getByLabelText("여행안 제목 *")).toBeInTheDocument();
    });

    it("Navigating with cross-section question under basic (e.g. ?question=city or ?question=hotel-name) normalizes to title", async () => {
      render(<TestRouterApp initialEntry={`${summaryPath}/basic?question=city`} />);

      await waitFor(() => {
        expect(screen.getByTestId("challenge-path")).toHaveTextContent(`${summaryPath}/basic`);
        expect(screen.getByTestId("challenge-search")).toHaveTextContent("?question=title");
      });
      expect(screen.getByLabelText("여행안 제목 *")).toBeInTheDocument();
    });

    it("Navigating with spurious index param under basic (e.g. ?question=title&index=5) strips index upon normalization", async () => {
      render(<TestRouterApp initialEntry={`${summaryPath}/basic?question=title&index=5`} />);

      await waitFor(() => {
        expect(screen.getByTestId("challenge-path")).toHaveTextContent(`${summaryPath}/basic`);
        expect(screen.getByTestId("challenge-search")).toHaveTextContent("?question=title");
      });
      expect(screen.getByLabelText("여행안 제목 *")).toBeInTheDocument();
    });

    it("Preserves returnToReview flag during deep link and normalizes accordingly", async () => {
      render(<TestRouterApp initialEntry={`${summaryPath}/basic?question=title&returnToReview=true`} />);

      await waitFor(() => {
        expect(screen.getByTestId("challenge-path")).toHaveTextContent(`${summaryPath}/basic`);
        expect(screen.getByTestId("challenge-search")).toHaveTextContent("?question=title&returnToReview=true");
      });
      // Previous button should say "검토로 돌아가기"
      expect(screen.getByRole("button", { name: "검토로 돌아가기" })).toBeInTheDocument();
    });

    it("Pure flow functions: parseWizardCursor and normalizeWizardCursor handle all edge cases", () => {
      // Empty params
      expect(parseWizardCursor(new URLSearchParams(""), "/trips/t1/plans/new/basic")).toEqual({
        section: "basic",
        question: "title",
      });

      // Malicious / corrupt search params
      expect(parseWizardCursor(new URLSearchParams("question=__proto__"), "/trips/t1/plans/new/basic")).toEqual({
        section: "basic",
        question: "title",
      });
      expect(parseWizardCursor(new URLSearchParams("question=constructor"), "/trips/t1/plans/new/basic")).toEqual({
        section: "basic",
        question: "title",
      });

      // Normalization of partial cursor
      const emptyForm: PlanEditorFormData = {
        title: "",
        proposalReason: "",
        baseHeadcount: 2,
        routes: [],
        accommodations: [],
        transports: [],
      };

      expect(normalizeWizardCursor({ section: "basic", question: "invalid" as any }, emptyForm)).toEqual({
        section: "basic",
        question: "title",
      });

      expect(normalizeWizardCursor({ section: "accommodation", question: "status" }, emptyForm)).toEqual({
        section: "route",
        question: "city",
        index: 0,
      });

      expect(normalizeWizardCursor({ section: "transport", question: "mode" }, emptyForm)).toEqual({
        section: "route",
        question: "city",
        index: 0,
      });
    });
  });

  describe("6. Autofocus with preventScroll: true Verification", () => {
    it("Verifies that all input focus calls in FirstPlanWizard use { preventScroll: true }", () => {
      const focusSpy = vi.spyOn(HTMLElement.prototype, "focus");

      // 1. Mount on basic/title
      const { rerender } = render(
        <FirstPlanWizard
          cursor={{ section: "basic", question: "title" }}
          formData={mockFormData}
          onNext={vi.fn()}
          onPrevious={vi.fn()}
        />
      );

      expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });
      focusSpy.mockClear();

      // 2. Transition to basic/proposal-reason
      rerender(
        <FirstPlanWizard
          cursor={{ section: "basic", question: "proposal-reason" }}
          formData={mockFormData}
          onNext={vi.fn()}
          onPrevious={vi.fn()}
        />
      );

      expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });
      focusSpy.mockClear();

      // 3. Transition to basic/headcount
      rerender(
        <FirstPlanWizard
          cursor={{ section: "basic", question: "headcount" }}
          formData={mockFormData}
          onNext={vi.fn()}
          onPrevious={vi.fn()}
        />
      );

      expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });
      focusSpy.mockRestore();
    });
  });
});
