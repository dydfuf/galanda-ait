// @vitest-environment jsdom
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { UseQueryResult } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import {
  PlanIdSchema,
  RevisionSchema,
  TripIdSchema,
  UserIdSchema,
} from "../../core/domain/ids.ts";
import type { TripRoom } from "../../core/domain/room.ts";
import type { PlanDetailViewModel } from "./plan-detail-view-model.ts";
import { toPlanDetailViewModel } from "./plan-detail-view-model.ts";

vi.mock("./queries.ts", () => ({
  useTripRoomDetailQuery: vi.fn(),
}));
vi.mock("./mutations.ts", () => ({
  useSubmitOpinionMutation: vi.fn(),
}));
vi.mock("../plan-editor/mutations.ts", () => ({
  useDeletePlanMutation: vi.fn(),
}));
vi.mock("../../hooks/useSession.ts", () => ({
  useSessionQuery: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: vi.fn(),
}));

import { useSessionQuery } from "../../hooks/useSession.ts";
import { useDeletePlanMutation } from "../plan-editor/mutations.ts";
import { useSubmitOpinionMutation } from "./mutations.ts";
import { PlanDetailPage } from "./PlanDetailPage.tsx";
import { useTripRoomDetailQuery } from "./queries.ts";

const mockUseSessionQuery = vi.mocked(useSessionQuery);
const mockUseDeletePlanMutation = vi.mocked(useDeletePlanMutation);
const mockUseSubmitOpinionMutation = vi.mocked(useSubmitOpinionMutation);
const mockUseTripRoomDetailQuery = vi.mocked(useTripRoomDetailQuery);

const hostId = UserIdSchema.make("user-host");
const memberId = UserIdSchema.make("user-member");
const guestId = UserIdSchema.make("user-guest");
const planId = PlanIdSchema.make("plan-1");

const longTitle =
  "도쿄와 하코네의 온천·맛집·미술관을 모두 방문하는 아주 긴 여행안 제목";
const longBookingUrl =
  "https://booking.example.com/reservations/very-long-destination-and-hotel-name?checkIn=2026-09-01&checkOut=2026-09-03";

const baseRoom: TripRoom = {
  id: TripIdSchema.make("trip-1"),
  title: "일본 여행",
  destination: "일본",
  revision: RevisionSchema.make(7),
  members: [
    { id: hostId, name: "방장", role: "HOST" },
    { id: memberId, name: "참여자", role: "MEMBER" },
  ],
  plans: [
    {
      id: planId,
      title: longTitle,
      status: "DRAFT",
      authorId: hostId,
      authorName: "방장",
      places: [],
      voteCount: 0,
      baseHeadcount: 2,
      routes: [
        {
          city: "매우 긴 이름의 도쿄 중심부와 하코네 연결 지역",
          arrivalDate: "2026-09-01",
          departureDate: "2026-09-03",
        },
      ],
      accommodations: [
        {
          id: "stay-1",
          city: "도쿄",
          period: "2026-09-01 ~ 2026-09-03",
          nights: 2,
          hotelName: "아주 긴 이름의 도쿄 중심부 호텔",
          bookingStatus: "AVAILABLE",
          bookingUrl: longBookingUrl,
        },
      ],
      transports: [
        {
          id: "transport-1",
          fromCity: "인천",
          toCity: "도쿄",
          mode: "항공",
          hasTransfer: false,
          durationText: "2시간 30분",
          bookingStatus: "AVAILABLE",
        },
      ],
      proposalReason:
        "모든 참여자가 읽을 수 있어야 하는 길고 구체적인 제안 이유입니다.",
      memberOpinions: [],
    },
  ],
  confirmedPlanId: undefined,
};

