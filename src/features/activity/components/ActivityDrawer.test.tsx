// @vitest-environment jsdom
import { MemoryRouter } from "react-router-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ActivityDrawer } from "./ActivityDrawer.tsx";
import * as activityQueries from "../queries.ts";

vi.mock("../queries.ts", () => ({
  useTripActivitiesInfiniteQuery: vi.fn(),
  useMarkTripActivityReadMutation: vi.fn(),
}));

const mockUseInfiniteQuery = vi.mocked(activityQueries.useTripActivitiesInfiniteQuery);
const mockUseMarkReadMutation = vi.mocked(activityQueries.useMarkTripActivityReadMutation);

const renderWithClient = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        {ui}
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe("ActivityDrawer component", () => {
  const mutateMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseMarkReadMutation.mockReturnValue({
      mutate: mutateMock,
      isPending: false,
    } as any);
  });

  it("renders empty state when no events exist", () => {
    mockUseInfiniteQuery.mockReturnValue({
      data: { pages: [{ items: [], hasMore: false, nextBeforeSequence: null }] },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: vi.fn(),
    } as any);

    renderWithClient(
      <ActivityDrawer tripId="trip-1" isOpen={true} onClose={vi.fn()} />
    );

    expect(screen.getByText("활동 알림")).toBeInTheDocument();
    expect(screen.getByText("아직 새로운 활동이 없습니다.")).toBeInTheDocument();
  });

  it("renders activity event items without auto-marking them read, and marks read on button click", async () => {
    const events = [
      {
        sequence: "42",
        tripId: "trip-1",
        type: "PLAN_CREATED",
        actorParticipantId: "user-1",
        actorDisplayName: "Alice",
        isOwn: true,
        subjectPlanId: "plan-1",
        subjectTitle: "First Plan",
        roomRevision: 2,
        itineraryRevision: null,
        target: { type: "PLAN", path: "/trips/trip-1/plans/plan-1", planId: "plan-1" },
        createdAt: new Date().toISOString(),
      },
      {
        sequence: "40",
        tripId: "trip-1",
        type: "PLAN_CONFIRMED",
        actorParticipantId: "user-2",
        actorDisplayName: "Bob",
        isOwn: false,
        subjectPlanId: "plan-1",
        subjectTitle: "First Plan",
        roomRevision: 2,
        itineraryRevision: 1,
        target: { type: "ITINERARY", path: "/trips/trip-1/itinerary" },
        createdAt: new Date().toISOString(),
      },
    ];

    mockUseInfiniteQuery.mockReturnValue({
      data: {
        pages: [
          {
            items: events,
            hasMore: false,
            nextBeforeSequence: null,
            latestSequence: "42",
            lastSeenSequence: null,
            unreadCount: 1,
          },
        ],
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: vi.fn(),
    } as any);

    renderWithClient(
      <ActivityDrawer tripId="trip-1" isOpen={true} onClose={vi.fn()} />
    );

    expect(
      screen.getByText(`Alice님이 새 여행안 "First Plan"을 등록했어요`)
    ).toBeInTheDocument();
    expect(screen.getByText("내 활동")).toBeInTheDocument();
    expect(
      screen.getByText(`Bob님이 여행안 "First Plan"을 확정했어요`)
    ).toBeInTheDocument();

    // Opening drawer alone does NOT trigger mark-read
    expect(mutateMock).not.toHaveBeenCalled();

    // Clicking "현재까지 모두 확인" button triggers mark-read exactly once with latestSequence "42"
    const markAllBtn = screen.getByRole("button", { name: "현재까지 모두 확인" });
    fireEvent.click(markAllBtn);
    expect(mutateMock).toHaveBeenCalledTimes(1);
    expect(mutateMock).toHaveBeenCalledWith("42");
  });

  it("renders error state with retry button", () => {
    const refetchMock = vi.fn();
    mockUseInfiniteQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: refetchMock,
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: vi.fn(),
    } as any);

    renderWithClient(
      <ActivityDrawer tripId="trip-1" isOpen={true} onClose={vi.fn()} />
    );

    expect(screen.getByText("활동 내역을 불러오지 못했습니다.")).toBeInTheDocument();
    const retryBtn = screen.getByRole("button", { name: "다시 시도" });
    fireEvent.click(retryBtn);
    expect(refetchMock).toHaveBeenCalled();
  });
});
