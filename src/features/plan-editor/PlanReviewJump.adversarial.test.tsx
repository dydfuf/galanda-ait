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
import { ApiClientError } from "../../app/api-client.ts";
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

const tripId = TripIdSchema.make("trip-adv-m4");
const hostId = ParticipantIdSchema.make("participant-host-m4");
const summaryPath = `/trips/${tripId}/plans/new`;

const valid2CityDraft = {
  title: "도쿄 & 교토 5박 6일 완전 정복",
  proposalReason: "도쿄의 현대적인 매력과 교토의 고즈넉함을 함께 즐기는 코스",
  baseHeadcount: 2,
  routes: [
    {
      city: "도쿄",
      arrivalDate: "2026-11-10",
      departureDate: "2026-11-13",
    },
    {
      city: "교토",
      arrivalDate: "2026-11-13",
      departureDate: "2026-11-15",
    },
  ],
  accommodations: [
    {
      id: "stay-1",
      city: "도쿄",
      period: "2026-11-10 ~ 2026-11-13",
      nights: 3,
      hotelName: "신주쿠 그랜드 호텔",
      bookingStatus: "AVAILABLE" as const,
    },
    {
      id: "stay-2",
      city: "교토",
      period: "2026-11-13 ~ 2026-11-15",
      nights: 2,
      hotelName: "교토 전통 료칸",
      bookingStatus: "AVAILABLE" as const,
    },
  ],
  transports: [
    {
      id: "tr-1",
      fromCity: "인천",
      toCity: "도쿄",
      mode: "항공편",
      hasTransfer: false,
      durationText: "2시간 30분",
      bookingStatus: "AVAILABLE" as const,
    },
    {
      id: "tr-2",
      fromCity: "도쿄",
      toCity: "교토",
      mode: "신칸센",
      hasTransfer: false,
      durationText: "2시간 15분",
      bookingStatus: "AVAILABLE" as const,
    },
    {
      id: "tr-3",
      fromCity: "교토",
      toCity: "인천",
      mode: "항공편 (간사이)",
      hasTransfer: false,
      durationText: "2시간",
      bookingStatus: "AVAILABLE" as const,
    },
  ],
};

const emptyRoom: TripRoom = {
  id: tripId,
  title: "일본 단풍 여행",
  destination: "일본",
  revision: RevisionSchema.make(1),
  members: [{ id: hostId, name: "방장", role: "HOST" }],
  plans: [],
};

const sessionUser: UserSession = {
  participantId: hostId,
  participantIds: [hostId],
  accountType: "REGISTERED",
  name: "방장",
  isAuthenticated: true,
};

function LocationProbe() {
  const location = useLocation();
  return (
    <div style={{ display: "none" }}>
      <span data-testid="location-path">{location.pathname}</span>
      <span data-testid="location-search">{location.search}</span>
      <span data-testid="location-state">{JSON.stringify(location.state)}</span>
    </div>
  );
}

function renderPage(initialEntry = summaryPath) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <LocationProbe />
      <Routes>
        <Route path="/trips/:tripId/plans/new" element={<PlanCreatePage />} />
        <Route path="/trips/:tripId/plans/new/:section" element={<PlanCreatePage />} />
        <Route path="/trips/:tripId/plans" element={<div>목록 화면</div>} />
        <Route path="/trips/:tripId/plans/:planId" element={<div>상세 화면</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

const queryResult = (data: TripRoom) =>
  ({
    data,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }) as any;

const mutationResult = (mutateAsync: any) =>
  ({
    mutateAsync,
    isPending: false,
  }) as any;

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  mockUseSessionQuery.mockReturnValue({
    data: sessionUser,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  } as any);
  mockUseTripRoomRawQuery.mockReturnValue(queryResult(emptyRoom));
  mockUseCreatePlanMutation.mockReturnValue(mutationResult(vi.fn()));
});

