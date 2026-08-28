// @vitest-environment jsdom
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

import {
  PlanIdSchema,
  RevisionSchema,
  TripIdSchema,
  UserIdSchema,
} from "../../core/domain/ids.ts";
import type { TripRoom } from "../../core/domain/room.ts";
import { toPlanDetailViewModel } from "../plan-detail/plan-detail-view-model.ts";

vi.mock("../plan-detail/queries.ts", () => ({
  useTripRoomDetailQuery: vi.fn(),
}));
vi.mock("../plan-home/mutations.ts", () => ({
  useConfirmPlanMutation: vi.fn(),
}));

import { useTripRoomDetailQuery } from "../plan-detail/queries.ts";
import { useConfirmPlanMutation } from "../plan-home/mutations.ts";
import { PlanComparePage } from "./PlanComparePage.tsx";

const mockUseTripRoomDetailQuery = vi.mocked(useTripRoomDetailQuery);
const mockUseConfirmPlanMutation = vi.mocked(useConfirmPlanMutation);

const HOST_ID = UserIdSchema.make("user-host");
const MEMBER_ID = UserIdSchema.make("user-member");
const TRIP_ID = "trip-compare";
const LONG_BASIC_TITLE =
  "서울과 부산의 모든 이동 경로와 숙박 조건을 빠짐없이 비교하는 아주 긴 기본 여행안";
const LONG_ALTERNATIVE_TITLE =
  "가격을 아직 입력하지 않은 https://example.com/very/long/alternative/plan 여행안";
const COMPARE_PATH = `/trips/${TRIP_ID}/plans/compare?left=plan-alt&right=plan-basic`;

const makeRoom = (confirmedPlanId?: "plan-basic"): TripRoom => ({
  id: TripIdSchema.make(TRIP_ID),
  title: "전국 일주 비교 여행",
  destination: "서울, 부산",
  revision: RevisionSchema.make(7),
  members: [
    { id: HOST_ID, name: "방장", role: "HOST" },
    { id: MEMBER_ID, name: "참여자", role: "MEMBER" },
  ],
  plans: [
    {
      id: PlanIdSchema.make("plan-basic"),
      title: LONG_BASIC_TITLE,
      status: "VOTING",
      authorId: HOST_ID,
      authorName: "방장",
      baseHeadcount: 4,
      routes: [
        {
          city: "서울특별시에서 아주 긴 이름의 도심 지역",
          arrivalDate: "2026-09-01",
          departureDate: "2026-09-03",
        },
        {
          city: "부산광역시 해운대와 기장 해안 지역",
          arrivalDate: "2026-09-03",
          departureDate: "2026-09-05",
        },
      ],
      accommodations: [
        {
          id: "stay-basic",
          city: "서울특별시에서 아주 긴 이름의 도심 지역",
          period: "1~2일차",
          nights: 2,
          hotelName: "가족 모두가 머무는 매우 긴 이름의 서울 숙소",
          bookingStatus: "NEED_CHECK",
          priceRange: { min: 400_000, max: 520_000 },
        },
      ],
      transports: [
        {
          id: "transport-basic",
          fromCity: "서울특별시에서 아주 긴 이름의 도심 지역",
          toCity: "부산광역시 해운대와 기장 해안 지역",
          mode: "고속철도와 지역 이동 수단 조합",
          hasTransfer: true,
          durationText: "약 4시간 30분",
          bookingStatus: "NOT_CHECKED",
        },
      ],
      places: [],
      voteCount: 0,
    },
    {
      id: PlanIdSchema.make("plan-alt"),
      title: LONG_ALTERNATIVE_TITLE,
      status: "VOTING",
      authorId: MEMBER_ID,
      authorName: "참여자",
      baseHeadcount: 4,
      routes: [],
      accommodations: [],
      transports: [],
      places: [],
      voteCount: 0,
    },
    {
      id: PlanIdSchema.make("plan-third"),
      title: "세 번째 장거리 여행안",
      status: "VOTING",
      authorId: MEMBER_ID,
      authorName: "참여자",
      baseHeadcount: 4,
      routes: [
        {
          city: "대전",
          arrivalDate: "2026-09-02",
          departureDate: "2026-09-03",
        },
      ],
      accommodations: [],
      transports: [],
      places: [],
      voteCount: 0,
    },
  ],
  confirmedPlanId: confirmedPlanId
    ? PlanIdSchema.make(confirmedPlanId)
    : undefined,
});

const detailQueryResult = (
  data: ReturnType<typeof toPlanDetailViewModel> | undefined,
  overrides: Record<string, unknown> = {},
): ReturnType<typeof useTripRoomDetailQuery> =>
  ({
    data,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  }) as unknown as ReturnType<typeof useTripRoomDetailQuery>;

const mutationResult = (
  mutateAsync = vi.fn(),
  isPending = false,
): ReturnType<typeof useConfirmPlanMutation> =>
  ({
    mutateAsync,
    isPending,
  }) as unknown as ReturnType<typeof useConfirmPlanMutation>;

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
  return (
    <div data-testid="location-path">
      {location.pathname}
      {location.search}
    </div>
  );
}

