import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PageHeaderBack {
  readonly onClick: () => void;
  readonly label?: string;
}

interface PageHeaderProps {
  readonly title?: ReactNode;
  readonly center?: ReactNode;
  readonly back?: PageHeaderBack;
  readonly action?: ReactNode;
  /** 스크롤 시 상단에 고정할지 여부. 내부 고정값이 아니라 화면이 명시적으로 선택해요. */
  readonly sticky?: boolean;
  readonly bordered?: boolean;
  readonly safeTop?: boolean;
  readonly topInset?: number;
  readonly className?: string;
}

/**
 * 일반 Web/PWA 화면의 상단 내비게이션 shell이에요.
 * back/title/action만 담당하고, 플랫폼(AIT) SDK는 알지 못해요.
 */
export function PageHeader({
  title,
  center,
  back,
  action,
  sticky = false,
  bordered = false,
  safeTop = true,
  topInset,
  className,
}: PageHeaderProps) {
  return (
    <header
      data-galanda-surface="chrome"
      style={topInset === undefined ? undefined : { paddingTop: topInset }}
      className={cn(
        "w-full",
        // 명시적인 native inset이 있으면 Web safe-area를 더하지 않아요.
        safeTop && topInset === undefined && "pt-(--safe-top)",
        sticky && "sticky top-0 z-20",
        (bordered || sticky) && "border-b",
        className,
      )}
    >
      <div className="mx-auto grid h-14 w-full max-w-(--content-max-width) grid-cols-[minmax(var(--touch-target-min),1fr)_minmax(0,auto)_minmax(var(--touch-target-min),1fr)] items-center px-2">
        <div className="flex min-w-(--touch-target-min) justify-start">
          {back && (
            <Button
              type="button"
              variant="ghost"
              size="icon-lg"
              aria-label={back.label ?? "뒤로 가기"}
              onClick={back.onClick}
            >
              <ChevronLeft className="size-6" />
            </Button>
          )}
        </div>
        {/* 화면의 시맨틱 h1은 본문이 소유하므로 bar 제목은 heading이 아니에요. */}
        {center ? (
          <div className="min-w-0 px-1">{center}</div>
        ) : (
          <div className="min-w-0 truncate px-1 text-center text-base font-semibold text-foreground">
            {title}
          </div>
        )}
        <div className="flex min-w-(--touch-target-min) justify-end">
          {action}
        </div>
      </div>
    </header>
  );
}