describe("PlanReviewJump Adversarial Challenge Suite", () => {
  it("기본 정보 수정 점프 후 '검토로 돌아가기' 클릭 시 수정한 제목이 보존되고 즉시 검토로 복귀한다", async () => {
    localStorage.setItem(
      getPlanEditorDraftKey(hostId, tripId, "new"),
      JSON.stringify({
        ownerId: hostId,
        ...valid2CityDraft,
        updatedAt: "2026-09-01T00:00:00.000Z",
      }),
    );

    renderPage();

    // 1. Initial Review screen
    expect(await screen.findByRole("button", { name: "여행안 제안 등록" })).toBeEnabled();

    // 2. Click Basic Info jump link
    fireEvent.click(screen.getByRole("button", { name: /^기본 정보/ }));

    await waitFor(() => {
      expect(screen.getByTestId("location-path")).toHaveTextContent(`${summaryPath}/basic`);
      expect(screen.getByTestId("location-search")).toHaveTextContent("question=title&returnToReview=true");
    });

    // 3. Verify cancel/back button label is "검토로 돌아가기"
    const backBtn = screen.getByRole("button", { name: "검토로 돌아가기" });
    expect(backBtn).toBeInTheDocument();

    // 4. Modify Title
    const titleInput = screen.getByLabelText("여행안 제목 *");
    fireEvent.change(titleInput, { target: { value: "수정된 도쿄 & 교토 여행안" } });

    // 5. Cancel back to Review
    fireEvent.click(backBtn);

    await waitFor(() => {
      expect(screen.getByTestId("location-path")).toHaveTextContent(summaryPath);
      expect(screen.getByTestId("location-search")).toHaveTextContent("");
    });

    // 6. Modified title should be reflected in Review screen
    expect(screen.getByText("수정된 도쿄 & 교토 여행안")).toBeInTheDocument();
  });

  it("기본 정보 수정 점프 후 '다음' 클릭 시 다른 질문을 거치지 않고 즉시 검토 화면으로 복귀한다", async () => {
    localStorage.setItem(
      getPlanEditorDraftKey(hostId, tripId, "new"),
      JSON.stringify({
        ownerId: hostId,
        ...valid2CityDraft,
        updatedAt: "2026-09-01T00:00:00.000Z",
      }),
    );

    renderPage();

    expect(await screen.findByRole("button", { name: "여행안 제안 등록" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: /^기본 정보/ }));

    await waitFor(() => {
      expect(screen.getByTestId("location-path")).toHaveTextContent(`${summaryPath}/basic`);
      expect(screen.getByTestId("location-search")).toHaveTextContent("question=title&returnToReview=true");
    });

    const nextBtn = screen.getByRole("button", { name: "다음" });
    fireEvent.click(nextBtn);

    // Directly returns to Review
    await waitFor(() => {
      expect(screen.getByTestId("location-path")).toHaveTextContent(summaryPath);
      expect(screen.getByTestId("location-search")).toHaveTextContent("");
    });
  });

  it("2개 도시 경로 수정 시 2번째 도시(index=1)의 city -> arrival -> departure 순차 진행 후 검토로 복귀한다", async () => {
    localStorage.setItem(
      getPlanEditorDraftKey(hostId, tripId, "new"),
      JSON.stringify({
        ownerId: hostId,
        ...valid2CityDraft,
        updatedAt: "2026-09-01T00:00:00.000Z",
      }),
    );

    // Direct entry to index=1 route edit from review
    renderPage(`${summaryPath}/route?question=city&index=1&returnToReview=true`);

    expect(await screen.findByDisplayValue("교토")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "검토로 돌아가기" })).toBeInTheDocument();

    // Change city name
    fireEvent.change(screen.getByLabelText("방문 도시 *"), { target: { value: "오사카" } });

    // Step 1: city -> arrival-date (index=1)
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    await waitFor(() => {
      expect(screen.getByTestId("location-search")).toHaveTextContent("question=arrival-date&index=1&returnToReview=true");
    });

    // Step 2: arrival-date -> departure-date (index=1)
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    await waitFor(() => {
      expect(screen.getByTestId("location-search")).toHaveTextContent("question=departure-date&index=1&returnToReview=true");
    });

    // Step 3: departure-date -> Review
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    await waitFor(() => {
      expect(screen.getByTestId("location-path")).toHaveTextContent(summaryPath);
      expect(screen.getByTestId("location-search")).toHaveTextContent("");
    });

    // Verify Review displays modified city "오사카"
    expect(screen.getByText(/오사카/)).toBeInTheDocument();
  });

  it("숙소 '숙소 찾는 중' 상태일 때는 status 질문에서 바로 검토로 복귀한다", async () => {
    localStorage.setItem(
      getPlanEditorDraftKey(hostId, tripId, "new"),
      JSON.stringify({
        ownerId: hostId,
        ...valid2CityDraft,
        accommodations: [
          {
            id: "stay-1",
            city: "도쿄",
            period: "2026-11-10 ~ 2026-11-13",
            nights: 3,
            hotelName: "",
            isSearching: true,
            bookingStatus: "NOT_CHECKED",
          },
          valid2CityDraft.accommodations[1],
        ],
        updatedAt: "2026-09-01T00:00:00.000Z",
      }),
    );

    renderPage(`${summaryPath}/accommodation?question=status&index=0&returnToReview=true`);

    expect(await screen.findByRole("button", { name: "검토로 돌아가기" })).toBeInTheDocument();
    const nextBtn = screen.getByRole("button", { name: "다음" });

    // When isSearching is true, clicking next on status question returns straight to review
    fireEvent.click(nextBtn);

    await waitFor(() => {
      expect(screen.getByTestId("location-path")).toHaveTextContent(summaryPath);
      expect(screen.getByTestId("location-search")).toHaveTextContent("");
    });
  });

  it("숙소 확정 상태에서는 status -> hotel-name -> 검토 복귀 순서로 진행된다", async () => {
    localStorage.setItem(
      getPlanEditorDraftKey(hostId, tripId, "new"),
      JSON.stringify({
        ownerId: hostId,
        ...valid2CityDraft,
        updatedAt: "2026-09-01T00:00:00.000Z",
      }),
    );

    renderPage(`${summaryPath}/accommodation?question=status&index=0&returnToReview=true`);

    expect(await screen.findByRole("button", { name: "검토로 돌아가기" })).toBeInTheDocument();

    // Step 1: status -> hotel-name (isSearching is false)
    fireEvent.click(screen.getByRole("button", { name: "다음" }));

    await waitFor(() => {
      expect(screen.getByTestId("location-search")).toHaveTextContent("question=hotel-name&index=0&returnToReview=true");
    });

    const hotelInput = screen.getByLabelText("숙소명 / 호텔명 *");
    expect(hotelInput).toHaveValue("신주쿠 그랜드 호텔");
    fireEvent.change(hotelInput, { target: { value: "도쿄 파크 하얏트" } });

    // Step 2: hotel-name -> Review
    fireEvent.click(screen.getByRole("button", { name: "다음" }));

    await waitFor(() => {
      expect(screen.getByTestId("location-path")).toHaveTextContent(summaryPath);
      expect(screen.getByTestId("location-search")).toHaveTextContent("");
    });

    // Verify Review displays accommodation complete status with 2 locations
    expect(screen.getByText("2곳")).toBeInTheDocument();

    // Re-opening accommodation jump shows modified hotel name
    fireEvent.click(screen.getByRole("button", { name: /^숙소/ }));
    await waitFor(() => {
      expect(screen.getByTestId("location-path")).toHaveTextContent(`${summaryPath}/accommodation`);
    });
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    expect(await screen.findByLabelText("숙소명 / 호텔명 *")).toHaveValue("도쿄 파크 하얏트");
  });

  it("교통편 확정 상태(AVAILABLE)에서는 endpoints -> status -> mode -> duration -> 검토 복귀 순으로 진행된다", async () => {
    localStorage.setItem(
      getPlanEditorDraftKey(hostId, tripId, "new"),
      JSON.stringify({
        ownerId: hostId,
        ...valid2CityDraft,
        updatedAt: "2026-09-01T00:00:00.000Z",
      }),
    );

    renderPage(`${summaryPath}/transport?question=endpoints&index=0&returnToReview=true`);

    expect(await screen.findByRole("button", { name: "검토로 돌아가기" })).toBeInTheDocument();

    // Step 1: endpoints -> status
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    await waitFor(() => {
      expect(screen.getByTestId("location-search")).toHaveTextContent("question=status&index=0&returnToReview=true");
    });

    // Step 2: status -> mode
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    await waitFor(() => {
      expect(screen.getByTestId("location-search")).toHaveTextContent("question=mode&index=0&returnToReview=true");
    });

    // Step 3: mode -> duration
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    await waitFor(() => {
      expect(screen.getByTestId("location-search")).toHaveTextContent("question=duration&index=0&returnToReview=true");
    });

    // Step 4: duration -> Review
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    await waitFor(() => {
      expect(screen.getByTestId("location-path")).toHaveTextContent(summaryPath);
      expect(screen.getByTestId("location-search")).toHaveTextContent("");
    });
  });

  it("교통편 미확인(NOT_CHECKED) 상태에서는 status에서 '다음' 클릭 시 즉시 검토로 복귀한다", async () => {
    localStorage.setItem(
      getPlanEditorDraftKey(hostId, tripId, "new"),
      JSON.stringify({
        ownerId: hostId,
        ...valid2CityDraft,
        transports: [
          {
            id: "tr-1",
            fromCity: "인천",
            toCity: "도쿄",
            mode: "",
            hasTransfer: false,
            durationText: "",
            bookingStatus: "NOT_CHECKED",
          },
          valid2CityDraft.transports[1],
          valid2CityDraft.transports[2],
        ],
        updatedAt: "2026-09-01T00:00:00.000Z",
      }),
    );

    renderPage(`${summaryPath}/transport?question=status&index=0&returnToReview=true`);

    expect(await screen.findByRole("button", { name: "검토로 돌아가기" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "다음" }));

    await waitFor(() => {
      expect(screen.getByTestId("location-path")).toHaveTextContent(summaryPath);
      expect(screen.getByTestId("location-search")).toHaveTextContent("");
    });
  });

  it("잘못되거나 오염된 URL 파라미터가 들어와도 정상 질문 및 범위 내 인덱스로 정규화하여 렌더링된다", async () => {
    localStorage.setItem(
      getPlanEditorDraftKey(hostId, tripId, "new"),
      JSON.stringify({
        ownerId: hostId,
        ...valid2CityDraft,
        updatedAt: "2026-09-01T00:00:00.000Z",
      }),
    );

    // Corrupted index=999 and question=corrupted
    renderPage(`${summaryPath}/route?question=corrupted&index=999&returnToReview=true`);

    // Normalized to question=city, index=1 (max index for 2 cities is 1)
    await waitFor(() => {
      expect(screen.getByTestId("location-search")).toHaveTextContent("question=city&index=1&returnToReview=true");
    });
    expect(screen.getByLabelText("방문 도시 *")).toHaveValue("교토");
    expect(screen.getByRole("button", { name: "검토로 돌아가기" })).toBeInTheDocument();
  });
});

