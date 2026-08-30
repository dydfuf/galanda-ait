import { useEffect, useRef, type ReactNode } from "react";

import { cn } from "@/lib/utils";

interface BottomActionProps {
  /** 버튼 위에 표시할 안내/오류 영역 (예: validation 배너). */
  readonly accessory?: ReactNode;
  /** 하나 또는 두 개의 CTA 버튼. 두 개면 좌우로 나란히 배치돼요. */
  readonly children: ReactNode;
  /** 상위 화면과 이어지는 배경이 필요하면 content surface를 명시해요. */
  readonly surface?: "chrome" | "content";
  readonly className?: string;
}

const BOTTOM_ACTION_HEIGHT_PROPERTY = "--app-bottom-action-height";

/**
 * 화면 하단 고정 CTA shell이에요.
 *
 * - `env(safe-area-inset-bottom)`을 반영해요 (`--safe-bottom`).
 * - 실제 높이를 document root의 `--app-bottom-action-height`로 공유해요.
 * - 본문이 CTA에 가려지지 않도록, 이 컴포넌트를 쓰는 화면은
 *   `PageBody withBottomAction` 여백 계약을 지켜야 해요.
 */
export function BottomAction({
  accessory,
  children,
  surface = "chrome",
  className,
}: BottomActionProps) {
  const actionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const action = actionRef.current;
    if (!action) return;

    const root = action.ownerDocument.documentElement;
    const updateHeight = (height: number) => {
      root.style.setProperty(
        BOTTOM_ACTION_HEIGHT_PROPERTY,
        Number.isFinite(height) && height > 0
          ? `${Math.ceil(height)}px`
          : "var(--app-cta-space)",
      );
    };
    let observer: ResizeObserver | undefined;

    updateHeight(action.getBoundingClientRect().height);

    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(([entry]) => {
        const borderBoxHeight = entry?.borderBoxSize?.[0]?.blockSize;
        updateHeight(borderBoxHeight ?? action.getBoundingClientRect().height);
      });
      observer.observe(action);
    }

    return () => {
      observer?.disconnect();
      root.style.removeProperty(BOTTOM_ACTION_HEIGHT_PROPERTY);
    };
  }, []);

  return (
    <div
      ref={actionRef}
      data-slot="bottom-action"
      data-galanda-surface={surface}
      style={{
        bottom: "var(--global-nav-height, 0px)",
        paddingBottom:
          "calc(12px + var(--bottom-action-safe-bottom, var(--safe-bottom)))",
      }}
      className={cn(
        "fixed inset-x-0 z-30 border-t px-5 pt-2",
        className,
      )}
    >
      <div className="mx-auto flex w-full max-w-(--content-max-width) flex-col gap-2">
        {accessory && <div className="min-w-0">{accessory}</div>}
        <div className="flex gap-2 *:min-w-0 *:flex-1">{children}</div>
      </div>
    </div>
  );
}
