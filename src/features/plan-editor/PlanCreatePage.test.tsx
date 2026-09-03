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

function CompletionProbe() {
  return <p>완료 화면</p>;
}

type TestInitialEntry =
  | string
  | {
      readonly pathname: string;
      readonly state?: Record<string, unknown>;
    };

function TestApp({
  initialEntry = summaryPath,
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
          element={<CompletionProbe />}
        />
        <Route path="/trips/:tripId/plans" element={<p>여행방</p>} />
        <Route path="*" element={<p>이동 완료</p>} />
      </Routes>
    </MemoryRouter>
  );
}

const renderPage = (initialEntry: TestInitialEntry = summaryPath) =>
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
  it("미완료 입력을 만들지 않고 각 Plan 단계를 건너뛰어 검토까지 진행한다", async () => {
    // Draft with 1 route but skippable/empty optional fields
    localStorage.setItem(
      getPlanEditorDraftKey(hostId, tripId, "new"),
      JSON.stringify({
        ownerId: hostId,
        title: "",
        proposalReason: "",
        baseHeadcount: 2,
        routes: [{ city: "제주", arrivalDate: "2026-10-01", departureDate: "2026-10-04" }],
        accommodations: [{ id: "acc-1", city: "제주", period: "2026-10-01 ~ 2026-10-04", nights: 3, hotelName: "", isSearching: true, bookingStatus: "NOT_CHECKED" }],
        transports: [
          { id: "tr-1", fromCity: "김포", toCity: "제주", mode: "", hasTransfer: false, durationText: "", bookingStatus: "NOT_CHECKED" },
          { id: "tr-2", fromCity: "제주", toCity: "김포", mode: "", hasTransfer: false, durationText: "", bookingStatus: "NOT_CHECKED" },
        ],
        updatedAt: "2026-08-18T00:00:00.000Z",
      }),
    );

    const mutateAsync = vi.fn().mockResolvedValue(createdRoom);
    mockUseCreatePlanMutation.mockReturnValue(mutationResult(mutateAsync));
    renderPage(`${summaryPath}/basic`);

    const progress = await screen.findByRole("navigation", {
      name: "여행 만들기 진행 단계",
    });
    expect(progress).toHaveTextContent("3/4");
    expect(progress).toHaveTextContent("첫 여행안 · 기본 정보");

    // 1. Basic - Title: 입력 후 다음
    const titleInput = await screen.findByLabelText("여행안 제목 *");
    fireEvent.change(titleInput, { target: { value: "제주 힐링 여행" } });
    const nextFromTitle = screen.getByRole("button", { name: "다음" });
    expect(nextFromTitle).toBeEnabled();
    fireEvent.click(nextFromTitle);

    // 2. Basic - Proposal Reason: 건너뛰기
    await waitFor(() =>
      expect(screen.getByLabelText("제안 이유 / 한 줄 요약 (선택)")).toBeInTheDocument(),
    );
    const skipProposal = screen.getByRole("button", { name: "건너뛰기" });
    fireEvent.click(skipProposal);

    // 3. Basic - Headcount: 다음: 여행 경로
    await waitFor(() =>
      expect(screen.getByRole("group", { name: /비용 기준 인원/ })).toBeInTheDocument(),
    );
    const nextFromHeadcount = screen.getByRole("button", { name: "다음: 여행 경로" });
    fireEvent.click(nextFromHeadcount);

    // 4. Route (city -> arrival-date -> departure-date -> add-city -> accommodation)
    await waitFor(() =>
      expect(screen.getByTestId("location-path")).toHaveTextContent(
        `${summaryPath}/route`,
      ),
    );
    expect(screen.getByRole("navigation", { name: "여행 만들기 진행 단계" })).toHaveTextContent("3/4");
    expect(screen.getByRole("navigation", { name: "여행 만들기 진행 단계" })).toHaveTextContent("첫 여행안 · 여행 경로");
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    fireEvent.click(await screen.findByRole("button", { name: "다음" }));
    fireEvent.click(await screen.findByRole("button", { name: "다음" }));
    fireEvent.click(await screen.findByRole("button", { name: "다음: 숙소" }));

    // 5. Accommodation (status isSearching -> transport)
    await waitFor(() =>
      expect(screen.getByTestId("location-path")).toHaveTextContent(
        `${summaryPath}/accommodation`,
      ),
    );
    expect(screen.getByRole("navigation", { name: "여행 만들기 진행 단계" })).toHaveTextContent("3/4");
    expect(screen.getByRole("navigation", { name: "여행 만들기 진행 단계" })).toHaveTextContent("첫 여행안 · 숙소");
    fireEvent.click(screen.getByRole("button", { name: "다음: 교통" }));

    // 6. Transport Leg 0 (endpoints -> status NOT_CHECKED -> Leg 1)
    await waitFor(() =>
      expect(screen.getByTestId("location-path")).toHaveTextContent(
        `${summaryPath}/transport`,
      ),
    );
    expect(screen.getByRole("navigation", { name: "여행 만들기 진행 단계" })).toHaveTextContent("3/4");
    expect(screen.getByRole("navigation", { name: "여행 만들기 진행 단계" })).toHaveTextContent("첫 여행안 · 교통");
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    fireEvent.click(await screen.findByRole("button", { name: "다음" }));

    // Transport Leg 1 (endpoints -> status NOT_CHECKED -> review)
    fireEvent.click(await screen.findByRole("button", { name: "다음" }));
    fireEvent.click(await screen.findByRole("button", { name: "입력 내용 검토하기" }));

    // 7. Review stage
    await waitFor(() =>
      expect(screen.getByTestId("location-path")).toHaveTextContent(summaryPath),
    );
    expect(screen.getByRole("navigation", { name: "여행 만들기 진행 단계" })).toHaveTextContent("4/4");
    expect(screen.getByRole("navigation", { name: "여행 만들기 진행 단계" })).toHaveTextContent("검토");
    expect(
      screen.getByRole("button", { name: "여행안 제안 등록" }),
    ).toBeEnabled();
  });

  it("미완료 section을 건너뛴 deep link는 첫 미완료 단계로 복귀시킨다", async () => {
    renderPage(`${summaryPath}/transport`);

    await waitFor(() =>
      expect(screen.getByTestId("location-path")).toHaveTextContent(
        `${summaryPath}/route`,
      ),
    );
    const progress = screen.getByRole("navigation", {
      name: "여행 만들기 진행 단계",
    });
    expect(progress).toHaveTextContent("3/4");
    expect(progress).toHaveTextContent("첫 여행안 · 여행 경로");
  });

  it("명시적인 이전 단계로 section을 거슬러 올라가고 basic에서 여행방으로 돌아간다", async () => {
    writeValidDraft();
    renderPage({
      pathname: `${summaryPath}/route`,
      state: {
        tripCreationWizard: true,
        wizardEntrySource: "plans",
      },
    });

    fireEvent.click(
      await screen.findByRole("button", { name: "이전" }),
    );
    await waitFor(() =>
      expect(screen.getByTestId("location-path")).toHaveTextContent(
        `${summaryPath}/basic`,
      ),
    );

    // From headcount -> proposal-reason -> title
    fireEvent.click(screen.getByRole("button", { name: "이전" }));
    await waitFor(() =>
      expect(screen.getByLabelText("제안 이유 / 한 줄 요약 (선택)")).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: "이전" }));
    await waitFor(() =>
      expect(screen.getByLabelText("여행안 제목 *")).toBeInTheDocument(),
    );

    // From title -> plans
    fireEvent.click(screen.getByRole("button", { name: "이전" }));
    await waitFor(() =>
      expect(screen.getByTestId("location-path")).toHaveTextContent(
        `/trips/${tripId}/plans`,
      ),
    );
    expect(screen.getByText("여행방")).toBeVisible();
  });

  it("완료된 첫 여행안 draft는 기본 정보부터 검토·등록까지 순서대로 진행한다", async () => {
    writeValidDraft();
    renderPage(`${summaryPath}/basic`);

    const progress = await screen.findByRole("navigation", {
      name: "여행 만들기 진행 단계",
    });
    expect(progress).toHaveTextContent("3/4");
    expect(progress).toHaveTextContent("첫 여행안 · 기본 정보");

    // Title -> Next
    const titleAction = await screen.findByRole("button", { name: "다음" });
    await waitFor(() => expect(titleAction).toBeEnabled());
    fireEvent.click(titleAction);

    // Proposal Reason -> Next
    const proposalAction = await screen.findByRole("button", { name: "다음" });
    expect(proposalAction).toBeEnabled();
    fireEvent.click(proposalAction);

    // Headcount -> Next
    const headcountAction = await screen.findByRole("button", { name: "다음: 여행 경로" });
    expect(headcountAction).toBeEnabled();
    fireEvent.click(headcountAction);

    // Route (city -> arrival-date -> departure-date -> add-city -> accommodation)
    await waitFor(() =>
      expect(screen.getByTestId("location-path")).toHaveTextContent(
        `${summaryPath}/route`,
      ),
    );
    expect(screen.getByRole("navigation", { name: "여행 만들기 진행 단계" })).toHaveTextContent("3/4");
    expect(screen.getByRole("navigation", { name: "여행 만들기 진행 단계" })).toHaveTextContent("첫 여행안 · 여행 경로");
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    fireEvent.click(await screen.findByRole("button", { name: "다음" }));
    fireEvent.click(await screen.findByRole("button", { name: "다음" }));
    fireEvent.click(await screen.findByRole("button", { name: "다음: 숙소" }));

    // Accommodation (status -> hotel-name -> transport)
    await waitFor(() =>
      expect(screen.getByTestId("location-path")).toHaveTextContent(
        `${summaryPath}/accommodation`,
      ),
    );
    expect(screen.getByRole("navigation", { name: "여행 만들기 진행 단계" })).toHaveTextContent("3/4");
    expect(screen.getByRole("navigation", { name: "여행 만들기 진행 단계" })).toHaveTextContent("첫 여행안 · 숙소");
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    fireEvent.click(await screen.findByRole("button", { name: "다음: 교통" }));

    // Transport Leg 0 (endpoints -> status -> mode -> duration -> Leg 1)
    await waitFor(() =>
      expect(screen.getByTestId("location-path")).toHaveTextContent(
        `${summaryPath}/transport`,
      ),
    );
    expect(screen.getByRole("navigation", { name: "여행 만들기 진행 단계" })).toHaveTextContent("3/4");
    expect(screen.getByRole("navigation", { name: "여행 만들기 진행 단계" })).toHaveTextContent("첫 여행안 · 교통");
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    fireEvent.click(await screen.findByRole("button", { name: "다음" }));
    fireEvent.click(await screen.findByRole("button", { name: "다음" }));
    fireEvent.click(await screen.findByRole("button", { name: "다음" }));

    // Transport Leg 1 (endpoints -> status -> mode -> duration -> review)
    fireEvent.click(await screen.findByRole("button", { name: "다음" }));
    fireEvent.click(await screen.findByRole("button", { name: "다음" }));
    fireEvent.click(await screen.findByRole("button", { name: "다음" }));
    fireEvent.click(await screen.findByRole("button", { name: "입력 내용 검토하기" }));

    // Review stage
    await waitFor(() =>
      expect(screen.getByTestId("location-path")).toHaveTextContent(summaryPath),
    );
    expect(screen.getByRole("navigation", { name: "여행 만들기 진행 단계" })).toHaveTextContent("4/4");
    expect(screen.getByRole("navigation", { name: "여행 만들기 진행 단계" })).toHaveTextContent("검토");
    expect(screen.getByRole("button", { name: "이전: 교통" })).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "여행안 제안 등록" }),
    ).toBeEnabled();
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
    expect(screen.getByText("완료 화면")).toBeVisible();
  });

  it("검토에서 다시 연 section이 미완료가 되어도 검토로 돌아갈 수 있다", async () => {
    writeValidDraft();
    renderPage();

    fireEvent.click(
      await screen.findByRole("button", { name: /기본 정보/ }),
    );
    const titleInput = await screen.findByLabelText("여행안 제목 *");
    fireEvent.change(titleInput, { target: { value: "" } });

    const returnAction = screen.getByRole("button", {
      name: "검토로 돌아가기",
    });
    expect(returnAction).toBeEnabled();
    fireEvent.click(returnAction);

    await waitFor(() =>
      expect(screen.getByTestId("location-path")).toHaveTextContent(summaryPath),
    );
    const progress = screen.getByRole("navigation", {
      name: "여행 만들기 진행 단계",
    });
    expect(progress).toHaveTextContent("4/4");
    expect(progress).toHaveTextContent("검토");
    expect(
      screen.getByRole("button", { name: "여행안 제안 등록" }),
    ).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "여행안 제목을 입력해주세요.",
    );
  });

  it("등록 뒤 남은 Wizard history는 다시 편집하지 않고 여행방으로 보낸다", async () => {
    mockUseTripRoomRawQuery.mockReturnValue(queryResult(createdRoom));

    renderPage({
      pathname: `${summaryPath}/transport`,
      state: { tripCreationWizard: true },
    });

    await waitFor(() =>
      expect(screen.getByTestId("location-path")).toHaveTextContent(
        `/trips/${tripId}/plans`,
      ),
    );
    expect(screen.getByText("여행방")).toBeVisible();
  });

  it("기존 여행의 새 여행안 section은 기존 요약형 편집 동작을 유지한다", () => {
    mockUseTripRoomRawQuery.mockReturnValue(queryResult(createdRoom));

    renderPage(`${summaryPath}/transport`);

    expect(
      screen.queryByRole("navigation", { name: "여행 만들기 진행 단계" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "교통" })).toBeVisible();
    expect(screen.getByRole("button", { name: "편집 완료" })).toBeEnabled();
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

    fireEvent.click(screen.getByRole("button", { name: "검토로 돌아가기" }));
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

  it("검토 화면에서 여행 경로 항목 수정 시 returnToReview 상태로 순차 진행 후 검토로 복귀한다", async () => {
    writeValidDraft();
    renderPage();

    // Review stage
    expect(await screen.findByRole("button", { name: "여행안 제안 등록" })).toBeEnabled();

    // Click '여행 경로' jump link
    fireEvent.click(screen.getByRole("button", { name: /여행 경로/ }));

    await waitFor(() => {
      expect(screen.getByTestId("location-path")).toHaveTextContent(`${summaryPath}/route`);
      expect(screen.getByTestId("location-search")).toHaveTextContent("question=city&index=0&returnToReview=true");
    });

    // city -> arrival-date -> departure-date -> review
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    await waitFor(() => {
      expect(screen.getByTestId("location-search")).toHaveTextContent("question=arrival-date&index=0&returnToReview=true");
    });

    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    await waitFor(() => {
      expect(screen.getByTestId("location-search")).toHaveTextContent("question=departure-date&index=0&returnToReview=true");
    });

    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    await waitFor(() => {
      expect(screen.getByTestId("location-path")).toHaveTextContent(summaryPath);
      expect(screen.getByTestId("location-search")).toHaveTextContent("");
    });
    expect(screen.getByRole("button", { name: "여행안 제안 등록" })).toBeEnabled();
  });

  it("검토 화면에서 숙소에 오류가 있을 때 숙소 수정 링크를 누르면 정확한 오류 질문으로 이동한다", async () => {
    // Draft with missing hotel name
    localStorage.setItem(
      getPlanEditorDraftKey(hostId, tripId, "new"),
      JSON.stringify({
        ownerId: hostId,
        ...validEditorData,
        accommodations: [
          {
            id: "stay-1",
            city: "도쿄와 하코네를 잇는 아주 긴 목적지 이름",
            period: "2026-12-10 ~ 2026-12-12",
            nights: 2,
            hotelName: "", // missing
            isSearching: false,
            bookingStatus: "AVAILABLE",
          },
        ],
        updatedAt: "2026-08-18T00:00:00.000Z",
      }),
    );

    renderPage();

    // Review stage should show disabled submit button
    const submitBtn = await screen.findByRole("button", { name: "여행안 제안 등록" });
    expect(submitBtn).toBeDisabled();

    // Click '숙소' jump link
    fireEvent.click(screen.getByRole("button", { name: /숙소/ }));

    // Should jump straight to hotel-name question
    await waitFor(() => {
      expect(screen.getByTestId("location-path")).toHaveTextContent(`${summaryPath}/accommodation`);
      expect(screen.getByTestId("location-search")).toHaveTextContent("question=hotel-name&index=0&returnToReview=true");
    });

    const hotelInput = await screen.findByLabelText("숙소명 / 호텔명 *");
    fireEvent.change(hotelInput, { target: { value: "하코네 료칸" } });

    // Click '다음' to return to review
    fireEvent.click(screen.getByRole("button", { name: "다음" }));

    await waitFor(() => {
      expect(screen.getByTestId("location-path")).toHaveTextContent(summaryPath);
      expect(screen.getByTestId("location-search")).toHaveTextContent("");
    });
    expect(screen.getByRole("button", { name: "여행안 제안 등록" })).toBeEnabled();
  });

  it("다른 참여자가 첫 여행안을 등록한 방에서 기존 초안을 작성 중인 경우 '대안 여행안 등록하기'로 등록된다", async () => {
    // Room has an existing plan
    mockUseTripRoomRawQuery.mockReturnValue(queryResult(createdRoom));

    // User has an active draft with wizardCursor
    localStorage.setItem(
      getPlanEditorDraftKey(hostId, tripId, "new"),
      JSON.stringify({
        ownerId: hostId,
        ...validEditorData,
        title: "두 번째 대안 여행안",
        updatedAt: "2026-08-18T00:00:00.000Z",
        wizardCursor: {
          section: "review",
          question: "title",
        },
      }),
    );

    const alternativePlan: TripPlan = {
      ...createdPlan,
      id: PlanIdSchema.make("plan-alternative"),
      title: "두 번째 대안 여행안",
    };
    const roomWithAlternative: TripRoom = {
      ...createdRoom,
      revision: RevisionSchema.make(9),
      plans: [...createdRoom.plans, alternativePlan],
    };

    const mutateAsync = vi.fn().mockResolvedValue(roomWithAlternative);
    mockUseCreatePlanMutation.mockReturnValue(mutationResult(mutateAsync));

    renderPage({
      pathname: summaryPath,
      state: {
        tripCreationWizard: true,
        wizardReview: true,
      },
    });

    const submitBtn = await screen.findByRole("button", { name: "대안 여행안 등록하기" });
    expect(submitBtn).toBeEnabled();

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          roomId: tripId,
          expectedRevision: 8,
          title: "두 번째 대안 여행안",
        }),
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId("location-path")).toHaveTextContent(
        `/trips/${tripId}/plans/${alternativePlan.id}`,
      );
    });
    expect(screen.getByText("완료 화면")).toBeVisible();
  });
});
