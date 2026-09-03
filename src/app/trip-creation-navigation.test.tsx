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
  createPlan: vi.fn<(...args: unknown[]) => unknown>(),
  createTrip: vi.fn<(...args: unknown[]) => unknown>(),
  goBack: vi.fn<(...args: unknown[]) => unknown>(),
  shareTripInvite: vi.fn<(...args: unknown[]) => unknown>(),
  useAppNavigation: vi.fn<(...args: unknown[]) => unknown>(),
  useCreatePlanMutation: vi.fn<(...args: unknown[]) => unknown>(),
  useCreateTripRoomMutation: vi.fn<(...args: unknown[]) => unknown>(),
  useNextTripActionRecommendation: vi.fn<(...args: unknown[]) => unknown>(),
  useSessionQuery: vi.fn<(...args: unknown[]) => unknown>(),
  useTripRoomRawQuery: vi.fn<(...args: unknown[]) => unknown>(),
  useTripRoomsQuery: vi.fn<(...args: unknown[]) => unknown>(),
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
import { getPlanEditorDraftKey } from "../features/plan-editor/hooks/usePlanEditorState.ts";
import type { useNextTripActionRecommendation } from "../features/common/use-next-trip-action-recommendation.ts";
import type { useTripRoomRawQuery } from "../features/plan-detail/queries.ts";
import type { useTripRoomsQuery } from "../features/plan-home/queries.ts";
import { TripCreatePage } from "../features/trip-create/TripCreatePage.tsx";
import type { useCreateTripRoomMutation } from "../features/trip-create/mutations.ts";
import { TripListPage } from "../features/trip-list/TripListPage.tsx";
import { TripCompanionSetupPage } from "../features/trip-setup/TripCompanionSetupPage.tsx";

const tripId = TripIdSchema.make("trip-created");
const planId = PlanIdSchema.make("plan-created");
const hostId = ParticipantIdSchema.make("participant-host");
const planHomePath = `/trips/${tripId}/plans`;
const planEditorPath = `${planHomePath}/new`;

const editorData = {
  title: "첫 제주 여행안",
  proposalReason: "예약 전 항목은 미정 상태로 함께 검토해요.",
  baseHeadcount: 1,
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
      hotelName: "",
      isSearching: true,
      bookingStatus: "AVAILABLE" as const,
    },
  ],
  transports: [
    {
      id: "transport-1",
      fromCity: "서울",
      toCity: "제주",
      mode: "",
      hasTransfer: false,
      durationText: "",
      bookingStatus: "NOT_CHECKED" as const,
    },
    {
      id: "transport-2",
      fromCity: "제주",
      toCity: "서울",
      mode: "",
      hasTransfer: false,
      durationText: "",
      bookingStatus: "NOT_CHECKED" as const,
    },
  ],
};

const room: TripRoom = {
  id: tripId,
  title: "제주 여행",
  destination: "",
  revision: RevisionSchema.make(1),
  members: [{ id: hostId, name: "방장", role: "HOST" }],
  plans: [],
  confirmedPlanId: undefined,
};

const createdPlan: TripPlan = {
  id: planId,
  ...editorData,
  places: [],
  status: "DRAFT",
  authorId: hostId,
  authorName: "방장",
  voteCount: 0,
};

const createdRoom: TripRoom = {
  ...room,
  revision: RevisionSchema.make(2),
  plans: [createdPlan],
};

const session: UserSession = {
  participantId: hostId,
  participantIds: [hostId],
  accountType: "REGISTERED",
  name: "방장",
  isAuthenticated: true,
};

const sessionQueryResult = (): ReturnType<typeof useSessionQuery> =>
  ({
    data: session,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn<() => Promise<unknown>>(),
  }) as unknown as ReturnType<typeof useSessionQuery>;

const roomQueryResult = (): ReturnType<typeof useTripRoomRawQuery> =>
  ({
    data: room,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn<() => Promise<unknown>>().mockResolvedValue({
      data: room,
      isError: false,
    }),
  }) as unknown as ReturnType<typeof useTripRoomRawQuery>;

const roomsQueryResult = (): ReturnType<typeof useTripRoomsQuery> =>
  ({
    data: [],
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn<() => Promise<unknown>>(),
  }) as unknown as ReturnType<typeof useTripRoomsQuery>;

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location-path">{location.pathname}</output>;
}

