// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

const tripId = TripIdSchema.make("trip-1");
const hostId = ParticipantIdSchema.make("participant-host");
const summaryPath = `/trips/${tripId}/plans/new`;
const longDraftTitle =
  "도쿄와 하코네의 온천·미술관·긴 산책로를 모두 포함하는 겨울 여행안";

const validEditorData = {
  title: longDraftTitle,
  proposalReason: "이동 시간을 줄이고 온천에서 충분히 쉬는 일정",
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
      bookingStatus: "AVAILABLE" as const,
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
      bookingStatus: "AVAILABLE" as const,
    },
    {
      id: "transport-2",
      fromCity: "도쿄",
      toCity: "서울",
      mode: "항공",
      hasTransfer: false,
      durationText: "2시간",
      bookingStatus: "AVAILABLE" as const,
    },
  ],
};

const room: TripRoom = {
  id: tripId,
  title: "일본 겨울 여행",
  destination: "일본",
  revision: RevisionSchema.make(7),
  members: [{ id: hostId, name: "방장", role: "HOST" }],
  plans: [],
  confirmedPlanId: undefined,
};

const createdPlan: TripPlan = {
  id: PlanIdSchema.make("plan-created"),
  status: "DRAFT",
  authorId: hostId,
  authorName: "방장",
  places: [],
  voteCount: 0,
  ...validEditorData,
};
const createdRoom: TripRoom = {
  ...room,
  revision: RevisionSchema.make(8),
  plans: [createdPlan],
};

const session: UserSession = {
  participantId: hostId,
  participantIds: [hostId],
  accountType: "REGISTERED",
  name: "방장",
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
  data: UserSession | null = session,
): ReturnType<typeof useSessionQuery> =>
  ({
    data,
    isLoading: false,
    isError: false,
    error: null,
  }) as ReturnType<typeof useSessionQuery>;

const mutationResult = (
  mutateAsync = vi.fn().mockResolvedValue(createdRoom),
  isPending = false,
): ReturnType<typeof useCreatePlanMutation> =>
  ({ mutateAsync, isPending }) as unknown as ReturnType<
    typeof useCreatePlanMutation
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

const writeValidDraft = (): void => {
  localStorage.setItem(
    getPlanEditorDraftKey(hostId, tripId, "new"),
    JSON.stringify({
      ownerId: hostId,
      ...validEditorData,
      updatedAt: "2026-08-18T00:00:00.000Z",
    }),
  );
};

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location-path">{location.pathname}</output>;
}

function TestApp({ initialEntry = summaryPath }: { readonly initialEntry?: string }) {
  return (
    <MemoryRouter initialEntries={[initialEntry]}>
      <LocationProbe />
      <Routes>
        <Route
          path="/trips/:tripId/plans/new/:section?"
          element={<PlanCreatePage />}
        />
        <Route path="*" element={<p>이동 완료</p>} />
      </Routes>
    </MemoryRouter>
  );
}

const renderPage = (initialEntry = summaryPath) =>
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

describe("PlanCreatePage", () => {
  it("opaque editor hierarchy와 validation accessory를 BottomAction에 표시한다", () => {
    const { container } = renderPage();

    expect(
      screen.getByRole("heading", { level: 1, name: "새 여행안 제안하기" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "첫 여행안을 만들어볼까요?",
      }),
    ).toBeInTheDocument();
    const editorList = screen.getByRole("list", {
      name: "여행안 편집 항목",
    });
    expect(editorList).toHaveAttribute("data-galanda-surface", "content");
    expect(editorList).toHaveClass("bg-surface-content");

    const submit = screen.getByRole("button", { name: "여행안 제안 등록" });
    expect(submit).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "여행안 제목을 입력해주세요.",
    );
    expect(submit.closest('[data-galanda-surface="chrome"]')).not.toBeNull();
    expect(
      Array.from(
        container.querySelectorAll<HTMLElement>('[data-galanda-surface="content"]'),
      ).some((element) => element.className.includes("--app-cta-space")),
    ).toBe(true);
  });

  it("pending 중 중복 제출을 막고 expectedRevision을 보내며 서버 성공 뒤에만 이동한다", async () => {
    writeValidDraft();
    const request = deferred<TripRoom>();
    const mutateAsync = vi.fn(() => request.promise);
    mockUseCreatePlanMutation.mockReturnValue(
      mutationResult(mutateAsync, false),
    );

    const view = renderPage();
    const submit = await screen.findByRole("button", {
      name: "여행안 제안 등록",
    });
    await waitFor(() => expect(submit).toBeEnabled());

    fireEvent.click(submit);
    fireEvent.click(submit);

    expect(mutateAsync).toHaveBeenCalledTimes(1);
    expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        roomId: tripId,
        expectedRevision: 7,
        title: longDraftTitle,
        proposalReason: validEditorData.proposalReason,
        baseHeadcount: 2,
        routes: validEditorData.routes,
        accommodations: validEditorData.accommodations,
        transports: validEditorData.transports,
        places: [],
      }),
    );
    expect(screen.getByTestId("location-path")).toHaveTextContent(summaryPath);

    mockUseCreatePlanMutation.mockReturnValue(mutationResult(mutateAsync, true));
    view.rerender(<TestApp />);
    const pendingAction = screen.getByRole("button", { name: "등록 중..." });
    expect(pendingAction).toBeDisabled();
    expect(pendingAction).toHaveAttribute("aria-busy", "true");
    expect(screen.getByTestId("location-path")).toHaveTextContent(summaryPath);

    await act(async () => {
      request.resolve(createdRoom);
      await request.promise;
    });

    await waitFor(() =>
      expect(screen.getByTestId("location-path")).toHaveTextContent(
        `/trips/${tripId}/plans/${createdPlan.id}`,
      ),
    );
  });

  it("resize rerender와 mutation 실패 뒤에도 입력 draft와 현재 route를 유지한다", async () => {
    writeValidDraft();
    const mutateAsync = vi
      .fn()
      .mockRejectedValue(new Error("여행안 등록 서버가 응답하지 않았어요."));
    mockUseCreatePlanMutation.mockReturnValue(mutationResult(mutateAsync));

    const view = renderPage();
    const basicRow = await screen.findByRole("button", { name: /기본 정보/ });
    fireEvent.click(basicRow);

    const titleInput = await screen.findByLabelText("여행안 제목 *");
    const editedTitle = `${longDraftTitle} - 사용자가 수정한 제목`;
    fireEvent.change(titleInput, { target: { value: editedTitle } });

    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 320,
    });
    fireEvent(window, new Event("resize"));
    view.rerender(<TestApp />);
    expect(screen.getByLabelText("여행안 제목 *")).toHaveValue(editedTitle);

    fireEvent.click(screen.getByRole("button", { name: "편집 완료" }));
    await waitFor(() =>
      expect(screen.getByTestId("location-path")).toHaveTextContent(summaryPath),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "여행안 제안 등록" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "여행안 등록 서버가 응답하지 않았어요.",
    );
    expect(screen.getByTestId("location-path")).toHaveTextContent(summaryPath);

    fireEvent.click(screen.getByRole("button", { name: /기본 정보/ }));
    expect(await screen.findByLabelText("여행안 제목 *")).toHaveValue(
      editedTitle,
    );
  });
});
