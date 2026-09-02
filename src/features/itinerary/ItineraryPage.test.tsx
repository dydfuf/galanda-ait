// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import type { ConfirmedItineraryResponse, ItineraryStateResponse } from "../../contracts/itinerary.ts";
import {
  ItineraryIdSchema,
  ParticipantIdSchema,
  PlanIdSchema,
  RevisionSchema,
  TripIdSchema,
} from "../../core/domain/ids.ts";
import type { PlatformAdapter, PlatformNavigation } from "../../platform/types.ts";

type MutablePlatformAdapter = Omit<PlatformAdapter, "navigation"> & {
  navigation?: PlatformNavigation;
};

const mocks = vi.hoisted(() => ({
  platform: {
    name: "web",
    signIn: vi.fn().mockResolvedValue(undefined),
    share: vi.fn().mockResolvedValue("shared"),
    openExternalUrl: vi.fn().mockResolvedValue(undefined),
    requestClose: vi.fn().mockResolvedValue(false),
    navigation: undefined,
  } as MutablePlatformAdapter,
}));

vi.mock("../../platform/index.ts", () => ({
  platform: mocks.platform,
}));
vi.mock("./queries.ts", () => ({
  useItineraryQuery: vi.fn(),
}));
vi.mock("./mutations.ts", () => ({
  useAcknowledgeItineraryMutation: vi.fn(),
}));

import { TripRoomTabLayout } from "../../app/layouts/TripRoomTabLayout.tsx";
import { ItineraryPage } from "./ItineraryPage.tsx";
import { useAcknowledgeItineraryMutation } from "./mutations.ts";
import { useItineraryQuery } from "./queries.ts";

const mockUseItineraryQuery = vi.mocked(useItineraryQuery);
const mockUseAcknowledgeItineraryMutation = vi.mocked(
  useAcknowledgeItineraryMutation,
);

const TRIP_ID = "trip-itinerary-view";
const ITINERARY_PATH = `/trips/${TRIP_ID}/itinerary`;
const LONG_PLAN_TITLE =
  "모든 참여자가 320px 화면과 200% 확대에서도 끝까지 읽어야 하는 도쿄·하코네 확정 일정";
const LONG_DESTINATION =
  "도쿄에서 하코네까지 이어지는 매우 긴 여행지 설명";
const LONG_CITY = "도쿄 중심부와 인근 지역을 모두 포함하는 긴 도시 이름";
const LONG_HOTEL_NAME =
  "https://example.com/hotels/a-very-long-unbroken-name 도쿄 장기 체류 호텔";
const LONG_BOOKING_URL =
  "https://booking.example.com/reservations/very/long/path/that/must/remain/available";
const LONG_MEMO =
  "체크인 안내와 짐 보관 조건을 포함한 긴 메모도 잘리지 않고 상세 화면에서 모두 읽을 수 있어야 합니다.";

const itinerary: ConfirmedItineraryResponse = {
  id: ItineraryIdSchema.make("itinerary-view"),
  tripId: TripIdSchema.make(TRIP_ID),
  sourcePlanId: PlanIdSchema.make("plan-source"),
  sourcePlanRevision: RevisionSchema.make(2),
  currentRevision: RevisionSchema.make(1),
  createdBy: ParticipantIdSchema.make("participant-host"),
  createdAt: "2026-08-24T00:00:00.000Z",
  snapshot: {
    planTitle: LONG_PLAN_TITLE,
    destination: LONG_DESTINATION,
    routes: [
      {
        city: LONG_CITY,
        arrivalDate: "2026-12-10",
        departureDate: "2026-12-12",
      },
      {
        city: "하코네",
        arrivalDate: "2026-12-12",
        departureDate: "2026-12-13",
      },
    ],
    items: [
      {
        type: "STAY",
        date: "2026-12-10",
        endDate: "2026-12-12",
        memo: LONG_MEMO,
        accommodation: {
          id: "stay-long",
          city: LONG_CITY,
          period: "12.10 ~ 12.12",
          nights: 2,
          hotelName: LONG_HOTEL_NAME,
          bookingStatus: "NEED_CHECK",
          bookingUrl: LONG_BOOKING_URL,
        },
      },
      {
        type: "TRANSPORT",
        date: "2026-12-12",
        transport: {
          id: "transport-unknown-details",
          fromCity: "",
          toCity: "",
          mode: "",
          hasTransfer: false,
          durationText: "",
          bookingStatus: "AVAILABLE",
          priceRange: { min: 0, max: 0 },
        },
      },
    ],
  },
};

