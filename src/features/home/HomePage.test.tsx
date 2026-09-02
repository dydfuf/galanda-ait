// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("../explore/save-queries.ts", () => ({
  useSavedListingsQuery: vi.fn(),
  SAVED_FEED_PAGE_SIZE: 20,
}));
vi.mock("../plan-home/queries.ts", () => ({
  useTripRoomsQuery: vi.fn(),
}));
vi.mock("../../hooks/useSession.ts", () => ({
  useSessionQuery: vi.fn(),
}));

import { useSavedListingsQuery } from "../explore/save-queries.ts";
import { useTripRoomsQuery } from "../plan-home/queries.ts";
import type { TripOverviewDto } from "../../contracts/trip-overview.ts";
import { useSessionQuery } from "../../hooks/useSession.ts";
import type { SavedListingItem } from "../../contracts/explore-save.ts";
import { HomePage } from "./HomePage.tsx";
import {
  getHomeTripDayLabel,
  selectFeaturedTrip,
} from "./components/HomeTripDashboard.tsx";

const mockSaved = vi.mocked(useSavedListingsQuery);
const mockRooms = vi.mocked(useTripRoomsQuery);
const mockSession = vi.mocked(useSessionQuery);

const savedItem = (id: string, title: string): SavedListingItem => ({
  savedAt: "2026-09-06T00:00:00.000Z",
  listing: {
    listingId: id as SavedListingItem["listing"]["listingId"],
    status: "LISTED",
    listingRevision: 1 as SavedListingItem["listing"]["listingRevision"],
    saveCount: 0,
    listedAt: "2026-09-05T00:00:00.000Z",
    updatedAt: "2026-09-05T00:00:00.000Z",
    snapshot: {
      title,
      destination: "교토",
      routes: [
        { city: "교토", arrivalDate: "2026-09-01", departureDate: "2026-09-04" },
      ],
      dateRange: {
        startDate: "2026-09-01",
        endDate: "2026-09-04",
        nightCount: 3,
      },
      stays: [],
      transports: [],
      author: { displayName: "여행자A" },
      sourcePlanRevision:
        3 as SavedListingItem["listing"]["snapshot"]["sourcePlanRevision"],
    },
  },
});

const confirmedTrip: TripOverviewDto = {
  id: "trip-italy",
  title: "이탈리아 남부 여행",
  destination: "이탈리아",
  revision: 1,
  isConfirmed: true,
  confirmedPeriod: {
    startDate: "2999-06-15",
    endDate: "2999-06-23",
  },
  memberCount: 5,
  memberNames: ["라온", "민지", "서준", "지수", "하늘"],
  candidateCount: 2,
  opinionParticipantCount: 4,
  hasUnattributedOpinions: false,
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-05T00:00:00.000Z",
  eligibleActionIds: ["EDIT_PLAN_BASIC"],
};

const sessionOk = (name = "Raon") =>
  mockSession.mockReturnValue({
    data: {
      participantId: "participant-me",
      participantIds: ["participant-me"],
      accountType: "REGISTERED",
      name,
      isAuthenticated: true,
    },
    isSuccess: true,
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useSessionQuery>);

const savedResult = (
  over: Partial<ReturnType<typeof useSavedListingsQuery>> = {},
) =>
  ({
    data: undefined,
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    isFetchNextPageError: false,
    ...over,
  }) as unknown as ReturnType<typeof useSavedListingsQuery>;

const roomsResult = (
  over: Partial<ReturnType<typeof useTripRoomsQuery>> = {},
) =>
  ({
    data: [confirmedTrip],
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    ...over,
  }) as unknown as ReturnType<typeof useTripRoomsQuery>;

const renderHome = () =>
  render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>,
  );

const expectDashboard = () => {
  expect(screen.getByRole("heading", { name: "홈" })).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "알림 기능 준비 중" }),
  ).not.toBeInTheDocument();
  expect(screen.getByText("Raon님, 안녕하세요 👋")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "이탈리아 남부 여행" })).toBeInTheDocument();
  expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: /일정 보기/ })).toHaveAttribute(
    "href",
    "/trips/trip-italy/itinerary",
  );
  expect(screen.getByRole("link", { name: /계획 보기/ })).toHaveAttribute(
    "href",
    "/trips/trip-italy/plans",
  );
};

beforeEach(() => {
  mockSession.mockReset();
  mockSaved.mockReset();
  mockRooms.mockReset();
  sessionOk();
  mockRooms.mockReturnValue(roomsResult());
});