const makeViewModel = ({
  viewerId = hostId,
  accommodationPrice,
  transportPrice,
  includeTransport = true,
  confirmed = false,
}: {
  readonly viewerId?: typeof hostId;
  readonly accommodationPrice?: { readonly min: number; readonly max: number };
  readonly transportPrice?: { readonly min: number; readonly max: number };
  readonly includeTransport?: boolean;
  readonly confirmed?: boolean;
} = {}): PlanDetailViewModel => {
  const sourcePlan = baseRoom.plans[0];
  const room: TripRoom = {
    ...baseRoom,
    plans: [
      {
        ...sourcePlan,
        status: confirmed ? "CONFIRMED" : "DRAFT",
        accommodations: sourcePlan.accommodations?.map((item) => ({
          ...item,
          priceRange: accommodationPrice,
        })),
        transports: includeTransport
          ? sourcePlan.transports?.map((item) => ({
              ...item,
              priceRange: transportPrice,
            }))
          : [],
      },
    ],
    confirmedPlanId: confirmed ? planId : undefined,
  };

  return toPlanDetailViewModel(room, viewerId);
};

const queryResult = (
  data: PlanDetailViewModel,
  refetch = vi.fn().mockResolvedValue({ data, isError: false }),
): UseQueryResult<PlanDetailViewModel, Error> =>
  ({
    data,
    isLoading: false,
    isError: false,
    error: null,
    refetch,
  }) as unknown as UseQueryResult<PlanDetailViewModel, Error>;

const opinionMutationResult = (
  mutateAsync = vi.fn().mockResolvedValue(baseRoom),
  isPending = false,
): ReturnType<typeof useSubmitOpinionMutation> =>
  ({ mutateAsync, isPending }) as unknown as ReturnType<
    typeof useSubmitOpinionMutation
  >;

const deleteMutationResult = (
  mutateAsync = vi.fn().mockResolvedValue(baseRoom),
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

function pageScrollIsLocked(): boolean {
  return [document.documentElement, document.body].some(
    (element) =>
      element.style.overflow === "hidden" ||
      element.style.overflowX === "hidden" ||
      element.style.overflowY === "hidden",
  );
}

function TestApp() {
  return (
    <MemoryRouter initialEntries={["/trips/trip-1/plans/plan-1"]}>
      <Routes>
        <Route
          path="/trips/:tripId/plans/:planId"
          element={<PlanDetailPage />}
        />
        <Route path="*" element={<p>다른 화면</p>} />
      </Routes>
    </MemoryRouter>
  );
}

const renderPage = () => render(<TestApp />);

beforeEach(() => {
  const viewModel = makeViewModel();
  mockUseSessionQuery.mockReset();
  mockUseDeletePlanMutation.mockReset();
  mockUseSubmitOpinionMutation.mockReset();
  mockUseTripRoomDetailQuery.mockReset();

  mockUseSessionQuery.mockReturnValue({
    isError: false,
    error: null,
  } as ReturnType<typeof useSessionQuery>);
  mockUseTripRoomDetailQuery.mockReturnValue(queryResult(viewModel));
  mockUseSubmitOpinionMutation.mockReturnValue(opinionMutationResult());
  mockUseDeletePlanMutation.mockReturnValue(deleteMutationResult());
});

describe("PlanDetailPage state and truthful content", () => {
  it("loading은 success/error content와 배타적인 live status로 표시한다", () => {
    mockUseTripRoomDetailQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as UseQueryResult<PlanDetailViewModel, Error>);

    renderPage();

    expect(screen.getByRole("status")).toHaveTextContent(
      "여행안 상세 정보를 불러오는 중이에요.",
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });

  it("query error는 alert로 표시하고 상세 content를 만들지 않는다", () => {
    mockUseTripRoomDetailQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error("여행안 서버가 응답하지 않았어요."),
      refetch: vi.fn(),
    } as unknown as UseQueryResult<PlanDetailViewModel, Error>);

    renderPage();

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("여행 정보를 찾을 수 없습니다");
    expect(alert).toHaveTextContent("여행안 서버가 응답하지 않았어요.");
    expect(
      screen.queryByRole("heading", { level: 1, name: longTitle }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("list", { name: "예상 경비 상세" }),
    ).not.toBeInTheDocument();
  });

  it("모든 가격이 unknown이면 가격 미정을 표시하고 0원을 만들지 않는다", () => {
    mockUseTripRoomDetailQuery.mockReturnValue(queryResult(makeViewModel()));

    renderPage();

    expect(screen.getAllByText("가격 미정").length).toBeGreaterThan(0);
    expect(screen.getByText("2건 미정")).toBeInTheDocument();
    expect(screen.queryByText(/0원/)).not.toBeInTheDocument();
  });

  it("priced와 unknown이 섞이면 확인 금액과 미정 건수를 함께 표시한다", () => {
    mockUseTripRoomDetailQuery.mockReturnValue(
      queryResult(
        makeViewModel({ accommodationPrice: { min: 100_000, max: 120_000 } }),
      ),
    );

    renderPage();

    expect(
      screen.getByText(/확인된 그룹 금액 10만원 ~ 12만원/),
    ).toHaveTextContent("가격 미정 1건 별도");
    expect(screen.getByText("1건 미정")).toBeInTheDocument();
  });

  it("명시적인 0원은 가격 미정과 구분하고 그대로 표시한다", () => {
    mockUseTripRoomDetailQuery.mockReturnValue(
      queryResult(
        makeViewModel({
          accommodationPrice: { min: 0, max: 0 },
          includeTransport: false,
        }),
      ),
    );

    renderPage();

    expect(screen.getByText("그룹 총액 0원")).toBeInTheDocument();
    expect(screen.getByText("2명 기준 1인 0원")).toBeInTheDocument();
    expect(screen.queryByText("가격 미정")).not.toBeInTheDocument();
    expect(screen.queryByText(/건 미정/)).not.toBeInTheDocument();
  });

  it("긴 title·route·URL을 손실 없이 노출하고 wrapping/detail access를 유지한다", () => {
    renderPage();

    const title = screen.getByRole("heading", { level: 1, name: longTitle });
    expect(title.className).toContain("[overflow-wrap:anywhere]");
    expect(
      screen.getByText(
        /모든 참여자가 읽을 수 있어야 하는 길고 구체적인 제안 이유입니다\./,
      ),
    ).toBeInTheDocument();

    const bookingLink = screen.getByRole("link", { name: "예약 정보 보기" });
    expect(bookingLink).toHaveAttribute("href", longBookingUrl);
    expect(bookingLink.className).toContain("[overflow-wrap:anywhere]");
  });
});

