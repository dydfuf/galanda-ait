import type { ReactNode } from "react";

import { cn } from "@/lib/utils.ts";

import { REACTION_DISPLAY, getReactionLabel, type ReactionDisplayKey } from "../../common/reaction-display.tsx";
import type { PlanOpinionCounts, PlanSummaryData } from "../plan-home-view-model.ts";

/**
 * 카드 안에서 반복되는 compact pill 기하.
 * 기간 · 일정 미정 · 반응 pill이 같은 층위로 읽히도록 동일한 기하를 공유한다.
 */
export function Pill({ className, children }: { readonly className?: string; readonly children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5",
        "text-[11px] font-medium text-foreground-muted whitespace-nowrap",
        className,
      )}
    >
      {children}
    </span>
  );
}

interface PlanOpinionSummaryProps {
  readonly opinions: PlanOpinionCounts;
  readonly myReaction?: PlanSummaryData["myReaction"];
}

const countOf = (opinions: PlanOpinionCounts, key: ReactionDisplayKey): number =>
  key === "LIKE" ? opinions.likeCount : key === "OKAY" ? opinions.okayCount : opinions.hardCount;

/**
 * 의견 요약 / 내 의견 상태를 읽기 전용으로 표현한다.
 * 카드는 단일 `<Link>` surface이므로 이 영역에 focusable element를 두지 않는다.
 */
export function PlanOpinionSummary({ opinions, myReaction }: PlanOpinionSummaryProps) {
  // 0인 반응은 렌더하지 않는다 – 좁은 화면에서 시각적 노이즈가 되지 않도록.
  const entries = REACTION_DISPLAY.map((entry) => ({ ...entry, count: countOf(opinions, entry.key) })).filter(
    (entry) => entry.count > 0,
  );

  const myReactionLabel = getReactionLabel(myReaction);

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5 gap-y-1 border-t border-border pt-3 text-[12px] leading-normal">
      {entries.length > 0 ? (
        <>
          {entries.map(({ key, label, Icon, count }) => (
            // 시각은 [아이콘] 2, accessible text는 "좋아요 2명" – 아이콘만으로 의미를 전달하지 않는다.
            // label과 숫자 사이 공백은 sr-only span "바깥"의 text node여야 한다.
            // accessible name 합성은 요소 단위로 trim하므로 span 안의 공백은 사라지고,
            // flex container에서 공백뿐인 text run은 렌더되지 않아 시각 폭에는 영향이 없다.
            <Pill key={key}>
              <Icon aria-hidden="true" className="size-3 shrink-0" />
              <span className="sr-only">{label}</span>{" "}
              <span className="tabular-nums">{count}</span>
              <span className="sr-only">명</span>
            </Pill>
          ))}
        </>
      ) : (
        <span className="min-w-0 break-words text-foreground-muted">아직 의견이 없어요</span>
      )}
      <span className="shrink-0 text-border-strong" aria-hidden="true">
        ·
      </span>
      <span
        className={cn(
          "min-w-0 break-words whitespace-nowrap",
          myReactionLabel ? "font-semibold text-foreground" : "text-foreground-muted",
        )}
      >
        {myReactionLabel ? `내 의견 ${myReactionLabel}` : "내 의견 전"}
      </span>
    </div>
  );
}
