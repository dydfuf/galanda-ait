import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge.tsx";
import { cn } from "@/lib/utils.ts";

import type { PlanHomePlanSummaryData } from "../plan-home-view-model.ts";
import { PlanOpinionSummary } from "./PlanOpinionSummary.tsx";

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
  const bookingBadgeVariant =
    plan.booking.state === "UNAVAILABLE"
      ? "danger"
      : plan.booking.state === "NEEDS_CHECK" || plan.booking.state === "INCOMPLETE"
        ? "warning"
        : plan.booking.state === "UNCHECKED"
          ? "info"
          : plan.booking.state === "READY"
            ? "success"
            : "neutral";

  const cardVariantClass = isConfirmed
    ? "border-success/80 bg-surface-raised hover:border-success hover:shadow-md"
    : plan.planTag === "BASIC"
      ? "border-info/70 bg-surface-raised hover:border-info hover:shadow-md"
      : "border-border bg-surface-raised hover:border-border-strong hover:shadow-md";

  return (
    <Link
      to={to}
      className={cn(
        "group relative flex min-w-0 flex-col gap-2.5 rounded-2xl border p-4 text-left no-underline shadow-xs transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "active:translate-y-px active:scale-[0.995]",
        // Ensure long content never forces horizontal overflow on 320px
        "overflow-hidden",
        cardVariantClass,
      )}
    >
      {/* 1. badge + chevron – single tap affordance, no nested control */}
      <div className="flex min-w-0 items-center justify-between gap-2">
        <Badge variant={badgeVariant} className="shrink-0 font-semibold shadow-2xs">
          {badgeLabel}
        </Badge>
        <ChevronRight
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground/60 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-foreground group-active:text-foreground-subtle"
        />
      </div>

      {/* 2. 여행안 제목 + 기간·경로 – title is primary, period/route one step below */}
      <div className="flex min-w-0 flex-col gap-1.5">
        <h3 className="min-w-0 break-words text-[17px] font-bold leading-snug tracking-tight text-foreground line-clamp-2">
          {plan.title}
        </h3>
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1 text-sm leading-normal">
          {durationLabel ? (
            <span className="font-semibold tabular-nums text-foreground">{durationLabel}</span>
          ) : (
            <span className="font-medium text-foreground-muted">일정 미정</span>
          )}
          {periodText && (
            <span className="min-w-0 break-words font-medium text-foreground-muted line-clamp-1">
              {periodText}
            </span>
          )}
        </div>
        <p className="min-w-0 break-words text-[13px] font-medium leading-normal text-foreground-muted line-clamp-1 [overflow-wrap:anywhere]">
          {plan.routeText}
        </p>
      </div>

      {/* 3. 작성자 – 13px 보조 텍스트는 AA 대비를 만족하는 foreground-muted 사용 */}
      <p className="min-w-0 break-words text-sm font-medium leading-normal text-foreground-muted line-clamp-1">
        {plan.authorName} 제안
      </p>

      {/* 3.5 비용 – 범위·미정 한정 문구가 길어질 수 있어 pill이 아닌 줄바꿈 행으로 둔다 */}
      <p className="min-w-0 break-words text-sm font-semibold tabular-nums leading-snug text-foreground [overflow-wrap:anywhere]">
        {plan.perPersonCostText}
      </p>
      {/* 3.6 예약은 상태 badge, 응답은 일반 메타데이터로 표시해요. */}
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <Badge variant={bookingBadgeVariant} className="font-semibold">
          {plan.booking.text}
        </Badge>
        <span className="min-w-0 break-words font-semibold tabular-nums text-foreground-muted [overflow-wrap:anywhere]">
          {plan.responseText}
        </span>
      </div>
      {plan.nonRespondentText ? (
        <p className="min-w-0 break-words text-sm font-medium leading-normal text-foreground-muted line-clamp-1 [overflow-wrap:anywhere]">
          {plan.nonRespondentText}
        </p>
      ) : null}

      {/* 4. 핵심 차이 – 입력값 또는 명시적인 미정 상태를 의견보다 먼저 표시한다. */}
      <div
        className={cn(
          "min-w-0 border-l-2 py-0.5 pl-3 transition-colors",
          hasDifferenceSummary
            ? "border-primary"
            : "border-border",
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
