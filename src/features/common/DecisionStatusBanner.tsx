import { css } from "@emotion/react";
import { Badge } from "@toss/tds-mobile";

interface DecisionStatusBannerProps {
  readonly statusText: string;
  readonly subText?: string;
  readonly isConfirmed?: boolean;
}

const statusContainerStyle = css`
  padding: 0 var(--app-inline-padding);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 24px;
`;

const titleStyle = css`
  font-size: 15px;
  font-weight: 700;
  color: var(--adaptiveGrey900, #191f28);
`;

const subTextStyle = css`
  font-size: 13px;
  color: var(--adaptiveGrey600, #6b7684);
  line-height: 1.3;
`;

export function DecisionStatusBanner({
  statusText,
  subText,
  isConfirmed = false,
}: DecisionStatusBannerProps) {
  return (
    <div css={statusContainerStyle} aria-live="polite">
      <Badge
        size="small"
        variant="weak"
        color={isConfirmed ? "green" : "blue"}
      >
        {isConfirmed ? "확정됨" : "의견 수집 중"}
      </Badge>
      <h2 css={titleStyle}>{statusText}</h2>
      {subText && <p css={subTextStyle}>{subText}</p>}
    </div>
  );
}