describe("HomePage dashboard", () => {
  it("계획 중인 여행에서는 계획 보기 및 비교 액션을 제공한다", () => {
    mockRooms.mockReturnValue(
      roomsResult({
        data: [
          {
            ...confirmedTrip,
            isConfirmed: false,
            confirmedPeriod: null,
            candidateCount: 3,
            opinionParticipantCount: 2,
            eligibleActionIds: ["COMPARE_PLANS", "EDIT_PLAN_BASIC"],
          },
        ],
      }),
    );
    mockSaved.mockReturnValue(
      savedResult({ data: { pages: [{ items: [] }], pageParams: [undefined] } }),
    );

    renderHome();

    expect(screen.getByRole("link", { name: /계획 보기/ })).toHaveAttribute(
      "href",
      "/trips/trip-italy/plans",
    );
    expect(screen.getByRole("link", { name: /여행안 비교/ })).toHaveAttribute(
      "href",
      "/trips/trip-italy/plans/compare",
    );
  });

  it("저장 section이 오류여도 여행 dashboard 핵심 콘텐츠를 유지한다", () => {
    mockSaved.mockReturnValue(
      savedResult({ isError: true, error: new Error("boom") }),
    );
    renderHome();
    expectDashboard();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("저장 section이 로딩 중이어도 여행 dashboard 핵심 콘텐츠를 막지 않는다", () => {
    mockSaved.mockReturnValue(savedResult({ isPending: true }));
    renderHome();
    expectDashboard();
    expect(
      screen.getByText(/저장한 여행 아이디어를 불러오는 중이에요/),
    ).toBeInTheDocument();
  });

  it("저장 항목이 있으면 실제 공개 필드 기반 아이디어를 함께 보여준다", () => {
    mockSaved.mockReturnValue(
      savedResult({
        data: {
          pages: [{ items: [savedItem("listing-1", "교토 벚꽃 여행")] }],
          pageParams: [undefined],
        },
      }),
    );
    renderHome();
    expectDashboard();
    expect(
      screen.getByRole("heading", { name: "저장한 여행 아이디어" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "교토 벚꽃 여행" }),
    ).toHaveAttribute("href", "/explore/listing-1");
  });

  it("진행 중인 여행이 없으면 가짜 카드를 만들지 않고 실제 생성/탐색 route를 안내한다", () => {
    mockRooms.mockReturnValue(roomsResult({ data: [] }));
    mockSaved.mockReturnValue(
      savedResult({ data: { pages: [{ items: [] }], pageParams: [undefined] } }),
    );
    renderHome();

    expect(screen.getByText("진행 중인 여행이 없어요.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /새 여행 만들기/ })).toHaveAttribute(
      "href",
      "/trips/new",
    );
    expect(screen.getByRole("link", { name: /여행 탐색/ })).toHaveAttribute(
      "href",
      "/explore",
    );
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("과거 여행만 있을 때 전용 다음 여행 안내 카드를 표시한다", () => {
    mockRooms.mockReturnValue(
      roomsResult({
        data: [
          {
            ...confirmedTrip,
            confirmedPeriod: { startDate: "2020-01-01", endDate: "2020-01-05" },
          },
        ],
      }),
    );
    mockSaved.mockReturnValue(
      savedResult({ data: { pages: [{ items: [] }], pageParams: [undefined] } }),
    );
    renderHome();

    expect(screen.getByText("다음 여행을 준비해 보세요")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /내 여행 보기/ })).toHaveAttribute(
      "href",
      "/trips",
    );
    expect(screen.getByRole("link", { name: /새 여행 만들기/ })).toHaveAttribute(
      "href",
      "/trips/new",
    );
  });

  it("캐시된 여행을 유지할 때 최신 조회 실패를 밝히고 재시도한다", () => {
    const refetch = vi.fn();
    mockRooms.mockReturnValue(
      roomsResult({ isError: true, error: new Error("offline"), refetch }),
    );
    mockSaved.mockReturnValue(
      savedResult({ data: { pages: [{ items: [] }], pageParams: [undefined] } }),
    );
    renderHome();

    expectDashboard();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "표시된 내용은 이전에 불러온 정보예요",
    );
    screen.getByRole("button", { name: "여행 정보 다시 확인" }).click();
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("legacy 의견이 섞여 참여 인원을 완전히 집계할 수 없으면 안내 문구를 표시한다", () => {
    mockRooms.mockReturnValue(
      roomsResult({
        data: [
          {
            ...confirmedTrip,
            isConfirmed: false,
            confirmedPeriod: null,
            candidateCount: 2,
            opinionParticipantCount: 1,
            hasUnattributedOpinions: true,
          },
        ],
      }),
    );
    mockSaved.mockReturnValue(
      savedResult({ data: { pages: [{ items: [] }], pageParams: [undefined] } }),
    );
    renderHome();

    expect(
      screen.getByText("일부 기존 의견의 참여자를 확인할 수 없어요"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("사용자 이름이 없으면 가짜 이름을 사용하지 않고 일반 인사말을 표시한다", () => {
    sessionOk("");
    mockRooms.mockReturnValue(roomsResult({ data: [] }));
    mockSaved.mockReturnValue(
      savedResult({ data: { pages: [{ items: [] }], pageParams: [undefined] } }),
    );
    renderHome();

    expect(screen.getByText("안녕하세요 👋")).toBeInTheDocument();
    expect(screen.queryByText(/여행자님/)).not.toBeInTheDocument();
  });
});

describe("Home trip date and selection helpers", () => {
  it("출발 전·당일·여행 중 D-day 경계를 계산한다", () => {
    const tripWithDates = (start: string, end: string): TripOverviewDto => ({
      ...confirmedTrip,
      confirmedPeriod: { startDate: start, endDate: end },
    });

    expect(
      getHomeTripDayLabel(tripWithDates("2026-09-01", "2026-09-05"), "2026-08-30").label,
    ).toBe("D-2");
    expect(
      getHomeTripDayLabel(tripWithDates("2026-09-01", "2026-09-05"), "2026-09-01").label,
    ).toBe("D-Day");
    expect(
      getHomeTripDayLabel(tripWithDates("2026-09-01", "2026-09-05"), "2026-09-03").label,
    ).toBe("여행 중");
  });

  it("종료된 여행을 제외하고 결정론적으로 ongoing 여행을 선택한다", () => {
    const pastTrip: TripOverviewDto = {
      ...confirmedTrip,
      id: "trip-past",
      confirmedPeriod: { startDate: "2026-08-01", endDate: "2026-08-03" },
    };
    const ongoingTrip: TripOverviewDto = {
      ...confirmedTrip,
      id: "trip-ongoing",
      confirmedPeriod: { startDate: "2026-09-01", endDate: "2026-09-05" },
    };

    expect(
      selectFeaturedTrip([pastTrip, ongoingTrip], "2026-08-30").featured?.id,
    ).toBe("trip-ongoing");
  });
});
