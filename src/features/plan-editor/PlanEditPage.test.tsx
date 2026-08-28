// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";

import { ApiClientError } from "../../app/api-client.ts";
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
  useUpdatePlanMutation: vi.fn(),
  useDeletePlanMutation: vi.fn(),
}));

import { useSessionQuery } from "../../hooks/useSession.ts";
import { useTripRoomRawQuery } from "../plan-detail/queries.ts";
import {
  useDeletePlanMutation,
  useUpdatePlanMutation,
} from "./mutations.ts";
import { PlanEditPage } from "./PlanEditPage.tsx";

const mockUseSessionQuery = vi.mocked(useSessionQuery);
const mockUseTripRoomRawQuery = vi.mocked(useTripRoomRawQuery);
const mockUseUpdatePlanMutation = vi.mocked(useUpdatePlanMutation);
const mockUseDeletePlanMutation = vi.mocked(useDeletePlanMutation);

const tripId = TripIdSchema.make("trip-1");
const planId = PlanIdSchema.make("plan-1");
const hostId = ParticipantIdSchema.make("participant-host");
const memberId = ParticipantIdSchema.make("participant-member");
const editPath = `/trips/${tripId}/plans/${planId}/edit`;

const plan: TripPlan = {
  id: planId,
  title: "도쿄와 하코네 겨울 여행",
  status: "DRAFT",
  revision: RevisionSchema.make(3),
  authorId: hostId,
  authorName: "방장",
  proposalReason: "원래 공개된 제안 이유",
  baseHeadcount: 2,
  routes: [
    {
      city: "도쿄와 하코네를 잇는 아주 긴 목적지 이름",
      arrivalDate: "2026-12-10",
      departureDate: "2026-12-12",
    },
  ],
  accommodations: [
    {
      id: "stay-1",
      city: "도쿄와 하코네를 잇는 아주 긴 목적지 이름",
      period: "2026-12-10 ~ 2026-12-12",
      nights: 2,
      hotelName: "하코네 온천 호텔",
      bookingStatus: "AVAILABLE",
      bookingUrl:
        "https://booking.example.com/a-very-long-hakone-hotel-reservation-path",
      priceRange: { min: 120_000, max: 180_000 },
    },
  ],
  transports: [
    {
      id: "transport-1",
      fromCity: "서울",
      toCity: "도쿄",
      mode: "항공",
      hasTransfer: false,
      durationText: "2시간",
      bookingStatus: "AVAILABLE",
    },
    {
      id: "transport-2",
      fromCity: "도쿄",
      toCity: "서울",
      mode: "항공",
      hasTransfer: false,
      durationText: "2시간",
      bookingStatus: "AVAILABLE",
    },
  ],
  places: [],
  voteCount: 0,
};

const room: TripRoom = {
  id: tripId,
  title: "일본 겨울 여행",
  destination: "일본",
  revision: RevisionSchema.make(7),
  members: [
    { id: hostId, name: "방장", role: "HOST" },
    { id: memberId, name: "참여자", role: "MEMBER" },
  ],
  plans: [plan],
  confirmedPlanId: undefined,
};

const latestPlan: TripPlan = {
  ...plan,
  revision: RevisionSchema.make(4),
  proposalReason: "다른 사용자가 반영한 최신 공개 제안 이유",
};
const latestRoom: TripRoom = {
  ...room,
  revision: RevisionSchema.make(8),
  plans: [latestPlan],
};

const hostSession: UserSession = {
  participantId: hostId,
  participantIds: [hostId],
  accountType: "REGISTERED",
  name: "방장",
  isAuthenticated: true,
};
const memberSession: UserSession = {
  participantId: memberId,
  participantIds: [memberId],
  accountType: "REGISTERED",
  name: "참여자",
  isAuthenticated: true,
};

const queryResult = (
  data: TripRoom = room,
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
  data: UserSession | null = hostSession,
): ReturnType<typeof useSessionQuery> =>
  ({
    data,
    isLoading: false,
    isError: false,
    error: null,
  }) as ReturnType<typeof useSessionQuery>;

const updateMutationResult = (
  mutateAsync = vi.fn().mockResolvedValue(room),
  isPending = false,
): ReturnType<typeof useUpdatePlanMutation> =>
  ({ mutateAsync, isPending }) as unknown as ReturnType<
    typeof useUpdatePlanMutation
  >;

