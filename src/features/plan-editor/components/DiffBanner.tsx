import { css } from "@emotion/react";
import type { PlanDifference } from "../../../core/calculations/plan-diff.ts";

const bannerStyle = css`
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  padding: 16px;
  margin-bottom: 20px;
  border: 1px solid var(--primary-border-weak);
  border-radius: 12px;
  background-color: var(--info-muted);
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const bannerTitleStyle = css`
  margin: 0;
  color: var(--info);
  font-size: 18px;
  font-weight: 700;
  line-height: 1.4;
  overflow-wrap: anywhere;
`;

const bannerDescStyle = css`
  margin: 0;
  color: var(--foreground-muted);
  font-size: 16px;
  font-weight: 500;
  line-height: 1.5;
  overflow-wrap: anywhere;
`;

interface DiffBannerProps {
  readonly diff: PlanDifference;
  readonly originalTitle: string;
}

export function DiffBanner({ diff, originalTitle }: DiffBannerProps) {
  if (!diff.hasChanges) return null;

  return (
    <section css={bannerStyle} data-galanda-surface="content">
      <h2 css={bannerTitleStyle}>'{originalTitle}' 기준 변경된 내용</h2>
      <p css={bannerDescStyle}>{diff.summaryText}</p>
    </section>
  );
}
