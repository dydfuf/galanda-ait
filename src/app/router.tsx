import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AppRootLayout } from "./layouts/AppRootLayout.tsx";
import { GlobalShellLayout } from "./layouts/GlobalShellLayout.tsx";
import { TripRoomTabLayout } from "./layouts/TripRoomTabLayout.tsx";
import { TripRoomChildLayout } from "./layouts/TripRoomChildLayout.tsx";
import { SessionRoute } from "../features/auth/SessionRoute.tsx";
import { platformOnlyRoutes } from "../platform/index.ts";
import { PageState } from "@/components/galanda/page-state.tsx";

const HomePage = lazy(() =>
  import("../features/home/HomePage.tsx").then((m) => ({ default: m.HomePage })),
);
const ExplorePage = lazy(() =>
  import("../features/explore/ExplorePage.tsx").then((m) => ({ default: m.ExplorePage })),
);
const ExploreListingDetailPage = lazy(() =>
  import("../features/explore/ExploreListingDetailPage.tsx").then((m) => ({
    default: m.ExploreListingDetailPage,
  })),
);
const MePage = lazy(() =>
  import("../features/me/MePage.tsx").then((m) => ({ default: m.MePage })),
);
const SavedListingsPage = lazy(() =>
  import("../features/me/SavedListingsPage.tsx").then((m) => ({
    default: m.SavedListingsPage,
  })),
);
const TripListPage = lazy(() =>
  import("../features/trip-list/TripListPage.tsx").then((m) => ({ default: m.TripListPage })),
);
const TripCreatePage = lazy(() =>
  import("../features/trip-create/TripCreatePage.tsx").then((m) => ({ default: m.TripCreatePage })),
);
const TripCompanionSetupPage = lazy(() =>
  import("../features/trip-setup/TripCompanionSetupPage.tsx").then((m) => ({
    default: m.TripCompanionSetupPage,
  })),
);
const InvitePage = lazy(() =>
  import("../features/invite/InvitePage.tsx").then((m) => ({ default: m.InvitePage })),
);
const TripRoomEntry = lazy(() =>
  import("../features/trip-room/TripRoomEntry.tsx").then((m) => ({ default: m.TripRoomEntry })),
);
const PlanHomePage = lazy(() =>
  import("../features/plan-home/PlanHomePage.tsx").then((m) => ({ default: m.PlanHomePage })),
);
const PlanCreatePage = lazy(() =>
  import("../features/plan-editor/PlanCreatePage.tsx").then((m) => ({ default: m.PlanCreatePage })),
);
const PlanDetailPage = lazy(() =>
  import("../features/plan-detail/PlanDetailPage.tsx").then((m) => ({ default: m.PlanDetailPage })),
);
const PlanEditPage = lazy(() =>
  import("../features/plan-editor/PlanEditPage.tsx").then((m) => ({ default: m.PlanEditPage })),
);
const PlanComparePage = lazy(() =>
  import("../features/plan-compare/PlanComparePage.tsx").then((m) => ({ default: m.PlanComparePage })),
);
const ItineraryPage = lazy(() =>
  import("../features/itinerary/ItineraryPage.tsx").then((m) => ({ default: m.ItineraryPage })),
);
const ItineraryEditPage = lazy(() =>
  import("../features/itinerary/ItineraryEditPage.tsx").then((m) => ({ default: m.ItineraryEditPage })),
);
const NotFoundPage = lazy(() =>
  import("../pages/NotFoundPage.tsx").then((m) => ({ default: m.NotFoundPage })),
);
const LoginPage = lazy(() =>
  import("../features/auth/LoginPage.tsx").then((m) => ({ default: m.LoginPage })),
);

function RouteFallback() {
  return <PageState status="loading" message="화면을 불러오는 중이에요." />;
}

function withSuspense(element: React.ReactNode) {
  return <Suspense fallback={<RouteFallback />}>{element}</Suspense>;
}

export function AppRouter() {
  return (
    <Routes>
      <Route element={<AppRootLayout />}>
        {/* 루트 -> 홈 리다이렉트 */}
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/login" element={withSuspense(<LoginPage />)} />

        {/* 초대장 */}
        <Route path="/invites/:inviteToken" element={withSuspense(<InvitePage />)} />

        {/* 플랫폼 전용 라우트 (예: AIT 인앱 광고 디버그). Web 빌드에서는 비어 있어요. */}
        {platformOnlyRoutes.map(({ path, Component }) => (
          <Route key={path} path={path} element={<Component />} />
        ))}

        <Route element={<SessionRoute />}>
          {/*
            Global 탐색 shell을 함께 보여주는 destination surface.
            - /home, /explore, /me: honest destination
            - /trips: 내 여행 목록
            - /trips/:tripId(진입 리다이렉트), /trips/:tripId/{plans,itinerary}: 여행방 home surface
          */}
          <Route element={<GlobalShellLayout />}>
            <Route path="/home" element={withSuspense(<HomePage />)} />
            <Route path="/explore" element={withSuspense(<ExplorePage />)} />
            <Route path="/me" element={withSuspense(<MePage />)} />
            <Route path="/me/saved" element={withSuspense(<SavedListingsPage />)} />
            <Route path="/trips" element={withSuspense(<TripListPage />)} />

            {/* 여행방 진입 자동 리다이렉트 (미확정 -> plans / 확정 -> itinerary) */}
            <Route path="/trips/:tripId" element={withSuspense(<TripRoomEntry />)} />

            {/* 여행방 탭 레이아웃: 계획 탭 홈 및 일정 탭 홈 */}
            <Route path="/trips/:tripId" element={<TripRoomTabLayout />}>
              <Route path="plans" element={withSuspense(<PlanHomePage />)} />
              <Route path="itinerary" element={withSuspense(<ItineraryPage />)} />
            </Route>
          </Route>

          {/*
            focused surface: Global nav를 숨긴다.
            - /explore/:listingId: 공개 여행 일정 상세(RAON-263 DISC-5)
            - /trips/new: 여행 생성 (registered)
            - itinerary edit, plan create/detail/edit/compare
          */}
          <Route
            path="/explore/:listingId"
            element={withSuspense(<ExploreListingDetailPage />)}
          />

          <Route element={<SessionRoute registered />}>
            <Route path="/trips/new" element={withSuspense(<TripCreatePage />)} />
            <Route
              path="/trips/:tripId/setup/companions"
              element={withSuspense(<TripCompanionSetupPage />)}
            />
          </Route>

          <Route path="/trips/:tripId/itinerary/edit" element={<TripRoomChildLayout />}>
            <Route index element={withSuspense(<ItineraryEditPage />)} />
          </Route>

          {/* 여행방 서브페이지 레이아웃 (뒤로가기 헤더): 계획 생성, 상세, 편집, 비교 */}
          <Route path="/trips/:tripId/plans" element={<TripRoomChildLayout />}>
            <Route path="new" element={withSuspense(<PlanCreatePage />)} />
            <Route path="new/:section" element={withSuspense(<PlanCreatePage />)} />
            <Route path="compare" element={withSuspense(<PlanComparePage />)} />
            <Route path=":planId" element={withSuspense(<PlanDetailPage />)} />
            <Route path=":planId/edit" element={withSuspense(<PlanEditPage />)} />
            <Route path=":planId/edit/:section" element={withSuspense(<PlanEditPage />)} />
          </Route>
        </Route>

        {/* 404 Not Found */}
        <Route path="*" element={withSuspense(<NotFoundPage />)} />
      </Route>
    </Routes>
  );
}
