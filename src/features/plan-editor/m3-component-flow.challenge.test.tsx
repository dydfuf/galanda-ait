// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";

import {
  ParticipantIdSchema,
  RevisionSchema,
  TripIdSchema,
} from "../../core/domain/ids.ts";
import type { TripRoom, UserSession } from "../../core/domain/room.ts";
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

const tripId = TripIdSchema.make("trip-m3-comp-1");
const hostId = ParticipantIdSchema.make("participant-m3-host");
const basePath = `/trips/${tripId}/plans/new`;

const emptyRoom: TripRoom = {
  id: tripId,
  title: "제주도 힐링 여행",
  destination: "제주",
  revision: RevisionSchema.make(1),
  members: [
    {
      id: hostId,
      name: "주최자",
      role: "HOST",
    },
  ],
  plans: [],
};

const mockHostSession: UserSession = {
  participantId: hostId,
  participantIds: [hostId],
  accountType: "REGISTERED",
  name: "주최자",
  isAuthenticated: true,
};

function LocationDisplay() {
  const location = useLocation();
  return (
    <div data-testid="location-display">
      {location.pathname}
      {location.search}
    </div>
  );
}

function renderPlanCreatePage(initialEntry = `${basePath}/basic?question=title`) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path="/trips/:tripId/plans/new"
          element={
            <>
              <PlanCreatePage />
              <LocationDisplay />
            </>
          }
        />
        <Route
          path="/trips/:tripId/plans/new/:section"
          element={
            <>
              <PlanCreatePage />
              <LocationDisplay />
            </>
          }
        />
        <Route
          path="/trips/:tripId/plans"
          element={<div data-testid="plans-index-page">Plans Index Page</div>}
        />
        <Route
          path="/trips/:tripId/plans/:planId"
          element={<div data-testid="plan-detail-page">Plan Detail Page</div>}
        />
        <Route
          path="/trips/:tripId/setup/companions"
          element={<div data-testid="companions-page">Companions Page</div>}
        />
      </Routes>
    </MemoryRouter>
  );
}