const confirmedState = (
  value: ConfirmedItineraryResponse = itinerary,
): ItineraryStateResponse => ({
  status: "CONFIRMED",
  itinerary: value,
  canEdit: true,
  acknowledgements: [],
  unacknowledgedCount: 0,
});

interface QueryOptions {
  readonly isLoading?: boolean;
  readonly isError?: boolean;
  readonly error?: Error | null;
  readonly refetch?: ReturnType<typeof vi.fn>;
}

const queryResult = (
  data: ItineraryStateResponse | undefined = confirmedState(),
  options: QueryOptions = {},
): ReturnType<typeof useItineraryQuery> =>
  ({
    data,
    isLoading: options.isLoading ?? false,
    isError: options.isError ?? false,
    error: options.error ?? null,
    refetch: options.refetch ?? vi.fn(),
  }) as unknown as ReturnType<typeof useItineraryQuery>;

const acknowledgeMutationResult = (): ReturnType<
  typeof useAcknowledgeItineraryMutation
> =>
  ({
    isPending: false,
    isError: false,
    error: null,
    reset: vi.fn(),
    mutateAsync: vi.fn(),
  }) as unknown as ReturnType<typeof useAcknowledgeItineraryMutation>;

function FeatureApp() {
  return (
    <MemoryRouter initialEntries={[ITINERARY_PATH]}>
      <Routes>
        <Route path="/trips/:tripId/itinerary" element={<ItineraryPage />} />
      </Routes>
    </MemoryRouter>
  );
}

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

