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
import type { TripRoomViewModel } from "../plan-home/plan-home-view-model.ts";
import { useSessionQuery } from "../../hooks/useSession.ts";
import type { SavedListingItem } from "../../contracts/explore-save.ts";
import { HomePage } from "./HomePage.tsx";
import {
  getHomeTripDayLabel,
  selectHomeTrip,
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

const room: TripRoomViewModel = {
  id: "trip-italy",
  title: "이탈리아 남부 여행",
  destination: "이탈리아",
  displayStartDate: "2999-06-15",
  displayEndDate: "2999-06-23",
  period: "2999-06-15 ~ 2999-06-23",
  memberCount: 5,
  memberNames: "라온, 민지, 서준, 지수, 하늘",
  revision: 1,
  confirmedPlanId: "plan-1",
  confirmedPlanTitle: "남부 로드트립",
  decisionStatusText: "일정이 확정되었어요",
  decisionSubText: "확정된 일정을 확인해보세요.",
  decisionBadgeText: "확정됨",
  decisionBadgeVariant: "success",
  candidateCount: 2,
  totalOpinionCount: 6,
  participatedMemberCount: 4,
  isConfirmed: true,
  plans: [],
};

const sessionOk = () =>
  mockSession.mockReturnValue({
    data: {
      participantId: "participant-me",
      participantIds: ["participant-me"],
      accountType: "REGISTERED",
      name: "Raon",
      isAuthenticated: true,
    },
    isSuccess: true,
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useSessionQuery>);

const savedResult = (
  over: Partial<ReturnType<typeof useSavedListingsQuery>>,
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
    data: [room],
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
  expect(screen.getByText("안녕하세요, Raon 👋")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "이탈리아 남부 여행" })).toBeInTheDocument();
  expect(screen.getByRole("progressbar", { name: "여행안 의견 참여율" })).toHaveAttribute(
    "aria-valuenow",
    "80",
  );
  expect(screen.getByRole("link", { name: "여행 일정 열기" })).toHaveAttribute(
    "href",
    "/trips/trip-italy/itinerary",
  );
  expect(screen.getByRole("link", { name: "숙소 정보 열기" })).toHaveAttribute(
    "href",
    "/trips/trip-italy/itinerary",
  );
  expect(screen.getByText("지도").closest("span[aria-disabled='true']")).not.toBeNull();
};

beforeEach(() => {
  mockSession.mockReset();
  mockSaved.mockReset();
  mockRooms.mockReset();
  sessionOk();
  mockRooms.mockReturnValue(roomsResult());
});

describe("HomePage dashboard", () => {
  it("미확정 여행에서도 일정 quick action은 일정 route를 직접 가리킨다", () => {
    mockRooms.mockReturnValue(
      roomsResult({
        data: [
          {
            ...room,
            confirmedPlanId: undefined,
            confirmedPlanTitle: undefined,
            isConfirmed: false,
          },
        ],
      }),
    );
    mockSaved.mockReturnValue(
      savedResult({ data: { pages: [{ items: [] }], pageParams: [undefined] } }),
    );

    renderHome();

    expect(screen.getByRole("link", { name: "여행 일정 열기" })).toHaveAttribute(
      "href",
      "/trips/trip-italy/itinerary",
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
    expect(screen.getByRole("link", { name: "새 여행 만들기" })).toHaveAttribute(
      "href",
      "/trips/new",
    );
    expect(screen.getByRole("link", { name: "여행 탐색" })).toHaveAttribute(
      "href",
      "/explore",
    );
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
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

  it("legacy 의견의 참여 인원을 집계할 수 없으면 0%로 단정하지 않는다", () => {
    mockRooms.mockReturnValue(
      roomsResult({
        data: [{ ...room, totalOpinionCount: 2, participatedMemberCount: 0 }],
      }),
    );
    mockSaved.mockReturnValue(
      savedResult({ data: { pages: [{ items: [] }], pageParams: [undefined] } }),
    );
    renderHome();

    expect(screen.getByText("집계 전")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });
});

describe("Home trip date selection", () => {
  it("출발 전·당일·여행 중 D-day 경계를 local travel date로 계산한다", () => {
    expect(getHomeTripDayLabel("2026-09-01", "2026-09-05", "2026-08-30")).toBe("D-2");
    expect(getHomeTripDayLabel("2026-09-01", "2026-09-05", "2026-09-01")).toBe("D-Day");
    expect(getHomeTripDayLabel("2026-09-01", "2026-09-05", "2026-09-03")).toBe("여행 중");
    expect(getHomeTripDayLabel(undefined, undefined, "2026-09-03")).toBeUndefined();
  });

  it("종료된 여행을 제외하고 서버 순서의 첫 ongoing 여행을 선택한다", () => {
    const pastRoom = {
      ...room,
      id: "trip-past",
      displayStartDate: "2026-08-01",
      displayEndDate: "2026-08-03",
    };
    const ongoingRoom = {
      ...room,
      id: "trip-ongoing",
      displayStartDate: "2026-09-01",
      displayEndDate: "2026-09-05",
    };

    expect(selectHomeTrip([pastRoom, ongoingRoom], "2026-08-30")?.id).toBe(
      "trip-ongoing",
    );
  });
});
