// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Outlet } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: {
    data: {
      participantId: "user-1",
      participantIds: ["user-1"],
      accountType: "REGISTERED",
      name: "테스터",
      isAuthenticated: true,
    },
    isSuccess: true,
    isPending: false,
    isError: false,
    error: null as Error | null,
    refetch: vi.fn<() => Promise<unknown>>(),
  },
  platformOnlyRoutes: [
    {
      path: "/platform-only-test",
      Component: () => <div data-testid="route-platform-only">플랫폼 전용 화면</div>,
    },
  ],
}));

vi.mock("@/hooks/useSession.ts", () => ({
  useSessionQuery: () => mocks.session,
}));

vi.mock("../platform/index.ts", () => ({
  platformOnlyRoutes: mocks.platformOnlyRoutes,
  platform: {
    name: "web",
    signIn: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    share: vi.fn<() => Promise<string>>().mockResolvedValue("shared"),
    openExternalUrl: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    requestClose: vi.fn<() => Promise<boolean>>().mockResolvedValue(false),
    navigation: undefined,
  },
}));

// Mock lazy page components with simple test markers
vi.mock("../features/home/HomePage.tsx", () => ({
  HomePage: () => <div data-testid="route-home">홈 화면</div>,
}));
vi.mock("../features/explore/ExplorePage.tsx", () => ({
  ExplorePage: () => <div data-testid="route-explore">탐색 화면</div>,
}));
vi.mock("../features/explore/ExploreListingDetailPage.tsx", () => ({
  ExploreListingDetailPage: () => (
    <div data-testid="route-explore-detail">탐색 상세 화면</div>
  ),
}));
vi.mock("../features/me/MePage.tsx", () => ({
  MePage: () => <div data-testid="route-me">마이 화면</div>,
}));
vi.mock("../features/me/SavedListingsPage.tsx", () => ({
  SavedListingsPage: () => (
    <div data-testid="route-me-saved">저장 목록 화면</div>
  ),
}));
vi.mock("../features/trip-list/TripListPage.tsx", () => ({
  TripListPage: () => <div data-testid="route-trips">여행 목록 화면</div>,
}));
vi.mock("../features/trip-create/TripCreatePage.tsx", () => ({
  TripCreatePage: () => (
    <div data-testid="route-trip-create">새 여행 만들기 화면</div>
  ),
}));
vi.mock("../features/trip-setup/TripCompanionSetupPage.tsx", () => ({
  TripCompanionSetupPage: () => (
    <div data-testid="route-companion-setup">동행자 설정 화면</div>
  ),
}));
vi.mock("../features/invite/InvitePage.tsx", () => ({
  InvitePage: () => <div data-testid="route-invite">초대 화면</div>,
}));
vi.mock("../features/trip-room/TripRoomEntry.tsx", () => ({
  TripRoomEntry: () => (
    <div data-testid="route-trip-entry">여행방 진입 화면</div>
  ),
}));
vi.mock("../features/plan-home/PlanHomePage.tsx", () => ({
  PlanHomePage: () => <div data-testid="route-plan-home">계획 홈 화면</div>,
}));
vi.mock("../features/plan-editor/PlanCreatePage.tsx", () => ({
  PlanCreatePage: () => (
    <div data-testid="route-plan-create">계획 작성 화면</div>
  ),
}));
vi.mock("../features/plan-detail/PlanDetailPage.tsx", () => ({
  PlanDetailPage: () => (
    <div data-testid="route-plan-detail">계획 상세 화면</div>
  ),
}));
vi.mock("../features/plan-editor/PlanEditPage.tsx", () => ({
  PlanEditPage: () => <div data-testid="route-plan-edit">계획 수정 화면</div>,
}));
vi.mock("../features/plan-compare/PlanComparePage.tsx", () => ({
  PlanComparePage: () => (
    <div data-testid="route-plan-compare">계획 비교 화면</div>
  ),
}));
vi.mock("../features/itinerary/ItineraryPage.tsx", () => ({
  ItineraryPage: () => <div data-testid="route-itinerary">일정 화면</div>,
}));
vi.mock("../features/itinerary/ItineraryEditPage.tsx", () => ({
  ItineraryEditPage: () => (
    <div data-testid="route-itinerary-edit">일정 편집 화면</div>
  ),
}));
vi.mock("../features/auth/LoginPage.tsx", () => ({
  LoginPage: () => <div data-testid="route-login">로그인 화면</div>,
}));
vi.mock("../pages/NotFoundPage.tsx", () => ({
  NotFoundPage: () => <div data-testid="route-not-found">404 화면</div>,
}));

