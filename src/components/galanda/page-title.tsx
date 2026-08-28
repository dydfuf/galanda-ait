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
  const hasDescription = description !== undefined && description !== null;
  const hasAction = action !== undefined && action !== null;

  return (
    <div
      className={cn(
        "flex w-full min-w-0 flex-wrap items-start justify-between gap-3 px-(--app-inline-padding) py-3",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 basis-60 flex-col gap-1">
        <h1 className="min-w-0 text-[22px] leading-tight font-bold text-foreground [overflow-wrap:anywhere]">
          {title}
        </h1>
        {hasDescription && (
          <p className="min-w-0 text-base leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
            {description}
          </p>
        )}
      </div>
      {hasAction && (
        <div className="ml-auto flex min-w-0 max-w-full shrink-0 flex-wrap items-center justify-end gap-2 [overflow-wrap:anywhere] [&>*]:max-w-full">
          {action}
        </div>
      )}
    </div>
  );
}