function TabShellApp() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[ITINERARY_PATH]}>
        <Routes>
          <Route path="/trips/:tripId" element={<TripRoomTabLayout />}>
            <Route path="itinerary" element={<ItineraryPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const renderPage = () => render(<FeatureApp />);
const renderTabShellPage = () => render(<TabShellApp />);

function pageScrollIsLocked(): boolean {
  return [document.documentElement, document.body].some(
    (element) =>
      element.style.overflow === "hidden" ||
      element.style.overflowX === "hidden" ||
      element.style.overflowY === "hidden",
  );
}

beforeEach(() => {
  mocks.platform.navigation = undefined;
  vi.clearAllMocks();
  mockUseItineraryQuery.mockReset();
  mockUseAcknowledgeItineraryMutation.mockReset();
  mockUseItineraryQuery.mockReturnValue(queryResult());
  mockUseAcknowledgeItineraryMutation.mockReturnValue(
    acknowledgeMutationResult(),
  );
});

afterEach(async () => {
  cleanup();
  await new Promise((resolve) => window.setTimeout(resolve, 0));
});

describe("ItineraryPage state and responsive content contracts", () => {
  it("loading, error, empty, success를 서로 배타적인 system state로 렌더링한다", () => {
    const refetch = vi.fn();
    mockUseItineraryQuery.mockReturnValue(
      queryResult(undefined, { isLoading: true }),
    );
    const view = renderPage();

    expect(
      view.container.querySelectorAll('[data-system-state="loading"]'),
    ).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent(
      "확정 일정을 불러오는 중입니다...",
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();

    mockUseItineraryQuery.mockReturnValue(
      queryResult(undefined, {
        isError: true,
        error: new Error("확정 일정 서버가 응답하지 않았어요."),
        refetch,
      }),
    );
    view.rerender(<FeatureApp />);

    expect(
      view.container.querySelectorAll('[data-system-state="error"]'),
    ).toHaveLength(1);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "확정 일정 서버가 응답하지 않았어요.",
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(refetch).toHaveBeenCalledTimes(1);

    const emptyItinerary: ConfirmedItineraryResponse = {
      ...itinerary,
      snapshot: { ...itinerary.snapshot, items: [] },
    };
    mockUseItineraryQuery.mockReturnValue(
      queryResult(confirmedState(emptyItinerary)),
    );
    view.rerender(<FeatureApp />);

    expect(
      view.container.querySelectorAll('[data-system-state="empty"]'),
    ).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent(
      "등록된 확정 일정이 없어요",
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();

    mockUseItineraryQuery.mockReturnValue(queryResult());
    view.rerender(<FeatureApp />);

    expect(
      view.container.querySelectorAll('[data-system-state="success"]'),
    ).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 1, name: LONG_PLAN_TITLE }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("representative width 변경에서도 720px opaque date-list hierarchy와 긴 source content를 유지한다", () => {
    const { container } = renderPage();
    const successBody = container.querySelector<HTMLElement>(
      '[data-system-state="success"]',
    );
    const planTitle = screen.getByRole("heading", {
      level: 1,
      name: LONG_PLAN_TITLE,
    });
    const firstDateList = screen.getByRole("list", { name: "12월 10일" });
    const secondDateList = screen.getByRole("list", { name: "12월 12일" });

    expect(successBody).toHaveClass(
      "max-w-(--content-max-width)",
      "min-w-0",
    );
    expect(planTitle.className).toContain("[overflow-wrap:anywhere]");
    expect(planTitle).toHaveTextContent(LONG_PLAN_TITLE);
    expect(
      screen.getByText((content) => content.includes(LONG_DESTINATION)),
    ).toBeInTheDocument();
    expect(
      Array.from(container.querySelectorAll("h1,h2"), (heading) =>
        heading.textContent?.trim(),
      ),
    ).toEqual([LONG_PLAN_TITLE, "12월 10일", "12월 12일"]);

    for (const list of [firstDateList, secondDateList]) {
      expect(list).toHaveAttribute("data-galanda-surface", "content");
      expect(list.className).toContain("bg-surface-content");
      expect(within(list).getAllByRole("listitem")).toHaveLength(1);
    }

    const stayAction = within(firstDateList).getByRole("button", {
      name: `${LONG_HOTEL_NAME}, 2박 · 확인 필요`,
    });
    expect(stayAction.className).toContain("min-h-(--touch-target-min)");
    expect(stayAction).toHaveTextContent(LONG_HOTEL_NAME);
    expect(within(secondDateList).getByRole("button")).toHaveAccessibleName(
      "출발지 미정 → 도착지 미정, 이동 수단 미정 · 예매 가능",
    );

    for (const width of [320, 390, 1440]) {
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        value: width,
      });
      fireEvent(window, new Event("resize"));
      expect(planTitle).toHaveTextContent(LONG_PLAN_TITLE);
      expect(successBody).toHaveClass("max-w-(--content-max-width)");
      expect(screen.getByRole("list", { name: "12월 10일" })).toBe(
        firstDateList,
      );
    }
  });
});

describe("ItineraryPage truthful detail Drawer contracts", () => {
  it("unknown 가격·확인 정보와 긴 상세를 보존하고 focus/scroll/Escape lifecycle을 유지한다", async () => {
    renderPage();

    const opener = screen.getByRole("button", {
      name: `${LONG_HOTEL_NAME}, 2박 · 확인 필요`,
    });
    opener.focus();
    fireEvent.click(opener);

    const dialog = await screen.findByRole("dialog", {
      name: LONG_HOTEL_NAME,
    });
    expect(dialog).toHaveAccessibleDescription(
      `${LONG_CITY} · 12.10 ~ 12.12 · 2박`,
    );
    await waitFor(() => expect(pageScrollIsLocked()).toBe(true));
    await waitFor(() =>
      expect(dialog).toContainElement(document.activeElement as HTMLElement),
    );

    expect(within(dialog).getByText("가격 미정")).toBeInTheDocument();
    expect(within(dialog).queryByText("그룹 총액 0원")).not.toBeInTheDocument();
    expect(within(dialog).getByText("확정 당시 snapshot")).toBeInTheDocument();
    expect(within(dialog).getByText(LONG_MEMO)).toBeInTheDocument();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "숙소 예약 링크 열기" }),
    );
    expect(mocks.platform.openExternalUrl).toHaveBeenCalledWith(
      LONG_BOOKING_URL,
    );

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: LONG_HOTEL_NAME }),
      ).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(opener).toHaveFocus());
    await waitFor(() => expect(pageScrollIsLocked()).toBe(false));
  });

  it("누락된 교통 상세는 명시적 미정으로, 입력된 0원은 unknown과 구분해 표시한다", async () => {
    renderPage();

    fireEvent.click(
      screen.getByRole("button", {
        name: "출발지 미정 → 도착지 미정, 이동 수단 미정 · 예매 가능",
      }),
    );

    const dialog = await screen.findByRole("dialog", {
      name: "출발지 미정 → 도착지 미정",
    });
    expect(dialog).toHaveAccessibleDescription(
      "이동 수단 미정 · 직통 · 소요 시간 미정",
    );
    expect(within(dialog).getByText("그룹 총액 0원")).toBeInTheDocument();
    expect(within(dialog).queryByText("가격 미정")).not.toBeInTheDocument();
    expect(within(dialog).getByText("확정 당시 snapshot")).toBeInTheDocument();
  });
});

