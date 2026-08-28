import type { ComponentProps, ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

import { Item, ItemActions, ItemContent, ItemGroup, ItemMedia } from "@/components/ui/item";
import { cn } from "@/lib/utils";

/** 모바일 목록 컨테이너예요. 행 사이에 구분선을 그려요. */
export function MobileList({ className, ...props }: ComponentProps<typeof ItemGroup>) {
  return <ItemGroup className={cn("gap-0 divide-y divide-border", className)} {...props} />;
}

interface MobileListItemProps {
  /** 좌측 배지/아이콘 슬롯. */
  readonly leading?: ReactNode;
  /** 우측 배지/텍스트 슬롯. */
  readonly trailing?: ReactNode;
  /** 우측 끝 chevron 표시 여부 (탐색 가능한 행). */
  readonly chevron?: boolean;
  /** 지정하면 행 전체가 button이 돼요. */
  readonly onClick?: () => void;
  /** 지정하면 행 전체가 Link가 돼요. */
  readonly to?: string;
  readonly disabled?: boolean;
  readonly "aria-label"?: string;
  readonly className?: string;
  /** 본문 컬럼. ItemTitle/ItemDescription으로 구성해요. */
  readonly children: ReactNode;
}

/**
 * Galanda에서 반복되는 목록 행 패턴이에요: [leading] 본문 [trailing][chevron].
 * 클릭 가능한 행은 div onClick이 아니라 실제 button/Link로 렌더링해요.
 */
export function MobileListItem({
  leading,
  trailing,
  chevron = false,
  onClick,
  to,
  disabled = false,
  "aria-label": ariaLabel,
  className,
  children,
}: MobileListItemProps) {
  const actionable = Boolean(onClick || to);
  const interactive = actionable && !disabled;
  const hasLeading = leading !== undefined && leading !== null;
  const hasTrailing = trailing !== undefined && trailing !== null;
  const render = to ? (
    <Link
      to={to}
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      onClick={disabled ? (event) => event.preventDefault() : undefined}
      tabIndex={disabled ? -1 : undefined}
    />
  ) : onClick ? (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
    />
  ) : undefined;

  return (
    <div role="listitem" className="min-w-0">
      <Item
        render={render}
        aria-label={render ? undefined : ariaLabel}
        className={cn(
          "min-w-0 w-full rounded-none border-x-0 px-(--app-inline-padding) py-3.5 text-left",
          // TDS가 주입하는 unlayered `a { color }` 전역 스타일을 이겨야 해서 important를 써요.
          // TDS package 제거(RAON-189) 후에도 무해해요.
          to && "text-foreground! no-underline!",
          actionable && "min-h-(--touch-target-min)",
          interactive &&
            "cursor-pointer transition-colors hover:bg-muted/50 active:bg-muted",
          disabled && "opacity-50",
          className,
        )}
      >
        {hasLeading && <ItemMedia>{leading}</ItemMedia>}
        <ItemContent className="min-w-0 [overflow-wrap:anywhere] [&_[data-slot=item-description]]:line-clamp-none [&_[data-slot=item-description]]:min-w-0 [&_[data-slot=item-description]]:[overflow-wrap:anywhere] [&_[data-slot=item-title]]:line-clamp-none [&_[data-slot=item-title]]:min-w-0 [&_[data-slot=item-title]]:w-full [&_[data-slot=item-title]]:flex-wrap [&_[data-slot=item-title]]:[overflow-wrap:anywhere]">
          {children}
        </ItemContent>
        {(hasTrailing || chevron) && (
          <ItemActions className="min-w-0 max-w-[45%] shrink-0 flex-wrap justify-end text-right [overflow-wrap:anywhere] [&>*]:min-w-0 [&>*]:max-w-full [&>*]:whitespace-normal [&>*]:[overflow-wrap:anywhere]">
            {trailing}
            {chevron && (
              <ChevronRight
                aria-hidden="true"
                className="size-4 shrink-0 text-muted-foreground/60"
              />
            )}
          </ItemActions>
        )}
      </Item>
    </div>
  );
}
