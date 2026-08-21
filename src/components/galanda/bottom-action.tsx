import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface BottomActionProps {
  /** 버튼 위에 표시할 안내/오류 영역 (예: validation 배너). */
  readonly accessory?: ReactNode;
  /** 하나 또는 두 개의 CTA 버튼. 두 개면 좌우로 나란히 배치돼요. */
  readonly children: ReactNode;
  readonly className?: string;
}

/**
 * 화면 하단 고정 CTA shell이에요.
 *
 * - `env(safe-area-inset-bottom)`을 반영해요 (`--safe-bottom`).
 * - 본문이 CTA에 가려지지 않도록, 이 컴포넌트를 쓰는 화면은 본문에
 *   `pb-(--app-cta-space)` 여백 계약을 지켜야 해요 (`PageBody withBottomAction`).
 */
export function BottomAction({ accessory, children, className }: BottomActionProps) {
  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 bg-background px-5 pt-2 pb-[calc(12px+var(--safe-bottom))]",
        className,
      )}
    >
      <div className="mx-auto flex w-full max-w-[640px] flex-col gap-2">
        {accessory}
        <div className="flex gap-2 *:min-w-0 *:flex-1">{children}</div>
      </div>
    </div>
  );
}