function TestApp({ initialEntry = COMPARE_PATH }: { initialEntry?: string }) {
  return (
    <MemoryRouter initialEntries={[initialEntry]}>
      <LocationProbe />
      <Routes>
        <Route
          path="/trips/:tripId/plans/compare"
          element={<PlanComparePage />}
        />
        <Route path="*" element={<div>이동 완료</div>} />
      </Routes>
    </MemoryRouter>
  );
}

const renderPage = (initialEntry = COMPARE_PATH) =>
  render(<TestApp initialEntry={initialEntry} />);

beforeEach(() => {
  mockUseTripRoomDetailQuery.mockReset();
  mockUseConfirmPlanMutation.mockReset();
  mockUseTripRoomDetailQuery.mockReturnValue(
    detailQueryResult(toPlanDetailViewModel(makeRoom(), HOST_ID)),
  );
  mockUseConfirmPlanMutation.mockReturnValue(mutationResult());
});

describe("PlanComparePage responsive hierarchy and source order", () => {
  it("query의 left/right 순서를 세로 reading order로 유지하고 긴 값과 미정 가격을 줄바꿈한다", () => {
    const { container } = renderPage();

    const content = container.querySelector<HTMLElement>(
      '[data-galanda-surface="content"]',
    );
    expect(content?.className).toContain("max-w-(--content-max-width)");
    expect(content?.className).not.toContain("max-w-[640px]");
    expect(container.querySelector("table")).toBeNull();

    const headings = screen.getAllByRole("heading");
    expect(headings.slice(0, 3).map((heading) => heading.tagName)).toEqual([
      "H1",
      "H2",
      "H2",
    ]);
    expect(headings.slice(0, 3).map((heading) => heading.textContent)).toEqual([
      "어떤 여행안이 더 좋나요?",
      "여행안 선택",
      "두 안은 이것이 달라요",
    ]);
    expect(
      screen.getByRole("heading", { level: 3, name: "예상 경비" }),
    ).toBeInTheDocument();

    const radios = screen.getAllByRole("radio");
    expect(radios).toEqual([
      screen.getByRole("radio", {
        name: `${LONG_ALTERNATIVE_TITLE} 선택`,
      }),
      screen.getByRole("radio", { name: `${LONG_BASIC_TITLE} 선택` }),
    ]);
    expect(radios[0]).toHaveAttribute("aria-checked", "true");

    const longTitle = screen.getByText(LONG_ALTERNATIVE_TITLE);
    expect(longTitle.className).toContain("[overflow-wrap:anywhere]");
    expect(longTitle.closest("label")?.className).toContain("min-w-0");

    const differences = screen.getByRole("list", {
      name: "여행안이 다른 항목",
    });
    const costHeading = within(differences).getByRole("heading", {
      level: 3,
      name: "예상 경비",
    });
    const costItem = costHeading.closest<HTMLElement>('[role="listitem"]');
    expect(costItem).not.toBeNull();
    expect(
      within(costItem as HTMLElement).getByText("예상 경비 미정"),
    ).toBeInTheDocument();
    expect(within(costItem as HTMLElement).queryByText("0원")).toBeNull();
    expect(
      within(costItem as HTMLElement).getByText(/가격 미정 1건 별도/),
    ).toBeInTheDocument();

    const leftValue = within(costItem as HTMLElement).getByText(
      "예상 경비 미정",
    );
    const leftRow = leftValue.parentElement;
    expect(leftRow?.className).toContain("flex-col");
    expect(leftValue.className).toContain("[overflow-wrap:anywhere]");
  });
});

