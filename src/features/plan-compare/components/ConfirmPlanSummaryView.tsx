import { css } from "@emotion/react";
import type { ConfirmPlanSummary } from "../plan-compare-view-model.ts";

const containerStyle = css`
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 4px 0 8px;
`;

const planTitleStyle = css`
  font-size: 17px;
  font-weight: 700;
  color: var(--adaptiveGrey900, #191f28);
  margin: 0;
`;

const rowStyle = css`
  display: flex;
  gap: 12px;
  align-items: flex-start;
  font-size: 14px;
  line-height: 1.45;
`;

const rowLabelStyle = css`
  flex: 0 0 62px;
  color: var(--adaptiveGrey500, #8b95a1);
  font-weight: 600;
`;

const rowValueStyle = css`
  flex: 1;
  color: var(--adaptiveGrey800, #333d4b);
  margin: 0;
  word-break: keep-all;
`;

const costValueStyle = css`
  flex: 1;
  margin: 0;
`;

const costMainStyle = css`
  display: block;
  color: var(--adaptiveGrey900, #191f28);
  font-weight: 700;
`;

const costSubStyle = css`
  display: block;
  margin-top: 2px;
  font-size: 12px;
  color: var(--adaptiveGrey500, #8b95a1);
`;

const needCheckBoxStyle = css`
  background-color: var(--adaptiveYellow50, #fff8e1);
  border: 1px solid #ffe082;
  border-radius: 12px;
  padding: 12px 14px;
`;

const needCheckTitleStyle = css`
  font-size: 13px;
  font-weight: 700;
  color: var(--adaptiveYellow700, #b78103);
  margin: 0 0 6px 0;
`;

const needCheckListStyle = css`
  margin: 0;
  padding-left: 18px;
  font-size: 13px;
  color: var(--adaptiveGrey800, #333d4b);
  display: flex;
  flex-direction: column;
  gap: 4px;
  line-height: 1.4;
`;

interface ConfirmPlanSummaryViewProps {
  readonly summary: ConfirmPlanSummary;
}

/**
 * 확정 직전에 무엇을 확정하는지 다시 보여주는 요약이에요.
 * 날짜·경로·총액은 항상, 확인이 필요한 예약 항목은 있을 때만 노출해요.
 */
export function ConfirmPlanSummaryView({ summary }: ConfirmPlanSummaryViewProps) {
  return (
    <div css={containerStyle}>
      <p css={planTitleStyle}>{summary.title}</p>

      <div css={rowStyle}>
        <span css={rowLabelStyle}>일정</span>
        <p css={rowValueStyle}>{summary.periodText}</p>
      </div>

      <div css={rowStyle}>
        <span css={rowLabelStyle}>경로</span>
        <p css={rowValueStyle}>{summary.routeText}</p>
      </div>

      <div css={rowStyle}>
        <span css={rowLabelStyle}>예상 경비</span>
        <p css={costValueStyle}>
          <span css={costMainStyle}>{summary.groupCostText}</span>
          <span css={costSubStyle}>{summary.perPersonCostText}</span>
        </p>
      </div>

      {summary.needCheckMessages.length > 0 && (
        <div css={needCheckBoxStyle}>
          <p css={needCheckTitleStyle}>
            확정 전 확인이 필요해요 ({summary.needCheckMessages.length}건)
          </p>
          <ul css={needCheckListStyle}>
            {summary.needCheckMessages.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
