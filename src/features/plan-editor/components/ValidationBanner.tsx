import { css } from "@emotion/react";

const bannerStyle = css`
  background-color: var(--adaptiveRed50, #ffeeee);
  border: 1px solid var(--adaptiveRed200, #fecdd3);
  border-radius: 12px;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  text-align: left;
`;

const textStyle = css`
  font-size: 13px;
  font-weight: 600;
  color: var(--adaptiveRed600, #e11d48);
  line-height: 1.4;
`;

interface ValidationBannerProps {
  readonly firstError?: string;
  readonly errorCount: number;
}

export function ValidationBanner({ firstError, errorCount }: ValidationBannerProps) {
  if (!firstError) return null;

  return (
    <span css={bannerStyle} role="alert">
      <span css={textStyle}>
        <span aria-hidden="true">⚠️ </span>
        {firstError} {errorCount > 1 && `(외 ${errorCount - 1}건)`}
      </span>
    </span>
  );
}
