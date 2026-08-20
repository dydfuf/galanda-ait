import { css } from "@emotion/react";
import { Badge, ListRow, Text } from "@toss/tds-mobile";
import { useNavigate } from "react-router-dom";
import type { PlanSummaryData } from "../plan-home-view-model.ts";

interface PlanListRowProps {
  readonly plan: PlanSummaryData;
  readonly to: string;
}

const contentsStyle = css`
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const lineStyle = css`
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const titleStyle = css`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const durationStyle = css`
  flex-shrink: 0;
  white-space: nowrap;
`;

const detailStyle = css`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

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
  const navigate = useNavigate();
  const badgeColor = plan.isConfirmed
    ? "green"
    : plan.planTag === "BASIC"
      ? "blue"
      : "elephant";
  const opinionSummary = getOpinionSummary(plan);

  return (
    <ListRow
      border="indented"
      verticalPadding="medium"
      horizontalPadding="small"
      withTouchEffect
      aria-label={`${plan.title}, ${opinionSummary} · 상세 보기`}
      onClick={() => navigate(to)}
      arrowType="right"
      contents={
        <div css={contentsStyle}>
          <div css={lineStyle}>
            <Badge size="small" variant={plan.isConfirmed ? "fill" : "weak"} color={badgeColor}>
              {plan.isConfirmed ? "확정안" : plan.planTagLabel}
            </Badge>
          </div>

          <div css={lineStyle}>
            <Text typography="t5" fontWeight="bold" color="var(--adaptiveGrey900, #191f28)" css={titleStyle}>
              {plan.title}
            </Text>
            <Text typography="t7" color="var(--adaptiveGrey500, #8b95a1)" css={durationStyle}>
              {plan.nights}박 {plan.days}일
            </Text>
          </div>

          <Text typography="t7" color="var(--adaptiveGrey600, #6b7684)" css={detailStyle}>
            {plan.authorName} 제안{plan.differenceSummary ? ` · ${plan.differenceSummary}` : ""}
          </Text>

          <Text typography="t7" color="var(--adaptiveGrey600, #6b7684)" css={detailStyle}>
            {opinionSummary}
          </Text>
        </div>
      }
    />
  );
}