const deleteMutationResult = (
  mutateAsync = vi.fn().mockResolvedValue(room),
  isPending = false,
): ReturnType<typeof useDeletePlanMutation> =>
  ({ mutateAsync, isPending }) as unknown as ReturnType<
    typeof useDeletePlanMutation
  >;

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location-path">{location.pathname}</output>;
}

function TestApp({ initialEntry = editPath }: { readonly initialEntry?: string }) {
  return (
    <MemoryRouter initialEntries={[initialEntry]}>
      <LocationProbe />
      <Routes>
        <Route
          path="/trips/:tripId/plans/:planId/edit/:section?"
          element={<PlanEditPage />}
        />
        <Route path="*" element={<p>이동 완료</p>} />
      </Routes>
    </MemoryRouter>
  );
}

const renderPage = (initialEntry = editPath) =>
  render(<TestApp initialEntry={initialEntry} />);

beforeEach(() => {
  localStorage.clear();
  mockUseSessionQuery.mockReset();
  mockUseTripRoomRawQuery.mockReset();
  mockUseUpdatePlanMutation.mockReset();
  mockUseDeletePlanMutation.mockReset();
  mockUseSessionQuery.mockReturnValue(sessionResult());
  mockUseTripRoomRawQuery.mockReturnValue(queryResult());
  mockUseUpdatePlanMutation.mockReturnValue(updateMutationResult());
  mockUseDeletePlanMutation.mockReturnValue(deleteMutationResult());
});

