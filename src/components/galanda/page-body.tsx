import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

interface PageBodyProps extends ComponentProps<"div"> {
  /** 하단 고정 CTA(BottomAction)가 있는 화면은 본문 마지막이 가려지지 않게 여백을 늘려요. */
  readonly withBottomAction?: boolean;
  /**
   * PageHeader 없이 본문이 화면 최상단에 오는 route에서 켜요.
   * 설치형 PWA(notch)에서 제목이 상태 표시줄에 가리지 않게 해요.
   * (헤더가 있는 화면은 PageHeader가 이미 safe-area를 소유해요.)
   */
  readonly safeTop?: boolean;
}

/**
 * 화면 본문의 공통 상하 여백 계약이에요 (기존 tds-layout의 page shell 의미를 대체).
 */
export function PageBody({
  withBottomAction = false,
  safeTop = false,
  className,
  ...props
}: PageBodyProps) {
  return (
    <div
      className={cn(
        "min-h-full w-full flex-1",
        safeTop
          ? "pt-[calc(var(--app-page-padding-top)+var(--safe-top))]"
          : "pt-(--app-page-padding-top)",
        withBottomAction ? "pb-(--app-cta-space)" : "pb-(--app-page-padding-bottom)",
        className,
      )}
      {...props}
    />
  );
}
