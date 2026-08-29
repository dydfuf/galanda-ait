/**
 * Global navigation contract (RAON-249 / Goal 13 DISC route).
 *
 * 하단 Global 탐색 shell이 어떤 항목을 active로 그릴지 결정하는 **순수 resolver**다.
 * 여기에는 어떤 product query, session, platform 의존성도 없다. pathname 하나만
 * 입력으로 받아 4개 destination 중 하나(또는 destination이 없으면 undefined)를
 * 반환한다. UI는 이 결과를 semantic active(aria-current)로만 사용한다.
 */

export type GlobalNavKey = "HOME" | "EXPLORE" | "TRIPS" | "ME";

export interface GlobalNavItem {
  readonly key: GlobalNavKey;
  readonly label: string;
  readonly path: string;
}

/**
 * Global 탐색 목적지. logical order(홈 → 탐색 → 내 여행 → 마이)로 고정한다.
 * label/icon은 UI(GlobalAppShell)가 소유하고, 여기서는 label/path 계약만 둔다.
 */
export const GLOBAL_NAV_ITEMS: ReadonlyArray<GlobalNavItem> = [
  { key: "HOME", label: "홈", path: "/home" },
  { key: "EXPLORE", label: "탐색", path: "/explore" },
  { key: "TRIPS", label: "내 여행", path: "/trips" },
  { key: "ME", label: "마이", path: "/me" },
];

const normalize = (pathname: string): string => {
  if (!pathname) return "/";
  // 쿼리/해시는 이미 분리되어 들어오지만, 방어적으로 잘라낸다.
  const withoutQuery = pathname.split(/[?#]/, 1)[0] ?? pathname;
  if (withoutQuery.length > 1 && withoutQuery.endsWith("/")) {
    return withoutQuery.slice(0, -1);
  }
  return withoutQuery;
};

/**
 * pathname → active Global destination.
 *
 * - `/home` (및 하위)는 HOME.
 * - `/explore` (및 하위)는 EXPLORE.
 * - **모든 `/trips/**`는 TRIPS로 active**. Trip room의 `/plans`·`/itinerary`
 *   home surface, `/trips/new`, plan create/detail/edit/compare, itinerary edit
 *   같은 하위 화면도 전부 "내 여행" 맥락이므로 TRIPS로 묶는다.
 * - `/me` (및 하위)는 ME.
 * - 그 외(예: `/login`, `/invites/...`)는 어떤 Global 목적지에도 속하지 않으므로
 *   undefined다(shell 자체를 렌더링하지 않는 화면).
 */
export const resolveGlobalNavKey = (
  pathname: string
): GlobalNavKey | undefined => {
  const path = normalize(pathname);

  if (path === "/home" || path.startsWith("/home/")) return "HOME";
  if (path === "/explore" || path.startsWith("/explore/")) return "EXPLORE";
  if (path === "/trips" || path.startsWith("/trips/")) return "TRIPS";
  if (path === "/me" || path.startsWith("/me/")) return "ME";

  return undefined;
};
