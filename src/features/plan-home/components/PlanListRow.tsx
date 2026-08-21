import { Badge } from "@/components/ui/badge.tsx";
import { ItemDescription, ItemTitle } from "@/components/ui/item.tsx";
import { MobileListItem } from "@/components/galanda/mobile-list.tsx";
import type { PlanSummaryData } from "../plan-home-view-model.ts";

interface PlanListRowProps {
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

const getOpinionSummary = (plan: PlanSummaryData): string => {
  const counts = [
    plan.opinions.likeCount > 0 ? `좋아요 ${plan.opinions.likeCount}` : undefined,
    plan.opinions.okayCount > 0 ? `괜찮아요 ${plan.opinions.okayCount}` : undefined,
    plan.opinions.hardCount > 0 ? `어려워요 ${plan.opinions.hardCount}` : undefined,
  ].filter((value): value is string => value !== undefined);
  const countText = counts.length > 0 ? counts.join(" · ") : "아직 의견이 없어요";
  const myReaction = getReactionLabel(plan.myReaction);

  return `${countText} · ${myReaction ? `내 의견 ${myReaction}` : "내 의견 전"}`;
};

export function PlanListRow({ plan, to }: PlanListRowProps) {
  const badgeVariant = plan.isConfirmed
    ? "success-solid"
    : plan.planTag === "BASIC"
      ? "info"
      : "neutral";
  const opinionSummary = getOpinionSummary(plan);

  return (
    <MobileListItem
      chevron
      to={to}
      aria-label={`${plan.title}, ${opinionSummary} · 상세 보기`}
    >
      <div>
        <Badge variant={badgeVariant}>{plan.isConfirmed ? "확정안" : plan.planTagLabel}</Badge>
      </div>

      <div className="flex min-w-0 items-center gap-2">
        <ItemTitle className="min-w-0 flex-initial text-[17px]">{plan.title}</ItemTitle>
        <span className="shrink-0 text-[13px] whitespace-nowrap text-muted-foreground">
          {plan.nights}박 {plan.days}일
        </span>
      </div>

      <ItemDescription className="line-clamp-1">
        {plan.authorName} 제안{plan.differenceSummary ? ` · ${plan.differenceSummary}` : ""}
      </ItemDescription>

      <ItemDescription className="line-clamp-1">{opinionSummary}</ItemDescription>
    </MobileListItem>
  );
}
