import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge.tsx";
import { cn } from "@/lib/utils.ts";

import type { PlanHomePlanSummaryData } from "../plan-home-view-model.ts";
import { Pill, PlanOpinionSummary } from "./PlanOpinionSummary.tsx";

interface PlanDecisionCardProps {
  readonly plan: PlanHomePlanSummaryData;
  readonly to: string;
}

export function PlanDecisionCard({ plan, to }: PlanDecisionCardProps) {
  const isConfirmed = plan.isConfirmed;
  const badgeVariant = isConfirmed ? "success-solid" : plan.planTag === "BASIC" ? "info" : "neutral";
  const badgeLabel = isConfirmed ? "확정안" : plan.planTagLabel;

  // 기간 표시: 확정된 날짜가 있으면 날짜 범위를, 없으면 박/일 또는 일정 미정을 보여준다.
  const hasDuration = plan.days > 0;
  const durationLabel = hasDuration ? `${plan.nights}박 ${plan.days}일` : undefined;
  const periodText = plan.period !== "일정 미정" ? plan.period : undefined;
  const hasDifferenceSummary = Boolean(plan.differenceSummary?.trim());

  const cardVariantClass = isConfirmed
    ? "border-success bg-surface-raised hover:border-success hover:bg-muted"
    : plan.planTag === "BASIC"
      ? "border-info bg-surface-raised hover:border-info hover:bg-muted"
      : "border-border bg-surface-raised hover:border-border-strong hover:bg-muted";

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
            <Pill className="font-semibold tabular-nums">{durationLabel}</Pill>
          ) : (
            <Pill className="font-semibold">일정 미정</Pill>
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

      {/* 4. 핵심 차이 – 입력값 또는 명시적인 미정 상태를 의견보다 먼저 표시한다. */}
      <div
        className={cn(
          "rounded-xl border px-3 py-2.5",
          hasDifferenceSummary
            ? "border-primary-border-weak bg-primary-muted"
            : "border-border bg-muted",
        )}
      >
        <p
          className={cn(
            "break-words text-sm leading-relaxed [overflow-wrap:anywhere] line-clamp-2",
            hasDifferenceSummary
              ? "font-semibold text-info"
              : "text-foreground-muted",
          )}
        >
          {plan.differenceSummaryText}
        </p>
      </div>

      {/* 5. 의견 요약 / 내 의견 상태 – text 덩어리보다 빠르게 읽히는 경량 구분선 + wrap */}
      <PlanOpinionSummary
        opinions={plan.opinions}
        myReaction={plan.myReaction}
      />
    </Link>
  );
}