describe("PlanEditPage", () => {
  it("author에게 opaque editor hierarchy와 destructive/primary BottomAction을 제공한다", () => {
    renderPage();

    expect(
      screen.getByRole("heading", { level: 1, name: "여행안 수정하기" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "여행안 구성" }),
    ).toBeInTheDocument();
    const list = screen.getByRole("list", { name: "여행안 편집 항목" });
    expect(list).toHaveAttribute("data-galanda-surface", "content");
    expect(list).toHaveClass("bg-surface-content");

    const save = screen.getByRole("button", { name: "수정안 반영하기" });
    const remove = screen.getByRole("button", { name: "삭제하기" });
    expect(save.closest('[data-galanda-surface="chrome"]')).toBe(
      remove.closest('[data-galanda-surface="chrome"]'),
    );
  });

  it("작성자가 아닌 참여자에게 edit/delete 권한을 노출하지 않는다", () => {
    mockUseSessionQuery.mockReturnValue(sessionResult(memberSession));

    renderPage();

    expect(
      screen.getByRole("heading", { level: 2, name: "수정 권한이 없습니다" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "여행안 작성자만 해당 여행안을 수정하거나 삭제할 수 있습니다.",
    );
    expect(
      screen.queryByRole("button", { name: "수정안 반영하기" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "삭제하기" }),
    ).not.toBeInTheDocument();
  });

  it("pending 중 중복 제출을 막고 current expectedRevision을 보내며 성공 뒤에만 이동한다", async () => {
    const request = deferred<TripRoom>();
    const mutateAsync = vi.fn(() => request.promise);
    mockUseUpdatePlanMutation.mockReturnValue(
      updateMutationResult(mutateAsync, false),
    );

    const view = renderPage();
    const submit = screen.getByRole("button", { name: "수정안 반영하기" });
    fireEvent.click(submit);
    fireEvent.click(submit);

    expect(mutateAsync).toHaveBeenCalledTimes(1);
    expect(mutateAsync).toHaveBeenCalledWith({
      roomId: tripId,
      plan: expect.objectContaining({
        id: planId,
        title: plan.title,
        proposalReason: plan.proposalReason,
      }),
      expectedRevision: 7,
    });
    expect(screen.getByTestId("location-path")).toHaveTextContent(editPath);

    mockUseUpdatePlanMutation.mockReturnValue(
      updateMutationResult(mutateAsync, true),
    );
    view.rerender(<TestApp />);
    const pendingAction = screen.getByRole("button", {
      name: "수정 반영 중...",
    });
    expect(pendingAction).toBeDisabled();
    expect(pendingAction).toHaveAttribute("aria-busy", "true");
    expect(screen.getByTestId("location-path")).toHaveTextContent(editPath);

    await act(async () => {
      request.resolve(room);
      await request.promise;
    });

    await waitFor(() =>
      expect(screen.getByTestId("location-path")).toHaveTextContent(
        `/trips/${tripId}/plans/${planId}`,
      ),
    );
  });

  it("resize rerender와 mutation 실패 뒤에도 permanent-label input draft를 유지한다", async () => {
    const mutateAsync = vi
      .fn()
      .mockRejectedValue(new Error("여행안 수정 서버가 응답하지 않았어요."));
    mockUseUpdatePlanMutation.mockReturnValue(updateMutationResult(mutateAsync));

    const view = renderPage();
    fireEvent.click(screen.getByRole("button", { name: /기본 정보/ }));
    const titleInput = await screen.findByLabelText("여행안 제목 *");
    const editedTitle = `${plan.title} - 로컬에서 수정한 긴 제목`;
    fireEvent.change(titleInput, { target: { value: editedTitle } });

    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1440,
    });
    fireEvent(window, new Event("resize"));
    view.rerender(<TestApp />);
    expect(screen.getByLabelText("여행안 제목 *")).toHaveValue(editedTitle);
    expect(
      screen.getByLabelText("제안 이유 / 한 줄 요약 (선택)"),
    ).toHaveValue(plan.proposalReason);

    fireEvent.click(screen.getByRole("button", { name: "편집 완료" }));
    await waitFor(() =>
      expect(screen.getByTestId("location-path")).toHaveTextContent(editPath),
    );
    fireEvent.click(screen.getByRole("button", { name: "수정안 반영하기" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "여행안 수정 서버가 응답하지 않았어요.",
    );
    expect(mutateAsync).toHaveBeenCalledWith({
      roomId: tripId,
      plan: expect.objectContaining({ title: editedTitle }),
      expectedRevision: 7,
    });
    expect(screen.getByTestId("location-path")).toHaveTextContent(editPath);

    fireEvent.click(screen.getByRole("button", { name: /기본 정보/ }));
    expect(await screen.findByLabelText("여행안 제목 *")).toHaveValue(
      editedTitle,
    );
  });

  it("revision conflict에서 local 변경과 latest untouched field를 rebase하고 새 revision으로 재시도한다", async () => {
    const conflict = new ApiClientError({
      status: 409,
      code: "REVISION_CONFLICT",
      message: "다른 사용자가 먼저 수정했습니다.",
      details: { expectedRevision: 7, actualRevision: 8 },
    });
    const mutateAsync = vi
      .fn()
      .mockRejectedValueOnce(conflict)
      .mockResolvedValueOnce(latestRoom);
    let currentRoom = room;
    const refetch = vi.fn().mockImplementation(async () => {
      currentRoom = latestRoom;
      return { data: latestRoom, isError: false };
    });
    mockUseTripRoomRawQuery.mockImplementation(() =>
      queryResult(currentRoom, refetch),
    );
    mockUseUpdatePlanMutation.mockReturnValue(updateMutationResult(mutateAsync));

    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /기본 정보/ }));
    const locallyEditedTitle = `${plan.title} - 내 로컬 변경`;
    fireEvent.change(await screen.findByLabelText("여행안 제목 *"), {
      target: { value: locallyEditedTitle },
    });
    fireEvent.click(screen.getByRole("button", { name: "편집 완료" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "수정안 반영하기" }),
    );

    const conflictAlert = await screen.findByRole("alert");
    expect(conflictAlert).toHaveTextContent("v7 → v8");
    expect(conflictAlert).toHaveTextContent("작성 중인 입력은 보존했습니다.");
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "다른 변경이 먼저 반영됐어요",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "내 변경 다시 적용" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "최신 공개본 사용" })).toBeInTheDocument();
    expect(screen.getByTestId("location-path")).toHaveTextContent(editPath);

    fireEvent.click(screen.getByRole("button", { name: "내 변경 다시 적용" }));
    fireEvent.click(await screen.findByRole("button", { name: /기본 정보/ }));
    expect(await screen.findByLabelText("여행안 제목 *")).toHaveValue(
      locallyEditedTitle,
    );
    expect(
      screen.getByLabelText("제안 이유 / 한 줄 요약 (선택)"),
    ).toHaveValue(latestPlan.proposalReason);

    fireEvent.click(screen.getByRole("button", { name: "편집 완료" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "수정안 반영하기" }),
    );

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(2));
    expect(mutateAsync).toHaveBeenLastCalledWith({
      roomId: tripId,
      plan: expect.objectContaining({
        title: locallyEditedTitle,
        proposalReason: latestPlan.proposalReason,
      }),
      expectedRevision: 8,
    });
    await waitFor(() =>
      expect(screen.getByTestId("location-path")).toHaveTextContent(
        `/trips/${tripId}/plans/${planId}`,
      ),
    );
  });
});
