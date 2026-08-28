import { css } from "@emotion/react";

const bannerStyle = css`
  width: 100%;
  min-width: 0;
  min-height: var(--touch-target-min);
  box-sizing: border-box;
  padding: 12px 16px;
  border: 1px solid var(--destructive-border);
  border-radius: 12px;
  background-color: var(--destructive-muted);
  display: flex;
  align-items: center;
  gap: 8px;
  text-align: left;
`;

const textStyle = css`
  min-width: 0;
  color: var(--destructive-strong);
  font-size: 16px;
  font-weight: 600;
  line-height: 1.5;
  overflow-wrap: anywhere;
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
