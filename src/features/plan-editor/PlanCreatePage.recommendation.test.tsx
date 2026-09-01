// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import {
  ParticipantIdSchema,
  RevisionSchema,
  TripIdSchema,
} from "../../core/domain/ids.ts";
import type { TripRoom, UserSession } from "../../core/domain/room.ts";
import { getPlanEditorDraftKey } from "./hooks/usePlanEditorState.ts";

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
  useNextTripActionRecommendation: vi.fn(),
}));

import { useSessionQuery } from "../../hooks/useSession.ts";
import { useNextTripActionRecommendation } from "../common/use-next-trip-action-recommendation.ts";
import { useTripRoomRawQuery } from "../plan-detail/queries.ts";
import { useCreatePlanMutation } from "./mutations.ts";
import { PlanCreatePage } from "./PlanCreatePage.tsx";

const mockUseSessionQuery = vi.mocked(useSessionQuery);
const mockUseTripRoomRawQuery = vi.mocked(useTripRoomRawQuery);
const mockUseCreatePlanMutation = vi.mocked(useCreatePlanMutation);
const mockUseNextTripActionRecommendation = vi.mocked(
  useNextTripActionRecommendation,
);

const tripId = TripIdSchema.make("trip-recommendation-regression");
const hostId = ParticipantIdSchema.make("participant-host");
const summaryPath = `/trips/${tripId}/plans/new`;

const validEditorData = {
  title: "제주 가을 여행안",
  proposalReason: "이동 시간을 줄이고 여유 있게 둘러보는 일정",
  baseHeadcount: 2,
  routes: [
    {
      city: "제주",
      arrivalDate: "2026-10-10",
      departureDate: "2026-10-12",
    },
  ],
  accommodations: [
    {
      id: "stay-1",
      city: "제주",
      period: "2026-10-10 ~ 2026-10-12",
      nights: 2,
      hotelName: "제주 호텔",
      bookingStatus: "AVAILABLE" as const,
      priceRange: { min: 120_000, max: 180_000 },
    },
  ],
  transports: [
    {
      id: "transport-1",
      fromCity: "서울",
      toCity: "제주",
      mode: "항공",
      hasTransfer: false,
      durationText: "1시간 10분",
      bookingStatus: "AVAILABLE" as const,
    },
    {
      id: "transport-2",
      fromCity: "제주",
      toCity: "서울",
      mode: "항공",
      hasTransfer: false,
      durationText: "1시간 10분",
      bookingStatus: "AVAILABLE" as const,
    },
  ],
};

const room: TripRoom = {
  id: tripId,
  title: "제주 여행",
  destination: "제주",
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

const writeValidDraft = (): void => {
  localStorage.setItem(
    getPlanEditorDraftKey(hostId, tripId, "new"),
    JSON.stringify({
      ownerId: hostId,
      ...validEditorData,
      updatedAt: "2026-09-01T00:00:00.000Z",
    }),
  );
};

const renderReview = () => {
  writeValidDraft();
  return render(
    <MemoryRouter
      initialEntries={[
        {
          pathname: summaryPath,
          state: {
            tripCreationWizard: true,
            wizardReview: true,
          },
        },
      ]}
    >
      <Routes>
        <Route
          path="/trips/:tripId/plans/new/:section?"
          element={<PlanCreatePage />}
        />
      </Routes>
    </MemoryRouter>,
  );
};

beforeEach(() => {
  localStorage.clear();
  mockUseSessionQuery.mockReset();
  mockUseTripRoomRawQuery.mockReset();
  mockUseCreatePlanMutation.mockReset();
  mockUseNextTripActionRecommendation.mockReset();

  mockUseSessionQuery.mockReturnValue({
    data: session,
    isLoading: false,
    isError: false,
    error: null,
  } as ReturnType<typeof useSessionQuery>);
  mockUseTripRoomRawQuery.mockReturnValue({
    data: room,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn().mockResolvedValue({ data: room, isError: false }),
  } as unknown as ReturnType<typeof useTripRoomRawQuery>);
  mockUseCreatePlanMutation.mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useCreatePlanMutation>);
});

describe("PlanCreatePage recommendation fallback", () => {
  it("AI 추천을 불러오는 중에도 검토·등록 CTA를 유지한다", async () => {
    mockUseNextTripActionRecommendation.mockReturnValue({
      data: null,
      isPending: true,
    } as unknown as ReturnType<typeof useNextTripActionRecommendation>);

    renderReview();

    expect(
      await screen.findByRole("button", { name: "여행안 제안 등록" }),
    ).toBeEnabled();
    expect(screen.getByRole("button", { name: "이전: 교통" })).toBeEnabled();
  });

  it("AI 추천 조회가 실패해도 검토·등록 CTA를 유지한다", async () => {
    mockUseNextTripActionRecommendation.mockReturnValue({
      data: null,
      isPending: false,
      isError: true,
      error: new Error("recommendation unavailable"),
    } as unknown as ReturnType<typeof useNextTripActionRecommendation>);

    renderReview();

    expect(
      await screen.findByRole("button", { name: "여행안 제안 등록" }),
    ).toBeEnabled();
    expect(screen.getByRole("button", { name: "이전: 교통" })).toBeEnabled();
  });
});
