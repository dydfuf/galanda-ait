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
  readonly back?: PageHeaderBack;
  readonly action?: ReactNode;
  /** 스크롤 시 상단에 고정할지 여부. 내부 고정값이 아니라 화면이 명시적으로 선택해요. */
  readonly sticky?: boolean;
  readonly bordered?: boolean;
  readonly className?: string;
  /** 헤더 bar 아래에 붙는 추가 행 (예: Trip Room 탭). */
  readonly children?: ReactNode;
}

/**
 * 일반 Web/PWA 화면의 상단 내비게이션 shell이에요.
 * back/title/action만 담당하고, 플랫폼(AIT) SDK는 알지 못해요.
 */
export function PageHeader({
  title,
  back,
  action,
  sticky = false,
  bordered = false,
  className,
  children,
}: PageHeaderProps) {
  // bar 내용이 하나도 없으면(예: AIT shell이 navigation을 소유) 하단 행만 렌더링해요.
  const hasBar = Boolean(title || back || action);

  return (
    <header
      className={cn(
        "w-full bg-background",
        sticky && "sticky top-0 z-20",
        bordered && "border-b",
        className,
      )}
    >
      {hasBar && (
        <div className="grid h-14 grid-cols-[1fr_auto_1fr] items-center px-2">
          <div className="flex justify-start">
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
          <div className="truncate px-1 text-center text-base font-semibold text-foreground">
            {title}
          </div>
          <div className="flex justify-end pr-1">{action}</div>
        </div>
      )}
      {children}
    </header>
  );
}
