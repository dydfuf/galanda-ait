import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  readonly title: ReactNode;
  readonly description?: ReactNode;
  readonly action?: ReactNode;
  readonly className?: string;
}

/** 본문 섹션 제목이에요 (기존 TDS ListHeader 자리). 제목은 시맨틱 h2예요. */
export function SectionHeader({ title, description, action, className }: SectionHeaderProps) {
  const hasDescription = description !== undefined && description !== null;
  const hasAction = action !== undefined && action !== null;

  return (
    <div
      className={cn(
        "flex w-full min-w-0 flex-wrap items-start justify-between gap-3 px-(--app-inline-padding) pt-4 pb-2",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 basis-48 flex-col gap-1">
        <h2 className="min-w-0 text-lg leading-snug font-bold text-foreground [overflow-wrap:anywhere]">
          {title}
        </h2>
        {hasDescription && (
          <p className="min-w-0 text-sm leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
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
