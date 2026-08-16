import { css } from "@emotion/react";

interface DecisionStatusBannerProps {
  readonly statusText: string;
  readonly subText?: string;
  readonly isConfirmed?: boolean;
}

const bannerContainerStyle = (isConfirmed: boolean) => css`
  background-color: ${isConfirmed ? "var(--adaptiveGreen50, #f0fbf4)" : "var(--adaptiveBlue50, #e8f3ff)"};
  border: 1px solid ${isConfirmed ? "#d3f3df" : "#cfe4ff"};
  border-radius: 14px;
  padding: 14px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
`;

const iconBoxStyle = (isConfirmed: boolean) => css`
  width: 36px;
  height: 36px;
  border-radius: 18px;
  background-color: ${isConfirmed ? "var(--adaptiveGreen500, #2da44e)" : "var(--adaptiveBlue500, #3182f6)"};
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
`;

const textContainerStyle = css`
  flex: 1;
`;

const titleStyle = (isConfirmed: boolean) => css`
  font-size: 15px;
  font-weight: 700;
  color: ${isConfirmed ? "var(--adaptiveGreen600, #15803d)" : "var(--adaptiveBlue600, #1b64da)"};
  margin: 0 0 2px 0;
`;

const subTextStyle = (isConfirmed: boolean) => css`
  font-size: 13px;
  color: ${isConfirmed ? "var(--adaptiveGreen600, #15803d)" : "var(--adaptiveGrey700, #4e5968)"};
  margin: 0;
  line-height: 1.3;
`;

export function DecisionStatusBanner({
  statusText,
  subText,
  isConfirmed = false,
}: DecisionStatusBannerProps) {
  return (
    <div css={bannerContainerStyle(isConfirmed)}>
      <div css={iconBoxStyle(isConfirmed)}>
        {isConfirmed ? "✓" : "💬"}
      </div>

      <div css={textContainerStyle}>
        <h3 css={titleStyle(isConfirmed)}>
          {statusText}
        </h3>
        {subText && (
          <p css={subTextStyle(isConfirmed)}>
            {subText}
          </p>
        )}
      </div>
    </div>
  );
}
