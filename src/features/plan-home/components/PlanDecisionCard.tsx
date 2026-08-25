import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge.tsx";
import { cn } from "@/lib/utils.ts";

import type { PlanSummaryData } from "../plan-home-view-model.ts";

interface PlanDecisionCardProps {
  readonly plan: PlanSummaryData;
  readonly to: string;
}

const getReactionLabel = (reaction: PlanSummaryData["myReaction"]): string | undefined => {
  switch (reaction) {
    case "LIKE":
      return "좋아요";
    case "OKAY":
      return "괜찮아요";
    case "HARD":
      return "어려워요";
    default:
      return undefined;
  }
};

export function PlanDecisionCard({ plan, to }: PlanDecisionCardProps) {
  const isConfirmed = plan.isConfirmed;
  const badgeVariant = isConfirmed ? "success-solid" : plan.planTag === "BASIC" ? "info" : "neutral";
  const badgeLabel = isConfirmed ? "확정안" : plan.planTagLabel;

  const myReactionLabel = getReactionLabel(plan.myReaction);

  const opinionCounts: Array<string> = [];
  if (plan.opinions.likeCount > 0) opinionCounts.push(`좋아요 ${plan.opinions.likeCount}`);
  if (plan.opinions.okayCount > 0) opinionCounts.push(`괜찮아요 ${plan.opinions.okayCount}`);
  if (plan.opinions.hardCount > 0) opinionCounts.push(`어려워요 ${plan.opinions.hardCount}`);

  const hasOpinion = opinionCounts.length > 0;

  // 기간 표시: 확정된 날짜가 있으면 날짜 범위를, 없으면 박/일 또는 일정 미정을 보여준다.
  const hasDuration = plan.days > 0;
  const durationLabel = hasDuration ? `${plan.nights}박 ${plan.days}일` : undefined;
  const periodText = plan.period !== "일정 미정" ? plan.period : undefined;

  const cardVariantClass = isConfirmed
    ? "border-success/30 bg-success-muted/40 hover:border-success/40 hover:bg-success-muted/60 active:bg-success-muted/70"
    : plan.planTag === "BASIC"
      ? "border-info/20 bg-info-muted/30 hover:border-info/30 hover:bg-info-muted/50 active:bg-info-muted/60"
      : "border-border bg-card hover:border-border-strong hover:bg-muted/40 active:bg-muted/60";

  return (
    <Link
      to={to}
      className={cn(
        "group flex min-w-0 flex-col gap-3 rounded-2xl border p-4 text-left no-underline shadow-sm transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "active:translate-y-px",
        // Ensure long content never forces horizontal overflow on 320px
        "overflow-hidden",
        cardVariantClass,
      )}
    >
      {/* 1. badge + chevron – single tap affordance, no nested control */}
      <div className="flex min-w-0 items-center justify-between gap-2">
        <Badge variant={badgeVariant} className="shrink-0">
          {badgeLabel}
        </Badge>
        <ChevronRight
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-muted-foreground group-active:text-foreground-subtle"
        />
      </div>

      {/* 2. 여행안 제목 + 기간 – title is primary, period one step below but before difference/opinion */}
      <div className="flex min-w-0 flex-col gap-1">
        <h3 className="min-w-0 break-words text-[16px] font-bold leading-snug text-foreground line-clamp-2">
          {plan.title}
        </h3>
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {durationLabel ? (
            <span className="inline-flex shrink-0 items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold tabular-nums text-foreground-muted whitespace-nowrap">
              {durationLabel}
            </span>
          ) : (
            <span className="inline-flex shrink-0 items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-foreground-muted whitespace-nowrap">
              일정 미정
            </span>
          )}
          {periodText && (
            <span className="min-w-0 break-words text-[12px] leading-normal text-foreground-muted line-clamp-1">
              {periodText}
            </span>
          )}
        </div>
      </div>

      {/* 3. 작성자 – 13px 보조 텍스트는 AA 대비를 만족하는 foreground-muted 사용 */}
      <p className="min-w-0 break-words text-[13px] leading-normal text-foreground-muted line-clamp-1">
        {plan.authorName} 제안
      </p>

      {/* 4. differenceSummary 기반 핵심 차이 – 한 단계 낮지만 의견보다 먼저 읽힌다. 없으면 렌더하지 않는다. */}
      {plan.differenceSummary && (
        <div className="rounded-xl border border-primary-border-weak bg-primary-muted/40 px-3 py-2.5">
          <p className="break-words text-[13px] font-semibold leading-relaxed text-info [overflow-wrap:anywhere] line-clamp-2">
            {plan.differenceSummary}
          </p>
        </div>
      )}

      {/* 5. 의견 요약 / 내 의견 상태 – text 덩어리보다 빠르게 읽히는 경량 구분선 + wrap */}
      <div className="flex min-w-0 flex-wrap items-center gap-1.5 gap-y-1 border-t border-border pt-3 text-[12px] leading-normal">
        {hasOpinion ? (
          <>
            {opinionCounts.map((text) => (
              <span
                key={text}
                className="inline-flex shrink-0 items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground-muted whitespace-nowrap"
              >
                {text}
              </span>
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
    </Link>
  );
}
