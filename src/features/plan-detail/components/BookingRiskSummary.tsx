import { css } from "@emotion/react";

export interface BookingRiskItem {
  readonly level: "DANGER" | "WARNING" | "SUCCESS";
  readonly message: string;
  readonly snapshotInfo: string;
}

interface BookingRiskSummaryProps {
  readonly items: ReadonlyArray<BookingRiskItem>;
}

const emptyRiskContainerStyle = css`
  background-color: var(--adaptiveGreen50, #f0fbf4);
  border: 1px solid #d3f3df;
  border-radius: 12px;
  padding: 12px 14px;
  display: flex;
  align-items: center;
  gap: 10px;
`;

const checkIconStyle = css`
  font-size: 16px;
  color: var(--adaptiveGreen600, #15803d);
`;

const emptyRiskTitleStyle = css`
  font-size: 13px;
  font-weight: 700;
  color: var(--adaptiveGreen600, #15803d);
  margin: 0 0 2px 0;
`;

const emptyRiskDescStyle = css`
  font-size: 11px;
  color: var(--adaptiveGreen500, #2da44e);
  margin: 0;
`;

const listContainerStyle = css`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const itemCardStyle = (bg: string, border: string) => css`
  background-color: ${bg};
  border: 1px solid ${border};
  border-radius: 12px;
  padding: 12px 14px;
  display: flex;
  align-items: flex-start;
  gap: 10px;
`;

const itemIconStyle = css`
  font-size: 15px;
  margin-top: 1px;
`;

const itemTextContainerStyle = css`
  flex: 1;
`;

const itemMessageStyle = (text: string) => css`
  font-size: 13px;
  font-weight: 700;
  color: ${text};
  margin: 0 0 2px 0;
`;

const itemSnapshotStyle = css`
  font-size: 11px;
  color: var(--adaptiveGrey500, #8b95a1);
  margin: 0;
`;

export function BookingRiskSummary({ items }: BookingRiskSummaryProps) {
  if (!items || items.length === 0) {
    return (
      <div css={emptyRiskContainerStyle}>
        <span css={checkIconStyle}>✓</span>
        <div>
          <p css={emptyRiskTitleStyle}>
            모든 숙소·교통 정보가 확인되었습니다.
          </p>
          <p css={emptyRiskDescStyle}>
            참여자가 기록한 최신 스냅샷 기준입니다.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div css={listContainerStyle}>
      {items.map((item, idx) => {
        const isDanger = item.level === "DANGER";
        const isWarning = item.level === "WARNING";
        const bg = isDanger ? "var(--adaptiveRed50, #fdf2f3)" : isWarning ? "var(--adaptiveYellow50, #fff8e1)" : "var(--adaptiveGreen50, #f0fbf4)";
        const border = isDanger ? "#fecdd3" : isWarning ? "#ffe082" : "#d3f3df";
        const text = isDanger ? "var(--adaptiveRed600, #e0383e)" : isWarning ? "var(--adaptiveYellow600, #b78103)" : "var(--adaptiveGreen600, #15803d)";
        const icon = isDanger ? "🚨" : isWarning ? "⚠️" : "✓";

        return (
          <div key={idx} css={itemCardStyle(bg, border)}>
            <span css={itemIconStyle}>{icon}</span>
            <div css={itemTextContainerStyle}>
              <p css={itemMessageStyle(text)}>
                {item.message}
              </p>
              <p css={itemSnapshotStyle}>
                {item.snapshotInfo}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