describe("M3.2 Component & Navigation Flow Challenges", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();

    mockUseTripRoomRawQuery.mockReturnValue({
      data: emptyRoom,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useTripRoomRawQuery>);

    mockUseSessionQuery.mockReturnValue({
      data: mockHostSession,
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useSessionQuery>);

    mockUseCreatePlanMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useCreatePlanMutation>);
  });

  afterEach(() => {
    cleanup();
  });

  // =========================================================================
  // 1. OUT-OF-BOUNDS URL CURSOR NAVIGATION IN PlanCreatePage
  // =========================================================================
  describe("Out-of-Bounds URL Navigation & URL Normalization", () => {
    it("Redirects and normalizes out-of-bounds route cursor to nearest valid question", async () => {
      renderPlanCreatePage(`${basePath}/route?question=arrival-date&index=5`);

      await waitFor(() => {
        const location = screen.getByTestId("location-display").textContent;
        expect(location).toContain("/route");
        expect(location).toContain("question=arrival-date");
        expect(location).toContain("index=0");
      });
    });

    it("Redirects accommodation and transport sections back to route if routes array is empty", async () => {
      renderPlanCreatePage(`${basePath}/accommodation?question=status&index=0`);

      await waitFor(() => {
        const location = screen.getByTestId("location-display").textContent;
        expect(location).toContain("/route");
        expect(location).toContain("question=city");
        expect(location).toContain("index=0");
      });

      cleanup();

      renderPlanCreatePage(`${basePath}/transport?question=endpoints&index=2`);

      await waitFor(() => {
        const location = screen.getByTestId("location-display").textContent;
        expect(location).toContain("/route");
        expect(location).toContain("question=city");
        expect(location).toContain("index=0");
      });
    });
  });

  // =========================================================================
  // 2. RETURN-TO-REVIEW FLOW IN PlanCreatePage
  // =========================================================================
  describe("Return-to-Review Mode Interactions", () => {
    it("Review screen '수정' jumps to granular question with returnToReview=true and returns to Review after editing", async () => {
      const draft: StoredPlanEditorDraft = {
        ownerId: hostId,
        title: "완전한 제주 여행",
        proposalReason: "여유로운 힐링",
        baseHeadcount: 2,
        routes: [
          { city: "제주시", arrivalDate: "2026-10-10", departureDate: "2026-10-12" },
        ],
        accommodations: [
          {
            id: "acc-1",
            city: "제주시",
            period: "2026-10-10 ~ 2026-10-12",
            nights: 2,
            hotelName: "신라스테이",
            isSearching: false,
            bookingStatus: "AVAILABLE",
          },
        ],
        transports: [
          {
            id: "tr-1",
            fromCity: "김포",
            toCity: "제주시",
            mode: "항공",
            hasTransfer: false,
            durationText: "1시간",
            bookingStatus: "AVAILABLE",
          },
          {
            id: "tr-2",
            fromCity: "제주시",
            toCity: "김포",
            mode: "항공",
            hasTransfer: false,
            durationText: "1시간",
            bookingStatus: "AVAILABLE",
          },
        ],
        updatedAt: "2026-09-02T12:00:00.000Z",
      };
      localStorage.setItem(getPlanEditorDraftKey(hostId, tripId, "new"), JSON.stringify(draft));

      // Render directly into the jump target
      renderPlanCreatePage(`${basePath}/basic?question=title&returnToReview=true`);

      await waitFor(() => {
        expect(screen.getByDisplayValue("완전한 제주 여행")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "검토로 돌아가기" })).toBeInTheDocument();
      });

      // Clicking Next in returnToReview mode returns to Review
      const nextBtn = screen.getByRole("button", { name: "다음" });
      fireEvent.click(nextBtn);

      await waitFor(() => {
        const location = screen.getByTestId("location-display").textContent;
        expect(location).toBe(basePath);
      });
    });

    it("Clicking '검토로 돌아가기' (previous button) returns immediately to Review without progressing backward through previous questions", async () => {
      const draft: StoredPlanEditorDraft = {
        ownerId: hostId,
        title: "완전한 제주 여행",
        proposalReason: "여유로운 힐링",
        baseHeadcount: 2,
        routes: [
          { city: "제주시", arrivalDate: "2026-10-10", departureDate: "2026-10-12" },
        ],
        accommodations: [
          {
            id: "acc-1",
            city: "제주시",
            period: "2026-10-10 ~ 2026-10-12",
            nights: 2,
            hotelName: "신라스테이",
            isSearching: false,
            bookingStatus: "AVAILABLE",
          },
        ],
        transports: [
          {
            id: "tr-1",
            fromCity: "김포",
            toCity: "제주시",
            mode: "항공",
            hasTransfer: false,
            durationText: "1시간",
            bookingStatus: "AVAILABLE",
          },
          {
            id: "tr-2",
            fromCity: "제주시",
            toCity: "김포",
            mode: "항공",
            hasTransfer: false,
            durationText: "1시간",
            bookingStatus: "AVAILABLE",
          },
        ],
        updatedAt: "2026-09-02T12:00:00.000Z",
      };
      localStorage.setItem(getPlanEditorDraftKey(hostId, tripId, "new"), JSON.stringify(draft));

      // Jump to route departure date edit with returnToReview=true
      renderPlanCreatePage(`${basePath}/route?question=departure-date&index=0&returnToReview=true`);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "검토로 돌아가기" })).toBeInTheDocument();
      });

      const backBtn = screen.getByRole("button", { name: "검토로 돌아가기" });
      fireEvent.click(backBtn);

      await waitFor(() => {
        const location = screen.getByTestId("location-display").textContent;
        expect(location).toBe(basePath);
      });
    });
  });

  // =========================================================================
  // 3. DRAFT AUTO-SAVE & RECOVERY
  // =========================================================================
  describe("Draft Auto-Save & Recovery with URL Cursor", () => {
    it("Modifying question fields automatically auto-saves the current URL cursor and form values into localStorage", async () => {
      renderPlanCreatePage(`${basePath}/basic?question=title`);

      await waitFor(() => {
        expect(screen.getByLabelText(/여행안 제목/)).toBeInTheDocument();
      });

      const titleInput = screen.getByLabelText(/여행안 제목/);
      fireEvent.change(titleInput, { target: { value: "새로운 오사카 여행" } });

      await waitFor(() => {
        const raw = localStorage.getItem(getPlanEditorDraftKey(hostId, tripId, "new"));
        expect(raw).toBeTruthy();
        const parsed = parsePlanEditorDraft(raw);
        expect(parsed?.title).toBe("새로운 오사카 여행");
        expect(parsed?.wizardCursor).toEqual({
          section: "basic",
          question: "title",
        });
      });
    });
  });
});