describe("PlanReviewJump Validation Error & Mutation Adversarial Suite", () => {
  it("경로 날짜 중복(출발일 > 다음 도시 도착일) 오류가 있을 때 경로 점프 시 정확한 2번째 도시의 arrival-date로 이동한다", async () => {
    localStorage.setItem(
      getPlanEditorDraftKey(hostId, tripId, "new"),
      JSON.stringify({
        ownerId: hostId,
        ...valid2CityDraft,
        routes: [
          { city: "도쿄", arrivalDate: "2026-11-10", departureDate: "2026-11-14" },
          { city: "교토", arrivalDate: "2026-11-13", departureDate: "2026-11-16" }, // arrival 11-13 < prev departure 11-14
        ],
        updatedAt: "2026-09-01T00:00:00.000Z",
      }),
    );

    renderPage();

    const submitBtn = await screen.findByRole("button", { name: "여행안 제안 등록" });
    expect(submitBtn).toBeDisabled();

    // Click '여행 경로' jump link
    fireEvent.click(screen.getByRole("button", { name: /^여행 경로/ }));

    // Should jump to index=1 arrival-date
    await waitFor(() => {
      expect(screen.getByTestId("location-path")).toHaveTextContent(`${summaryPath}/route`);
      expect(screen.getByTestId("location-search")).toHaveTextContent("question=arrival-date&index=1&returnToReview=true");
    });
  });

  it("교통편 소요시간 누락 오류가 있을 때 교통 점프 시 정확히 duration 질문으로 이동한다", async () => {
    localStorage.setItem(
      getPlanEditorDraftKey(hostId, tripId, "new"),
      JSON.stringify({
        ownerId: hostId,
        ...valid2CityDraft,
        transports: [
          {
            id: "tr-1",
            fromCity: "인천",
            toCity: "도쿄",
            mode: "항공",
            hasTransfer: false,
            durationText: "", // missing duration
            bookingStatus: "AVAILABLE",
          },
          valid2CityDraft.transports[1],
          valid2CityDraft.transports[2],
        ],
        updatedAt: "2026-09-01T00:00:00.000Z",
      }),
    );

    renderPage();

    expect(await screen.findByRole("button", { name: "여행안 제안 등록" })).toBeDisabled();

    // Click '교통' jump link (using start of name to avoid matching bottom "이전: 교통")
    fireEvent.click(screen.getByRole("button", { name: /^교통/ }));

    // Jumps straight to duration at index 0
    await waitFor(() => {
      expect(screen.getByTestId("location-path")).toHaveTextContent(`${summaryPath}/transport`);
      expect(screen.getByTestId("location-search")).toHaveTextContent("question=duration&index=0&returnToReview=true");
    });

    const durationInput = screen.getByLabelText("예상 소요시간 *");
    fireEvent.change(durationInput, { target: { value: "2시간 30분" } });

    fireEvent.click(screen.getByRole("button", { name: "다음" }));

    await waitFor(() => {
      expect(screen.getByTestId("location-path")).toHaveTextContent(summaryPath);
      expect(screen.getByTestId("location-search")).toHaveTextContent("");
    });
    expect(screen.getByRole("button", { name: "여행안 제안 등록" })).toBeEnabled();
  });

  it("대안 여행안 제출 시 RevisionConflict가 발생하면 최신 방 정보를 갱신하고 작성 중이던 입력값은 유지된다", async () => {
    const existingPlan: TripPlan = {
      id: PlanIdSchema.make("plan-ex-1"),
      title: "기존 여행안",
      status: "DRAFT",
      authorId: hostId,
      authorName: "방장",
      places: [],
      voteCount: 0,
    };
    const initialRoom: TripRoom = {
      ...emptyRoom,
      revision: RevisionSchema.make(2),
      plans: [existingPlan],
    };
    const updatedRoom: TripRoom = {
      ...emptyRoom,
      revision: RevisionSchema.make(3),
      plans: [existingPlan],
    };

    const refetch = vi.fn().mockResolvedValue({
      data: updatedRoom,
      isError: false,
    });

    mockUseTripRoomRawQuery.mockReturnValue({
      data: initialRoom,
      isLoading: false,
      isError: false,
      error: null,
      refetch,
    } as any);

    const conflictError = new ApiClientError({
      status: 409,
      message: "Revision Conflict",
      code: "REVISION_CONFLICT",
      details: {
        expectedRevision: 2,
        actualRevision: 3,
      },
    });

    const mutateAsync = vi.fn().mockRejectedValue(conflictError);
    mockUseCreatePlanMutation.mockReturnValue(mutationResult(mutateAsync));

    localStorage.setItem(
      getPlanEditorDraftKey(hostId, tripId, "new"),
      JSON.stringify({
        ownerId: hostId,
        ...valid2CityDraft,
        title: "동행자가 제안하는 대안 여행안",
        updatedAt: "2026-09-01T00:00:00.000Z",
        wizardCursor: {
          section: "review",
          question: "title",
        },
      }),
    );

    renderPage(summaryPath);

    const submitBtn = await screen.findByRole("button", { name: "대안 여행안 등록하기" });
    expect(submitBtn).toBeEnabled();

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(refetch).toHaveBeenCalled();
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    // Form data is retained, user can retry
    expect(screen.getByText("동행자가 제안하는 대안 여행안")).toBeInTheDocument();
  });
});
