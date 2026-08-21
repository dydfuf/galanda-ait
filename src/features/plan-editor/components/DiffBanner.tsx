import { css } from "@emotion/react";
import type { PlanDifference } from "../../../core/calculations/plan-diff.ts";

const bannerStyle = css`
  background-color: var(--surface-subtle);
  border: 1px solid var(--primary-border-weak);
  border-radius: 12px;
  padding: 12px 16px;
  margin-bottom: 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const bannerTitleStyle = css`
  font-size: 12px;
  font-weight: 700;
  color: var(--info);
`;

const bannerDescStyle = css`
  font-size: 13px;
  font-weight: 500;
  color: var(--secondary-foreground);
  line-height: 1.4;
`;

interface DiffBannerProps {
  readonly diff: PlanDifference;
  readonly originalTitle: string;
}

export function DiffBanner({ diff, originalTitle }: DiffBannerProps) {
  if (!diff.hasChanges) return null;

  return (
    <div css={bannerStyle}>
      <span css={bannerTitleStyle}>'{originalTitle}' 기준 변경된 내용</span>
      <span css={bannerDescStyle}>{diff.summaryText}</span>
    </div>
  );
}