function PlanDetailHistoryProbe() {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate(-1)}>
      브라우저 뒤로
    </button>
  );
}

function TestApp() {
  return (
    <MemoryRouter initialEntries={["/trips"]}>
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
          element={<PlanDetailHistoryProbe />}
        />
        <Route path="/trips/:tripId/plans" element={<p>여행방 계획 홈</p>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  localStorage.clear();
  Object.values(mocks).forEach((mock) => mock.mockReset());

  localStorage.setItem(
    getPlanEditorDraftKey(hostId, tripId, "new"),
    JSON.stringify({
      ownerId: hostId,
      ...editorData,
      updatedAt: "2026-08-30T00:00:00.000Z",
    }),
  );

  mocks.createTrip.mockResolvedValue(room);
  mocks.createPlan.mockResolvedValue(createdRoom);
  mocks.shareTripInvite.mockResolvedValue("copied");
  mocks.useAppNavigation.mockReturnValue({
    goBack: mocks.goBack,
    platformNavigation: undefined,
  } as unknown as ReturnType<typeof useAppNavigation>);
  mocks.useSessionQuery.mockReturnValue(sessionQueryResult());
  mocks.useTripRoomRawQuery.mockReturnValue(roomQueryResult());
  mocks.useTripRoomsQuery.mockReturnValue(roomsQueryResult());
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

describe("trip creation navigation history", () => {
  it("실제 신규 여행 entry부터 등록한 여행안 상세의 Back까지 여행방 anchor를 유지한다", async () => {
    render(<TestApp />);

    expect(screen.getByTestId("location-path")).toHaveTextContent("/trips");
    fireEvent.click(
      screen.getByRole("button", { name: "새 여행 만들기" }),
    );

    await waitFor(() =>
      expect(screen.getByTestId("location-path")).toHaveTextContent(
        "/trips/new",
      ),
    );
    fireEvent.change(screen.getByLabelText("여행 이름 *"), {
      target: { value: "제주 여행" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "여행 만들고 계속" }),
    );

    await waitFor(() =>
      expect(screen.getByTestId("location-path")).toHaveTextContent(
        `/trips/${tripId}/setup/companions`,
      ),
    );
    expect(mocks.createTrip).toHaveBeenCalledWith({ title: "제주 여행" });
    fireEvent.click(
      screen.getByRole("button", { name: "미정으로 두고 다음" }),
    );

    await waitFor(() =>
      expect(screen.getByTestId("location-path")).toHaveTextContent(
        `${planEditorPath}/basic`,
      ),
    );
    fireEvent.change(await screen.findByLabelText("여행안 제목 *"), {
      target: { value: "제주 힐링 코스" },
    });
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    fireEvent.click(await screen.findByRole("button", { name: "다음" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "다음: 여행 경로" }),
    );

    await waitFor(() =>
      expect(screen.getByTestId("location-path")).toHaveTextContent(
        `${planEditorPath}/route`,
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    fireEvent.click(await screen.findByRole("button", { name: "다음" }));
    fireEvent.click(await screen.findByRole("button", { name: "다음" }));
    fireEvent.click(await screen.findByRole("button", { name: "다음: 숙소" }));

    await waitFor(() =>
      expect(screen.getByTestId("location-path")).toHaveTextContent(
        `${planEditorPath}/accommodation`,
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "다음: 교통" }));

    await waitFor(() =>
      expect(screen.getByTestId("location-path")).toHaveTextContent(
        `${planEditorPath}/transport`,
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    fireEvent.click(await screen.findByRole("button", { name: "다음" }));
    fireEvent.click(await screen.findByRole("button", { name: "다음" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "입력 내용 검토하기" }),
    );

    await waitFor(() =>
      expect(screen.getByTestId("location-path")).toHaveTextContent(
        planEditorPath,
      ),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "여행안 제안 등록" }),
    );

    await waitFor(() =>
      expect(screen.getByTestId("location-path")).toHaveTextContent(
        `${planHomePath}/${planId}`,
      ),
    );
    expect(mocks.createPlan).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "브라우저 뒤로" }));

    await waitFor(() =>
      expect(screen.getByTestId("location-path")).toHaveTextContent(
        planHomePath,
      ),
    );
    expect(screen.getByText("여행방 계획 홈")).toBeVisible();
    expect(
      screen.queryByText("함께 여행할 사람을 초대할까요?"),
    ).not.toBeInTheDocument();
  });
});
