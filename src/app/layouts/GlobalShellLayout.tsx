import { Outlet } from "react-router-dom";

import { GlobalAppShell } from "@/components/galanda/global-app-shell.tsx";

/**
 * Global shell layout (Issue #96 / Global IA).
 *
 * Global 탐색 nav를 함께 보여주는 destination surface만 감싼다: `/home`, `/explore`,
 * `/trips` 목록, `/me`, `/me/saved`.
 * Trip room 진입(`/trips/:id`), Trip room home surface(`/trips/:id/plans`,
 * `/trips/:id/itinerary`), focused 화면(plan create/detail/edit/compare, itinerary
 * edit, `/trips/new`, `/explore/:listingId`)은 이 layout 밖에 두어 nav가 숨겨진다.
 * nav의 표시 여부는 이 layout의 route 중첩으로 결정된다.
 */
export function GlobalShellLayout() {
  return (
    <GlobalAppShell>
      <Outlet />
    </GlobalAppShell>
  );
}
