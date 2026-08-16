import { css } from "@emotion/react";
import type { PlanCostSummary } from "../../../core/calculations/plan-cost.ts";
import { formatCostRangeText } from "../../../core/calculations/plan-cost.ts";

const cardStyle = css`
  background-color: var(--adaptiveBlue50, #f2f7ff);
  border-radius: 16px;
  padding: 20px;
  border: 1px solid var(--adaptiveBlue200, #b8d7ff);
  margin-bottom: 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const sectionTitleStyle = css`
  font-size: 16px;
  font-weight: 700;
  color: var(--adaptiveBlue700, #1b64da);
  margin: 0;
`;

const costRowStyle = css`
  display: flex;
  justify-content: space-between;
  align-items: baseline;
`;

const costLabelStyle = css`
  font-size: 13px;
  font-weight: 600;
  color: var(--adaptiveGrey700, #4e5968);
`;

const totalCostValueStyle = css`
  font-size: 18px;
  font-weight: 800;
  color: var(--adaptiveBlue700, #1b64da);
`;

const perPersonCostValueStyle = css`
  font-size: 14px;
  font-weight: 700;
  color: var(--adaptiveGrey800, #333d4b);
`;

const unpricedHintStyle = css`
  font-size: 12px;
  color: var(--adaptiveGrey500, #8b95a1);
  margin-top: 4px;
`;

interface CostSummarySectionProps {
  readonly costSummary: PlanCostSummary;
}

export function CostSummarySection({ costSummary }: CostSummarySectionProps) {
  const totalText = costSummary.hasCost
    ? formatCostRangeText(costSummary.minTotal, costSummary.maxTotal)
    : "가격 미정";

  const perPersonText = costSummary.hasCost
    ? formatCostRangeText(costSummary.minPerPerson, costSummary.maxPerPerson)
    : "가격 미정";

  return (
    <section css={cardStyle}>
      <h2 css={sectionTitleStyle}>5. 예상 비용 자동 합산</h2>

      <div css={costRowStyle}>
        <span css={costLabelStyle}>그룹 총액 합계</span>
        <span css={totalCostValueStyle}>{totalText}</span>
      </div>

      <div css={costRowStyle}>
        <span css={costLabelStyle}>{costSummary.baseHeadcount}명 기준 1인 예상 참고액</span>
        <span css={perPersonCostValueStyle}>{perPersonText}</span>
      </div>

      {costSummary.unpricedCount > 0 && (
        <span css={unpricedHintStyle}>
          ⓘ 가격 미입력 항목이 {costSummary.unpricedCount}건 있어 총액에서 제외되었습니다.
        </span>
      )}
    </section>
  );
}
