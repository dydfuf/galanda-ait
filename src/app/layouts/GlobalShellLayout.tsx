import { Outlet } from "react-router-dom";

import { GlobalAppShell } from "@/components/galanda/global-app-shell.tsx";

/**
 * Global shell layout (RAON-249 route nesting).
 *
 * Global 탐색 nav를 함께 보여주는 destination surface를 감싼다: `/home`, `/explore`,
 * `/trips` 목록, `/me`, 그리고 Trip room의 home surface(`/trips/:id/plans`,
 * `/trips/:id/itinerary`). focused 화면(plan create/detail/edit/compare, itinerary
 * edit, `/trips/new`)은 이 layout 밖에 두어 nav가 숨겨진다.
 */
export function GlobalShellLayout() {
  return (
    <GlobalAppShell>
      <Outlet />
    </GlobalAppShell>
  );
}
