import { css } from "@emotion/react";
import { Badge, ListRow, Text } from "@toss/tds-mobile";
import { useNavigate } from "react-router-dom";
import { RouteRail } from "../../common/RouteRail.tsx";

export interface PlanCardOpinionCounts {
  readonly likeCount: number;
  readonly okayCount: number;
  readonly hardCount: number;
}

export interface PlanCardData {
  readonly id: string;
  readonly title: string;
  readonly planTag: "BASIC" | "ALTERNATIVE" | "CONFIRMED";
  readonly planTagLabel: string;
  readonly period: string;
  readonly nights: number;
  readonly days: number;
  readonly route: ReadonlyArray<{ readonly city: string; readonly nights: number }>;
  readonly differenceSummary?: string;
  readonly groupCostText: string;
  readonly perPersonCostText: string;
  readonly bookingAlert?: string;
  readonly authorId?: string;
  readonly authorName: string;
  readonly isAuthor?: boolean;
  readonly canManage?: boolean;
  readonly opinions: PlanCardOpinionCounts;
  readonly myReaction?: "LIKE" | "OKAY" | "HARD";
  readonly isConfirmed: boolean;
}

interface PlanCardProps {
  readonly plan: PlanCardData;
  readonly to: string;
}

const contentsStyle = css`
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const tagRowStyle = css`
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
`;

const titleStyle = css`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const costRowStyle = css`
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
  padding-top: 8px;
  border-top: 1px solid var(--adaptiveGrey100, #f2f4f6);
`;

const costValueStyle = css`
  text-align: right;
  white-space: nowrap;
`;

const alertStyle = css`
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
`;

const opinionRowStyle = css`
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
  padding-top: 4px;
`;

const opinionCountsStyle = css`
  display: flex;
  gap: 8px;
  white-space: nowrap;
`;

const hardCountStyle = css`
  color: var(--adaptiveRed600, #e0383e);
`;

const reactionStyle = (hasReaction: boolean) => css`
  color: ${hasReaction
    ? "var(--adaptiveBlue600, #1b64da)"
    : "var(--adaptiveGrey500, #8b95a1)"};
  font-weight: ${hasReaction ? 600 : 400};
  text-align: right;
`;

export function PlanCard({ plan, to }: PlanCardProps) {
  const navigate = useNavigate();
  const badgeColor = plan.isConfirmed
    ? "green"
    : plan.planTag === "BASIC"
      ? "blue"
      : "elephant";

  const getMyReactionLabel = () => {
    if (!plan.myReaction) {
      return "나는 아직 의견 전";
    }
    switch (plan.myReaction) {
      case "LIKE":
        return "내 의견: 좋아요 👍";
      case "OKAY":
        return "내 의견: 괜찮아요 🙂";
      case "HARD":
        return "내 의견: 어려워요 😢";
    }
  };

  return (
    <ListRow
      border="indented"
      verticalPadding="large"
      withTouchEffect
      aria-label={`${plan.title} 상세 보기`}
      onClick={() => navigate(to)}
      arrowType="right"
      right={
        <Text typography="t7" color="var(--adaptiveBlue500, #3182f6)">
          상세
        </Text>
      }
      contents={
        <div css={contentsStyle}>
          <div css={tagRowStyle}>
            <Badge size="small" variant={plan.isConfirmed ? "fill" : "weak"} color={badgeColor}>
              {plan.isConfirmed ? "확정안" : plan.planTagLabel}
            </Badge>
            <Text typography="t7" color="var(--adaptiveGrey500, #8b95a1)">
              {plan.authorName} 제안
            </Text>
          </div>

          <Text typography="t5" color="var(--adaptiveGrey900, #191f28)" css={titleStyle}>
            {plan.title}
          </Text>
          <Text typography="t7" color="var(--adaptiveGrey500, #8b95a1)">
            {plan.period} · {plan.nights}박 {plan.days}일
          </Text>

          <RouteRail route={plan.route} differenceSummary={plan.differenceSummary} />

          <div css={costRowStyle}>
            <Text typography="t7" color="var(--adaptiveGrey700, #4e5968)">
              예상 비용
            </Text>
            <div css={costValueStyle}>
              <Text typography="t7" color="var(--adaptiveGrey900, #191f28)" fontWeight="bold">
                {plan.groupCostText}
              </Text>{" "}
              <Text typography="t7" color="var(--adaptiveGrey500, #8b95a1)">
                ({plan.perPersonCostText})
              </Text>
            </div>
          </div>

          {plan.bookingAlert && (
            <div css={alertStyle}>
              <Badge size="xsmall" variant="weak" color="yellow">
                확인 필요
              </Badge>
              <Text typography="t7" color="var(--adaptiveYellow600, #b78103)">
                {plan.bookingAlert}
              </Text>
            </div>
          )}

          <div css={opinionRowStyle}>
            <div css={opinionCountsStyle}>
              <Text typography="t7" color="var(--adaptiveGrey700, #4e5968)">
                👍 {plan.opinions.likeCount}
              </Text>
              <Text typography="t7" color="var(--adaptiveGrey700, #4e5968)">
                🙂 {plan.opinions.okayCount}
              </Text>
              {plan.opinions.hardCount > 0 && (
                <Text typography="t7" css={hardCountStyle}>
                  😢 {plan.opinions.hardCount}
                </Text>
              )}
            </div>
            <Text typography="t7" css={reactionStyle(Boolean(plan.myReaction))}>
              {getMyReactionLabel()}
            </Text>
          </div>
        </div>
      }
    />
  );
}
