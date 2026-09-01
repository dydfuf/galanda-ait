/**
 * Global navigation contract (RAON-249 / Issue #96).
 *
 * 하단 Global 탐색 shell이 어떤 항목을 active로 그릴지 결정하는 **순수 resolver**다.
 * 여기에는 어떤 product query, session, platform 의존성도 없다. pathname 하나만
 * 입력으로 받아 shell이 노출되는 5개 exact route 중 해당하는 destination
 * (또는 그 외 화면이면 undefined)을 반환한다. UI는 이 결과를 semantic active(aria-current)로만 사용한다.
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
    return withoutQuery.replace(/\/+$/, "");
  }
  return withoutQuery;
};

/**
 * pathname → active Global destination.
 *
 * - `/home` -> HOME
 * - `/explore` -> EXPLORE
 * - `/trips` -> TRIPS
 * - `/me`, `/me/saved` -> ME
 * - 그 외(예: `/trips/:id`, `/trips/new`, `/login`, `/invites/...`)는
 *   Global shell을 그리지 않으므로 undefined다.
 */
export const resolveGlobalNavKey = (
  pathname: string,
): GlobalNavKey | undefined => {
  const path = normalize(pathname);

  if (path === "/home") return "HOME";
  if (path === "/explore") return "EXPLORE";
  if (path === "/trips") return "TRIPS";
  if (path === "/me" || path === "/me/saved") return "ME";

  return undefined;
};