describe("PlanComparePage query state", () => {
  it("loading은 success/error content와 배타적인 live status다", () => {
    mockUseTripRoomDetailQuery.mockReturnValue(
      detailQueryResult(undefined, { isLoading: true }),
    );

    renderPage();

    expect(screen.getByRole("status")).toHaveTextContent(
      "비교 정보를 불러오는 중이에요.",
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
  });

  it("query error만 alert로 표시하고 다시 시도하면 동일 query를 refetch한다", () => {
    const refetch = vi.fn();
    mockUseTripRoomDetailQuery.mockReturnValue(
      detailQueryResult(undefined, {
        isError: true,
        error: new Error("비교 서버가 응답하지 않았어요."),
        refetch,
      }),
    );

    const { container } = renderPage();

    expect(screen.getByRole("alert")).toHaveTextContent(
      "여행 정보를 찾을 수 없습니다",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "비교 서버가 응답하지 않았어요.",
    );
    expect(container.querySelector('[data-system-state="loading"]')).toBeNull();
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});

describe("PlanComparePage selection and overlay behavior", () => {
  it("선택 변경을 primary action과 확인 Drawer 요약에 반영하고 Escape 후 opener focus를 복원한다", async () => {
    renderPage();

    const basicRadio = screen.getByRole("radio", {
      name: `${LONG_BASIC_TITLE} 선택`,
    });
    fireEvent.click(basicRadio);
    expect(basicRadio).toHaveAttribute("aria-checked", "true");

    const opener = screen.getByRole("button", {
      name: `선택한 '${LONG_BASIC_TITLE}'으로 여행 확정하기`,
    });
    opener.focus();
    fireEvent.click(opener);

    const dialog = await screen.findByRole("dialog", {
      name: "이 여행안으로 확정할까요?",
    });
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    expect(
      within(dialog).getByRole("heading", {
        level: 3,
        name: LONG_BASIC_TITLE,
      }),
    ).toBeInTheDocument();
    expect(
      dialog.querySelector('[data-plan-summary-layout="vertical"]'),
    ).not.toBeNull();
    expect(within(dialog).getAllByText(/가격 미정 1건 별도/)).toHaveLength(2);

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", {
          name: "이 여행안으로 확정할까요?",
        }),
      ).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it("비교 대상 Drawer는 반대편 선택을 제외하고 Escape와 재선택 navigation을 지원한다", async () => {
    renderPage();

    const opener = screen.getByRole("button", {
      name: "왼쪽 비교 대상 바꾸기",
    });
    opener.focus();
    fireEvent.click(opener);

    let dialog = await screen.findByRole("dialog", {
      name: "왼쪽 여행안 선택",
    });
    expect(
      within(dialog).queryByRole("button", {
        name: `${LONG_BASIC_TITLE} 선택`,
      }),
    ).not.toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", {
        name: "세 번째 장거리 여행안 선택",
      }),
    ).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "왼쪽 여행안 선택" }),
      ).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(opener).toHaveFocus());

    fireEvent.click(opener);
    dialog = await screen.findByRole("dialog", {
      name: "왼쪽 여행안 선택",
    });
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "세 번째 장거리 여행안 선택",
      }),
    );

    await waitFor(() =>
      expect(screen.getByTestId("location-path")).toHaveTextContent(
        `/trips/${TRIP_ID}/plans/compare?left=plan-third&right=plan-basic`,
      ),
    );
  });
});

describe("PlanComparePage confirmation states", () => {
  it("pending label과 aria-busy로 중복 확정을 막고 server resolve 이후에만 이동한다", async () => {
    const confirmation = deferred<unknown>();
    const mutateAsync = vi.fn(() => confirmation.promise);
    mockUseConfirmPlanMutation.mockReturnValue(
      mutationResult(mutateAsync, false),
    );

    const view = renderPage();
    fireEvent.click(
      screen.getByRole("button", {
        name: `선택한 '${LONG_ALTERNATIVE_TITLE}'으로 여행 확정하기`,
      }),
    );
    let dialog = await screen.findByRole("dialog", {
      name: "이 여행안으로 확정할까요?",
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "확정하기" }));

    expect(mutateAsync).toHaveBeenCalledTimes(1);
    expect(mutateAsync).toHaveBeenCalledWith({
      roomId: TRIP_ID,
      planId: "plan-alt",
      revision: 7,
    });
    expect(screen.getByTestId("location-path")).toHaveTextContent(COMPARE_PATH);

    mockUseConfirmPlanMutation.mockReturnValue(
      mutationResult(mutateAsync, true),
    );
    view.rerender(<TestApp />);

    dialog = await screen.findByRole("dialog", {
      name: "이 여행안으로 확정할까요?",
    });
    const pendingAction = within(dialog).getByRole("button", {
      name: "확정 중...",
    });
    expect(pendingAction).toBeDisabled();
    expect(pendingAction).toHaveAttribute("aria-busy", "true");
    fireEvent.click(pendingAction);
    expect(mutateAsync).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("location-path")).toHaveTextContent(COMPARE_PATH);

    await act(async () => {
      confirmation.resolve(undefined);
      await confirmation.promise;
    });

    await waitFor(() =>
      expect(screen.getByTestId("location-path")).toHaveTextContent(
        `/trips/${TRIP_ID}/itinerary`,
      ),
    );
  });

  it("참여자는 확정 action 없이 비교하고 확정된 방은 선택을 잠근다", () => {
    mockUseTripRoomDetailQuery.mockReturnValue(
      detailQueryResult(toPlanDetailViewModel(makeRoom(), MEMBER_ID)),
    );

    const memberView = renderPage();

    expect(
      screen.getByRole("region", { name: "확정 권한 안내" }),
    ).toHaveTextContent("여행안 확정은 방장이 진행해요.");
    expect(
      screen.queryByRole("button", { name: /여행 확정하기/ }),
    ).not.toBeInTheDocument();

    memberView.unmount();
    mockUseTripRoomDetailQuery.mockReturnValue(
      detailQueryResult(toPlanDetailViewModel(makeRoom("plan-basic"), HOST_ID)),
    );
    renderPage();

    expect(
      screen.getByRole("radiogroup", { name: "확정된 여행안" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: `${LONG_BASIC_TITLE} 선택` }),
    ).toHaveAttribute("aria-disabled", "true");
    expect(
      screen.getByRole("button", { name: "확정 일정 보기" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /여행 확정하기/ }),
    ).not.toBeInTheDocument();
  });
});
