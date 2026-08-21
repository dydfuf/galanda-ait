import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface PageTitleProps {
  readonly title: ReactNode;
  readonly description?: ReactNode;
  readonly action?: ReactNode;
  readonly className?: string;
}

/** 화면 본문 최상단의 큰 제목 블록이에요 (기존 TDS Top 자리). 제목은 시맨틱 h1이에요. */
export function PageTitle({ title, description, action, className }: PageTitleProps) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 px-(--app-inline-padding) py-3",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-[22px] leading-tight font-bold text-foreground">{title}</h1>
        {description && (
          <p className="text-[15px] leading-normal text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