describe("PlanDetailPage permission and overlay contracts", () => {
  it.each([
    ["HOST author", hostId, true, true],
    ["MEMBER", memberId, false, true],
    ["GUEST", guestId, false, false],
  ] as const)(
    "%s 권한에 맞는 manage/opinion/create action만 노출한다",
    (_role, viewerId, canManage, canParticipate) => {
      mockUseTripRoomDetailQuery.mockReturnValue(
        queryResult(makeViewModel({ viewerId })),
      );

      renderPage();

      expect(Boolean(screen.queryByRole("button", { name: "더보기" }))).toBe(
        canManage,
      );
      expect(
        Boolean(screen.queryByRole("button", { name: "내 의견 남기기" })),
      ).toBe(canParticipate);
      expect(
        Boolean(
          screen.queryByRole("button", { name: /다른 구성으로 제안하기/ }),
        ),
      ).toBe(canParticipate);
    },
  );

  it("management Drawer는 이름·설명·focus/scroll lifecycle을 유지한다", async () => {
    renderPage();

    const opener = screen.getByRole("button", { name: "더보기" });
    opener.focus();
    fireEvent.click(opener);

    const dialog = await screen.findByRole("dialog", { name: "여행안 관리" });
    expect(dialog).toHaveAccessibleDescription(
      "이 여행안을 관리할 권한이 있는 참여자만 수정하거나 삭제할 수 있어요.",
    );
    expect(
      within(dialog).getByRole("button", { name: "여행안 삭제" }),
    ).toBeInTheDocument();
    await waitFor(() => expect(pageScrollIsLocked()).toBe(true));
    await waitFor(() =>
      expect(dialog).toContainElement(document.activeElement as HTMLElement),
    );

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "여행안 관리" }),
      ).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(opener).toHaveFocus());
    await waitFor(() => expect(pageScrollIsLocked()).toBe(false));
  });

  it("delete AlertDialog는 파괴 결과를 명시하고 실패를 dialog 안에 유지한다", async () => {
    const mutateAsync = vi
      .fn()
      .mockRejectedValue(new Error("여행안 삭제 서버가 응답하지 않았어요."));
    mockUseDeletePlanMutation.mockReturnValue(
      deleteMutationResult(mutateAsync),
    );
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "더보기" }));
    const managementDialog = await screen.findByRole("dialog", {
      name: "여행안 관리",
    });
    fireEvent.click(
      within(managementDialog).getByRole("button", { name: "여행안 삭제" }),
    );

    const deleteDialog = await screen.findByRole("alertdialog", {
      name: "여행안을 삭제할까요?",
    });
    expect(deleteDialog).toHaveAccessibleDescription(
      `‘${longTitle}’ 여행안과 작성한 내용이 영구 삭제되며 되돌릴 수 없어요.`,
    );
    fireEvent.click(
      within(deleteDialog).getByRole("button", { name: "영구 삭제하기" }),
    );

    const alert = await within(deleteDialog).findByRole("alert");
    expect(alert).toHaveTextContent("여행안 삭제 서버가 응답하지 않았어요.");
    expect(deleteDialog).toBeInTheDocument();
    expect(mutateAsync).toHaveBeenCalledWith({
      roomId: "trip-1",
      planId: "plan-1",
      expectedRevision: 7,
    });
  });

  it("opinion mutation pending은 중복 제출을 막고 실패하면 입력을 drawer 안에 유지한다", async () => {
    const request = deferred<TripRoom>();
    const mutateAsync = vi.fn(() => request.promise);
    mockUseSubmitOpinionMutation.mockReturnValue(
      opinionMutationResult(mutateAsync),
    );
    const view = renderPage();

    fireEvent.click(screen.getByRole("button", { name: "내 의견 남기기" }));
    const dialog = await screen.findByRole("dialog", {
      name: "이 여행안은 어때요?",
    });
    fireEvent.click(within(dialog).getByRole("radio", { name: "어려워요" }));
    const reasonInput = within(dialog).getByLabelText("어려운 이유");
    fireEvent.change(reasonInput, {
      target: { value: "입력한 이유는 실패 후에도 남아야 해요." },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "의견 저장하기" }),
    );

    expect(mutateAsync).toHaveBeenCalledTimes(1);
    expect(mutateAsync).toHaveBeenCalledWith({
      roomId: "trip-1",
      planId: "plan-1",
      reaction: "HARD",
      reason: "입력한 이유는 실패 후에도 남아야 해요.",
      expectedRevision: 7,
    });

    mockUseSubmitOpinionMutation.mockReturnValue(
      opinionMutationResult(mutateAsync, true),
    );
    view.rerender(<TestApp />);

    const pendingButton = within(dialog).getByRole("button", {
      name: "저장 중...",
    });
    expect(pendingButton).toBeDisabled();
    expect(pendingButton).toHaveAttribute("aria-busy", "true");
    fireEvent.click(pendingButton);
    expect(mutateAsync).toHaveBeenCalledTimes(1);

    await act(async () => {
      request.reject(new Error("의견 저장 서버가 응답하지 않았어요."));
      await request.promise.catch(() => undefined);
    });

    mockUseSubmitOpinionMutation.mockReturnValue(
      opinionMutationResult(mutateAsync, false),
    );
    view.rerender(<TestApp />);

    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "의견 저장 서버가 응답하지 않았어요.",
    );
    expect(within(dialog).getByLabelText("어려운 이유")).toHaveValue(
      "입력한 이유는 실패 후에도 남아야 해요.",
    );
    expect(dialog).toBeInTheDocument();
  });
});
