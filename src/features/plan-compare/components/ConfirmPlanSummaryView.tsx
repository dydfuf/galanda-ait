import { css } from "@emotion/react";
import type { ConfirmPlanSummary } from "../plan-compare-view-model.ts";

const containerStyle = css`
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 16px;
  padding: 4px 0 8px;
`;

const planTitleStyle = css`
  min-width: 0;
  margin: 0;
  color: var(--foreground);
  font-size: 18px;
  font-weight: 700;
  line-height: 1.45;
  overflow-wrap: anywhere;
`;

const rowStyle = css`
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
  align-items: stretch;
  font-size: 16px;
  line-height: 1.5;
`;

const rowLabelStyle = css`
  color: var(--foreground-subtle);
  font-weight: 600;
`;

const rowValueStyle = css`
  min-width: 0;
  margin: 0;
  color: var(--secondary-foreground);
  overflow-wrap: anywhere;
`;

const costValueStyle = css`
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
`;

const costMainStyle = css`
  display: block;
  color: var(--foreground);
  font-weight: 700;
`;

const costSubStyle = css`
  display: block;
  margin-top: 2px;
  color: var(--foreground-subtle);
  font-size: 16px;
`;

const needCheckBoxStyle = css`
  min-width: 0;
  padding: 14px;
  border: 1px solid var(--warning-border);
  border-radius: 12px;
  background-color: var(--warning-muted);
  overflow-wrap: anywhere;
`;

const needCheckTitleStyle = css`
  margin: 0 0 8px;
  color: var(--warning);
  font-size: 16px;
  font-weight: 700;
  line-height: 1.5;
`;

const needCheckListStyle = css`
  display: flex;
  margin: 0;
  padding-left: 20px;
  flex-direction: column;
  gap: 6px;
  color: var(--secondary-foreground);
  font-size: 16px;
  line-height: 1.5;
  list-style: disc;
  overflow-wrap: anywhere;
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
    <div css={containerStyle} data-plan-summary-layout="vertical">
      <h3 css={planTitleStyle}>{summary.title}</h3>

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

      {summary.comparisonResponseText && (
        <div css={rowStyle}>
          <span css={rowLabelStyle}>비교 쌍 응답</span>
          <p css={rowValueStyle}>{summary.comparisonResponseText}</p>
        </div>
      )}

      {summary.comparisonNonRespondentText && (
        <div css={rowStyle}>
          <span css={rowLabelStyle}>미응답자</span>
          <p css={rowValueStyle}>{summary.comparisonNonRespondentText}</p>
        </div>
      )}

      {summary.comparisonLimitationText && (
        <div css={rowStyle}>
          <span css={rowLabelStyle}>응답률 기준</span>
          <p css={rowValueStyle}>{summary.comparisonLimitationText}</p>
        </div>
      )}

      <div css={rowStyle}>
        <span css={rowLabelStyle}>어려워요 의견</span>
        <p css={rowValueStyle}>{summary.hardOpinionText}</p>
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
