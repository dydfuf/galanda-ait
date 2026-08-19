import { css } from "@emotion/react";
import { Link } from "react-router-dom";
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
  readonly authorName: string;
  readonly opinions: PlanCardOpinionCounts;
  readonly myReaction?: "LIKE" | "OKAY" | "HARD";
  readonly isConfirmed: boolean;
}

interface PlanCardProps {
  readonly plan: PlanCardData;
  /** 카드 전체가 하나의 링크예요. 클릭 핸들러 대신 이동할 경로를 받아요. */
  readonly to: string;
}

const cardStyle = (isConfirmed: boolean) => css`
  background-color: var(--adaptiveBackground, #ffffff);
  border-radius: 16px;
  padding: 18px 20px;
  border: ${isConfirmed ? "2px solid var(--adaptiveGreen500, #2da44e)" : "1px solid var(--adaptiveGrey200, #e5e8eb)"};
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  transition: transform 0.12s ease, box-shadow 0.12s ease;
  display: flex;
  flex-direction: column;
  gap: 14px;
  color: inherit;
  text-decoration: none;

  &:active {
    transform: scale(0.985);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.02);
  }
`;

const cardHeaderStyle = css`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
`;

const tagGroupStyle = css`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const badgeStyle = (bg: string, color: string, border: string) => css`
  font-size: 11px;
  font-weight: 700;
  padding: 3px 7px;
  border-radius: 6px;
  background-color: ${bg};
  color: ${color};
  border: 1px solid ${border};
`;

const authorTextStyle = css`
  font-size: 12px;
  color: var(--adaptiveGrey500, #8b95a1);
`;

const detailLinkStyle = css`
  font-size: 13px;
  color: var(--adaptiveBlue500, #3182f6);
  font-weight: 600;
`;

const titleStyle = css`
  font-size: 17px;
  font-weight: 700;
  color: var(--adaptiveGrey900, #191f28);
  margin: 0 0 4px 0;
`;

const periodTextStyle = css`
  font-size: 13px;
  color: var(--adaptiveGrey500, #8b95a1);
  margin: 0;
`;

const costBoxStyle = css`
  background-color: var(--adaptiveGrey50, #f9fafb);
  border-radius: 10px;
  padding: 10px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
`;

const costLabelStyle = css`
  color: var(--adaptiveGrey700, #4e5968);
  font-weight: 500;
`;

const costValueAlignStyle = css`
  text-align: right;
`;

const costGroupTextStyle = css`
  font-weight: 700;
  color: var(--adaptiveGrey900, #191f28);
`;

const costPerPersonTextStyle = css`
  font-size: 11px;
  color: var(--adaptiveGrey500, #8b95a1);
  margin-left: 6px;
`;

const alertBoxStyle = css`
  background-color: var(--adaptiveYellow50, #fff8e1);
  border: 1px solid #ffe082;
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 12px;
  color: var(--adaptiveYellow600, #b78103);
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 4px;
`;

const footerStyle = css`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 10px;
  border-top: 1px solid var(--adaptiveGrey100, #f2f4f6);
  font-size: 12px;
`;

const opinionCountGroupStyle = css`
  display: flex;
  gap: 8px;
  color: var(--adaptiveGrey700, #4e5968);
`;

const hardCountStyle = css`
  color: var(--adaptiveRed600, #e0383e);
  font-weight: 600;
`;

const myReactionLabelStyle = (hasReaction: boolean) => css`
  color: ${hasReaction ? "var(--adaptiveBlue500, #3182f6)" : "var(--adaptiveGrey500, #8b95a1)"};
  font-weight: ${hasReaction ? 600 : 400};
`;

export function PlanCard({ plan, to }: PlanCardProps) {
  const getBadgeColors = () => {
    if (plan.isConfirmed) {
      return { bg: "var(--adaptiveGreen50, #f0fbf4)", color: "var(--adaptiveGreen600, #15803d)", border: "#bbf7d0" };
    }
    if (plan.planTag === "BASIC") {
      return { bg: "var(--adaptiveBlue50, #e8f3ff)", color: "var(--adaptiveBlue600, #1b64da)", border: "#cfe4ff" };
    }
    return { bg: "var(--adaptiveGrey100, #f2f4f6)", color: "var(--adaptiveGrey700, #4e5968)", border: "var(--adaptiveGrey200, #e5e8eb)" };
  };

  const badgeColors = getBadgeColors();

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
    <Link
      to={to}
      css={cardStyle(plan.isConfirmed)}
    >
      {/* 1. 상단: 태그 & 제목 & 상세 바로가기 화살표 */}
      <div>
        <div css={cardHeaderStyle}>
          <div css={tagGroupStyle}>
            <span
              css={badgeStyle(badgeColors.bg, badgeColors.color, badgeColors.border)}
            >
              {plan.isConfirmed ? "확정안" : plan.planTagLabel}
            </span>
            <span css={authorTextStyle}>
              {plan.authorName} 제안
            </span>
          </div>

          <span css={detailLinkStyle}>
            상세보기<span aria-hidden="true"> →</span>
          </span>
        </div>

        <h3 css={titleStyle}>
          {plan.title}
        </h3>

        <p css={periodTextStyle}>
          {plan.period} · {plan.nights}박 {plan.days}일
        </p>
      </div>

      {/* 2. 도시별 체류 압축 경로 레일 */}
      <RouteRail route={plan.route} differenceSummary={plan.differenceSummary} />

      {/* 3. 예상 비용 영역 */}
      <div css={costBoxStyle}>
        <span css={costLabelStyle}>예상 비용</span>
        <div css={costValueAlignStyle}>
          <span css={costGroupTextStyle}>{plan.groupCostText}</span>
          <span css={costPerPersonTextStyle}>
            ({plan.perPersonCostText})
          </span>
        </div>
      </div>

      {/* 4. 예약 상태 알림 (있는 경우) */}
      {plan.bookingAlert && (
        <div css={alertBoxStyle}>
          <span aria-hidden="true">⚠️</span>
          <span>{plan.bookingAlert}</span>
        </div>
      )}

      {/* 5. 의견 현황 및 내 의견 상태 */}
      <div css={footerStyle}>
        <div css={opinionCountGroupStyle}>
          <span>👍 {plan.opinions.likeCount}</span>
          <span>🙂 {plan.opinions.okayCount}</span>
          {plan.opinions.hardCount > 0 && (
            <span css={hardCountStyle}>
              😢 {plan.opinions.hardCount}
            </span>
          )}
        </div>

        <span css={myReactionLabelStyle(Boolean(plan.myReaction))}>
          {getMyReactionLabel()}
        </span>
      </div>
    </Link>
  );
}