describe("ItineraryPage Web/PWA and AIT shell ownership", () => {
  it("Web/PWA는 header를 소유하고 AIT는 native navigation 아래 web Mode Tab과 inset만 렌더링한다", async () => {
    const webView = renderTabShellPage();

    const webHeader = screen.getByRole("banner");
    expect(
      within(webHeader).getByRole("button", { name: "뒤로 가기" }),
    ).toBeInTheDocument();
    expect(within(webHeader).getByText("여행방")).toBeInTheDocument();
    expect(
      within(webHeader).getByRole("button", { name: "여행 초대 링크 공유" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "일정" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      screen.getByRole("heading", { level: 1, name: LONG_PLAN_TITLE }),
    ).toBeInTheDocument();

    webView.unmount();
    cleanup();

    const removeInsetListener = vi.fn();
    const nativeNavigation: PlatformNavigation = {
      contentTopInset: 58,
      subscribeContentTopInset: vi.fn(() => removeInsetListener),
      addAccessoryButton: vi.fn().mockResolvedValue(undefined),
      removeAccessoryButton: vi.fn(),
    };
    mocks.platform.navigation = nativeNavigation;
    renderTabShellPage();

    const aitHeader = screen.getByRole("banner");
    expect(aitHeader).toHaveStyle({ paddingTop: "58px" });
    expect(aitHeader.className).not.toContain("pt-(--safe-top)");
    expect(
      within(aitHeader).queryByRole("button", { name: "뒤로 가기" }),
    ).not.toBeInTheDocument();
    expect(within(aitHeader).queryByText("여행방")).not.toBeInTheDocument();
    expect(
      within(aitHeader).queryByRole("button", {
        name: "여행 초대 링크 공유",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("tablist", { name: "여행방 화면" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "일정" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      screen.getByRole("heading", { level: 1, name: LONG_PLAN_TITLE }),
    ).toBeInTheDocument();

    await waitFor(() =>
      expect(nativeNavigation.addAccessoryButton).toHaveBeenCalledTimes(1),
    );
  });
});