// Mock TripRoom layouts as passthroughs to focus on router shell topology
vi.mock("./layouts/TripRoomTabLayout.tsx", () => ({
  TripRoomTabLayout: () => (
    <div data-testid="trip-room-tab-layout">
      <Outlet />
    </div>
  ),
}));
vi.mock("./layouts/TripRoomChildLayout.tsx", () => ({
  TripRoomChildLayout: () => (
    <div data-testid="trip-room-child-layout">
      <Outlet />
    </div>
  ),
}));

import { AppRouter } from "./router.tsx";

const renderApp = (initialEntry = "/home") =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <AppRouter />
    </MemoryRouter>,
  );

describe("AppRouter shell layout topology (Issue #96)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.session = {
      data: {
        participantId: "user-1",
        participantIds: ["user-1"],
        accountType: "REGISTERED",
        name: "테스터",
        isAuthenticated: true,
      },
      isSuccess: true,
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn<() => Promise<unknown>>(),
    };
  });

  describe("Global nav 표시 매트릭스", () => {
    it.each([
      { path: "/home", testId: "route-home", activeHref: "/home" },
      { path: "/home/", testId: "route-home", activeHref: "/home" },
      { path: "/HOME", testId: "route-home", activeHref: "/home" },
      { path: "/explore?query=제주", testId: "route-explore", activeHref: "/explore" },
      { path: "/EXPLORE?query=제주", testId: "route-explore", activeHref: "/explore" },
      { path: "/trips", testId: "route-trips", activeHref: "/trips" },
      { path: "/TRIPS", testId: "route-trips", activeHref: "/trips" },
      { path: "/me", testId: "route-me", activeHref: "/me" },
      { path: "/ME", testId: "route-me", activeHref: "/me" },
      { path: "/me/saved", testId: "route-me-saved", activeHref: "/me" },
      { path: "/ME/SAVED", testId: "route-me-saved", activeHref: "/me" },
    ])("$path 에서는 marker($testId)와 $activeHref active Global nav가 렌더된다", async ({
      path,
      testId,
      activeHref,
    }) => {
      renderApp(path);

      expect(await screen.findByTestId(testId)).toBeInTheDocument();

      const nav = screen.getByRole("navigation", { name: "주요 화면" });
      const links = within(nav).getAllByRole("link");
      expect(links).toHaveLength(4);

      const activeLinks = links.filter(
        (link) => link.getAttribute("aria-current") === "page",
      );
      expect(activeLinks).toHaveLength(1);
      expect(activeLinks[0]?.getAttribute("href")).toBe(activeHref);
    });
  });

  describe("Global nav 숨김 매트릭스", () => {
    it.each([
      { path: "/trips/trip-1", testId: "route-trip-entry" },
      { path: "/trips/trip-1/plans", testId: "route-plan-home" },
      { path: "/trips/trip-1/itinerary", testId: "route-itinerary" },
      { path: "/explore/listing-1", testId: "route-explore-detail" },
      { path: "/trips/new", testId: "route-trip-create" },
      { path: "/trips/:tripId/setup/companions", testId: "route-companion-setup" },
      { path: "/trips/trip-1/plans/new", testId: "route-plan-create" },
      { path: "/trips/trip-1/plans/new/basic", testId: "route-plan-create" },
      { path: "/trips/trip-1/plans/compare", testId: "route-plan-compare" },
      { path: "/trips/trip-1/plans/plan-1", testId: "route-plan-detail" },
      { path: "/trips/trip-1/plans/plan-1/edit", testId: "route-plan-edit" },
      { path: "/trips/trip-1/plans/plan-1/edit/basic", testId: "route-plan-edit" },
      { path: "/trips/trip-1/itinerary/edit", testId: "route-itinerary-edit" },
      { path: "/login", testId: "route-login" },
      { path: "/invites/invite-token", testId: "route-invite" },
      { path: "/platform-only-test", testId: "route-platform-only" },
      { path: "/not-a-real-route", testId: "route-not-found" },
    ])("$path 에서는 marker($testId)가 렌더되고 Global nav가 없다", async ({
      path,
      testId,
    }) => {
      renderApp(path);

      expect(await screen.findByTestId(testId)).toBeInTheDocument();
      expect(
        screen.queryByRole("navigation", { name: "주요 화면" }),
      ).not.toBeInTheDocument();
    });
  });

  describe("루트(/) 및 보호 라우트 인증 진입 흐름", () => {
    it("인증된 사용자 진입 시 /home 으로 replace되고 Global nav가 보인다", async () => {
      renderApp("/");

      expect(await screen.findByTestId("route-home")).toBeInTheDocument();
      const nav = screen.getByRole("navigation", { name: "주요 화면" });
      const current = within(nav)
        .getAllByRole("link")
        .filter((link) => link.getAttribute("aria-current") === "page");
      expect(current).toHaveLength(1);
      expect(current[0]?.getAttribute("href")).toBe("/home");
    });

    it("미인증 사용자 진입 시 /login 으로 이동하고 Global nav가 없다", async () => {
      mocks.session = {
        data: null as unknown as typeof mocks.session.data,
        isSuccess: false,
        isPending: false,
        isError: false,
        error: null,
        refetch: vi.fn<() => Promise<unknown>>(),
      };

      renderApp("/");

      expect(await screen.findByTestId("route-login")).toBeInTheDocument();
      expect(
        screen.queryByRole("navigation", { name: "주요 화면" }),
      ).not.toBeInTheDocument();
    });

    it("미인증 사용자가 Trip Room에 직접 진입하면 로그인으로 이동한다", async () => {
      mocks.session = {
        data: null as unknown as typeof mocks.session.data,
        isSuccess: false,
        isPending: false,
        isError: false,
        error: null,
        refetch: vi.fn<() => Promise<unknown>>(),
      };

      renderApp("/trips/trip-1/plans");

      expect(await screen.findByTestId("route-login")).toBeInTheDocument();
      expect(screen.queryByTestId("route-plan-home")).not.toBeInTheDocument();
      expect(
        screen.queryByRole("navigation", { name: "주요 화면" }),
      ).not.toBeInTheDocument();
    });

    it("미등록(게스트) 사용자는 /trips/new 및 동행자 설정에 진입할 수 없다", async () => {
      mocks.session = {
        data: {
          participantId: "guest-1",
          participantIds: ["guest-1"],
          accountType: "GUEST",
          name: "게스트",
          isAuthenticated: true,
        },
        isSuccess: true,
        isPending: false,
        isError: false,
        error: null,
        refetch: vi.fn<() => Promise<unknown>>(),
      };

      renderApp("/trips/new");

      expect(await screen.findByTestId("route-login")).toBeInTheDocument();
      expect(screen.queryByTestId("route-trip-create")).not.toBeInTheDocument();
    });

    it("세션 로딩 중에는 Global nav가 없다", async () => {
      mocks.session = {
        data: null as unknown as typeof mocks.session.data,
        isSuccess: false,
        isPending: true,
        isError: false,
        error: null,
        refetch: vi.fn<() => Promise<unknown>>(),
      };

      renderApp("/");

      expect(
        await screen.findByText("로그인 정보를 확인하는 중이에요."),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("navigation", { name: "주요 화면" }),
      ).not.toBeInTheDocument();
    });

    it("세션 에러 시에는 Global nav가 없다", async () => {
      mocks.session = {
        data: null as unknown as typeof mocks.session.data,
        isSuccess: false,
        isPending: false,
        isError: true,
        error: new Error("session failed"),
        refetch: vi.fn<() => Promise<unknown>>(),
      };

      renderApp("/");

      expect(
        await screen.findByText("로그인 정보를 확인할 수 없어요"),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("navigation", { name: "주요 화면" }),
      ).not.toBeInTheDocument();
    });
  });

  describe("Global link 네비게이션 동작", () => {
    it("Home에서 각 목적지 link를 클릭했을 때 올바른 marker와 active 상태로 갱신된다", async () => {
      renderApp("/home");

      expect(await screen.findByTestId("route-home")).toBeInTheDocument();
      const nav = screen.getByRole("navigation", { name: "주요 화면" });

      const exploreLink = within(nav).getByRole("link", { name: "탐색" });
      fireEvent.click(exploreLink);
      expect(await screen.findByTestId("route-explore")).toBeInTheDocument();
      expect(exploreLink).toHaveAttribute("aria-current", "page");

      const tripsLink = within(nav).getByRole("link", { name: "내 여행" });
      fireEvent.click(tripsLink);
      expect(await screen.findByTestId("route-trips")).toBeInTheDocument();
      expect(tripsLink).toHaveAttribute("aria-current", "page");

      const meLink = within(nav).getByRole("link", { name: "마이" });
      fireEvent.click(meLink);
      expect(await screen.findByTestId("route-me")).toBeInTheDocument();
      expect(meLink).toHaveAttribute("aria-current", "page");

      const homeLink = within(nav).getByRole("link", { name: "홈" });
      fireEvent.click(homeLink);
      expect(await screen.findByTestId("route-home")).toBeInTheDocument();
      expect(homeLink).toHaveAttribute("aria-current", "page");
    });
  });
});
