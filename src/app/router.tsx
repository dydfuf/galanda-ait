import { Routes, Route, Navigate } from "react-router-dom";
import { AppRootLayout } from "./layouts/AppRootLayout.tsx";
import { TripRoomTabLayout } from "./layouts/TripRoomTabLayout.tsx";
import { TripRoomChildLayout } from "./layouts/TripRoomChildLayout.tsx";

import { TripListPage } from "../features/trip-list/TripListPage.tsx";
import { TripCreatePage } from "../features/trip-create/TripCreatePage.tsx";
import { InvitePage } from "../features/invite/InvitePage.tsx";
import { TripRoomEntry } from "../features/trip-room/TripRoomEntry.tsx";
import { PlanHomePage } from "../features/plan-home/PlanHomePage.tsx";
import { PlanCreatePage } from "../features/plan-editor/PlanCreatePage.tsx";
import { PlanDetailPage } from "../features/plan-detail/PlanDetailPage.tsx";
import { PlanEditPage } from "../features/plan-editor/PlanEditPage.tsx";
import { PlanComparePage } from "../features/plan-compare/PlanComparePage.tsx";
import { ItineraryPage } from "../features/itinerary/ItineraryPage.tsx";
import { NotFoundPage } from "../pages/NotFoundPage.tsx";
import { InAppAdsPage } from "../pages/InAppAdsPage.tsx";

export function AppRouter() {
  return (
    <Routes>
      <Route element={<AppRootLayout />}>
        {/* 루트 -> 여행 목록 리다이렉트 */}
        <Route path="/" element={<Navigate to="/trips" replace />} />

        {/* 여행 목록 및 생성 */}
        <Route path="/trips" element={<TripListPage />} />
        <Route path="/trips/new" element={<TripCreatePage />} />

        {/* 초대장 */}
        <Route path="/invites/:inviteToken" element={<InvitePage />} />

        {/* 인앱 광고 테스트 (개발/디버그) */}
        <Route path="/iaa" element={<InAppAdsPage />} />

        {/* 여행방 진입 자동 리다이렉트 (미확정 -> plans / 확정 -> itinerary) */}
        <Route path="/trips/:tripId" element={<TripRoomEntry />} />

        {/* 여행방 탭 레이아웃: 계획 탭 홈 및 일정 탭 홈 */}
        <Route path="/trips/:tripId" element={<TripRoomTabLayout />}>
          <Route path="plans" element={<PlanHomePage />} />
          <Route path="itinerary" element={<ItineraryPage />} />
        </Route>

        {/* 여행방 서브페이지 레이아웃 (뒤로가기 헤더): 계획 생성, 상세, 편집, 비교 */}
        <Route path="/trips/:tripId/plans" element={<TripRoomChildLayout />}>
          <Route path="new" element={<PlanCreatePage />} />
          <Route path="compare" element={<PlanComparePage />} />
          <Route path=":planId" element={<PlanDetailPage />} />
          <Route path=":planId/edit" element={<PlanEditPage />} />
        </Route>

        {/* 404 Not Found */}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
