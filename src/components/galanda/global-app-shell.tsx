import type { CSSProperties, ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Compass, House, Luggage, UserRound } from "lucide-react";

import { cn } from "@/lib/utils";
import { OfflineStatusBanner } from "@/components/galanda/OfflineStatusBanner.tsx";
import {
  GLOBAL_NAV_ITEMS,
  resolveGlobalNavKey,
  type GlobalNavKey,
} from "@/app/routes/global-nav.ts";

/**
 * Global 탐색 shell (RAON-248 / Goal 13 DISC).
 *
 * domain-independent 하단 navigation이다. 어떤 product query, session, platform
 * SDK도 참조하지 않고 오직 현재 pathname으로 active destination을 결정한다. 4개
 * 목적지(홈/탐색/내 여행/마이)를 logical order로 렌더링하며, 각 항목은 실제 route로
 * 이동하는 native link다(버튼으로 route를 흉내내지 않는다).
 *
 * a11y 계약:
 * - `<nav aria-label>`로 landmark를 노출한다.
 * - active 항목은 semantic `aria-current="page"`로 표시한다(색만으로 구분하지 않음).
 * - 각 항목의 hit target은 >=44px(`--touch-target-min`)를 보장한다.
 * - focus-visible ring을 유지한다.
 * - 하단 safe-area(`--safe-bottom`)를 shell이 소유한다.
 *
 * 여백 소유권: Global nav가 viewport bottom과 safe-bottom의 owner다.
 * 본문 wrapper가 bar 높이(`--global-nav-height`)만큼 padding-bottom을 확보해
 * 콘텐츠가 가려지지 않게 한다.
 * Global route가 contextual fixed action(예: `/trips`의 새 여행 CTA)을 함께 가질 수 있으며,
 * 그런 action은 `--global-nav-height`만큼 nav 위로 offset한다.
 * `BottomAction`이 shell 안에 위치할 때 safe-bottom을 중복 소유하지 않도록
 * `--bottom-action-safe-bottom: 0px`를 사용한다.
 */

const NAV_ICONS: Record<GlobalNavKey, typeof House> = {
  HOME: House,
  EXPLORE: Compass,
  TRIPS: Luggage,
  ME: UserRound,
};

export interface GlobalAppShellProps {
  readonly children: ReactNode;
}

export function GlobalAppShell({ children }: GlobalAppShellProps) {
  const location = useLocation();
  const activeKey = resolveGlobalNavKey(location.pathname);
  const usesContentSurface = /^\/trips\/?$/.test(location.pathname);
  const shellStyle = {
    "--global-nav-height": "calc(64px + var(--safe-bottom))",
    // BottomAction이 nav 위에 놓일 때 safe-area는 nav만 소유한다.
    "--bottom-action-safe-bottom": "0px",
  } as CSSProperties;

  return (
    <div
      data-slot="global-app-shell"
      style={shellStyle}
      className="flex min-h-dvh flex-1 flex-col"
    >
      <OfflineStatusBanner />
      <div
        data-galanda-surface={usesContentSurface ? "content" : undefined}
        className="flex flex-1 flex-col pb-[var(--global-nav-height)]"
      >
        {children}
      </div>

      <nav
        aria-label="주요 화면"
        data-galanda-surface={usesContentSurface ? "content" : "chrome"}
        className="fixed inset-x-0 bottom-0 z-20 bg-background shadow-chrome pb-[var(--safe-bottom)]"
      >
        <ul className="mx-auto flex h-16 w-full max-w-(--content-max-width) items-stretch">
          {GLOBAL_NAV_ITEMS.map((item) => {
            const Icon = NAV_ICONS[item.key];
            const isActive = item.key === activeKey;
            return (
              <li key={item.key} className="flex min-w-0 flex-1">
                <Link
                  to={item.path}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex min-h-(--touch-target-min) w-full min-w-0 flex-col items-center justify-center gap-0.5 rounded-md px-1 py-1.5 text-xs leading-none font-medium transition-colors",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                    isActive
                      ? "text-primary"
                      : "text-foreground-muted hover:text-foreground",
                  )}
                >
                  <Icon
                    className="size-5 shrink-0"
                    aria-hidden="true"
                    strokeWidth={isActive ? 2.4 : 2}
                  />
                  <span className="min-w-0 [overflow-wrap:anywhere]">
                    {item.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
