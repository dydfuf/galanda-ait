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
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 px-(--app-inline-padding) pt-4 pb-2",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <h2 className="text-[17px] leading-snug font-bold text-foreground">{title}</h2>
        {description && (
          <p className="text-[13px] leading-normal text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
