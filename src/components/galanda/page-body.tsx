import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

interface PageBodyProps extends ComponentProps<"div"> {
  /** 하단 고정 CTA(BottomAction)가 있는 화면은 본문 마지막이 가려지지 않게 여백을 늘려요. */
  readonly withBottomAction?: boolean;
}

/**
 * 화면 본문의 공통 상하 여백 계약이에요 (기존 tds-layout의 page shell 의미를 대체).
 */
export function PageBody({ withBottomAction = false, className, ...props }: PageBodyProps) {
  return (
    <div
      className={cn(
        "min-h-full w-full flex-1 pt-(--app-page-padding-top)",
        withBottomAction ? "pb-(--app-cta-space)" : "pb-(--app-page-padding-bottom)",
        className,
      )}
      {...props}
    />
  );
}
