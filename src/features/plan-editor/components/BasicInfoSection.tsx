import { css } from "@emotion/react";
import { PLAN_EDITOR_SECTION_PRESENTATION } from "../plan-editor-section.ts";

const cardStyle = css`
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  background-color: var(--surface-content);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 16px;
  margin-bottom: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;

  @media (min-width: 390px) {
    padding: 20px;
  }
`;

const sectionTitleStyle = css`
  margin: 0;
  color: var(--foreground);
  font-size: 20px;
  font-weight: 700;
  line-height: 1.35;
`;

const fieldStyle = css`
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const labelStyle = css`
  color: var(--foreground-muted);
  font-size: 16px;
  font-weight: 600;
  line-height: 1.5;
`;

const inputStyle = css`
  width: 100%;
  min-width: 0;
  min-height: var(--touch-target-min);
  box-sizing: border-box;
  padding: 10px 12px;
  border: 1px solid var(--border-strong);
  border-radius: 10px;
  outline: none;
  background-color: var(--surface-content);
  color: var(--foreground);
  font-size: 16px;
  line-height: 1.5;
  transition: border-color var(--motion-duration-fast)
    var(--motion-ease-standard);

  &:focus-visible {
    border-color: var(--primary);
  }
`;

const headcountWrapperStyle = css`
  min-width: 0;
  padding: 0;
  margin: 0;
  border: none;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
`;

const headcountButtonStyle = css`
  width: var(--touch-target-min);
  height: var(--touch-target-min);
  flex: 0 0 var(--touch-target-min);
  border: 1px solid var(--border-strong);
  border-radius: 10px;
  background-color: var(--surface-subtle);
  color: var(--foreground);
  font-size: 18px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color var(--motion-duration-fast)
    var(--motion-ease-standard);

  &:hover {
    background-color: var(--muted);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;

const headcountValueStyle = css`
  min-width: 48px;
  color: var(--foreground);
  font-size: 16px;
  font-weight: 700;
  line-height: 1.5;
  text-align: center;
`;

const headcountHintStyle = css`
  margin-top: 2px;
  color: var(--foreground-subtle);
  font-size: 16px;
  line-height: 1.5;
`;

interface BasicInfoSectionProps {
  readonly title: string;
  readonly onTitleChange: (val: string) => void;
  readonly proposalReason: string;
  readonly onProposalReasonChange: (val: string) => void;
  readonly baseHeadcount: number;
  readonly onBaseHeadcountChange: (val: number) => void;
}

export function BasicInfoSection({
  title,
  onTitleChange,
  proposalReason,
  onProposalReasonChange,
  baseHeadcount,
  onBaseHeadcountChange,
}: BasicInfoSectionProps) {
  return (
    <section css={cardStyle} data-galanda-surface="content">
      <h2 css={sectionTitleStyle}>
        {PLAN_EDITOR_SECTION_PRESENTATION.basic.sectionHeading}
      </h2>

      <div css={fieldStyle}>
        <label css={labelStyle} htmlFor="plan-title">
          여행안 제목 *
        </label>
        <input
          id="plan-title"
          type="text"
          placeholder="예: 힐링 카페 & 호캉스 코스"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          css={inputStyle}
          required
        />
      </div>

      <div css={fieldStyle}>
        <label css={labelStyle} htmlFor="plan-proposal-reason">
          제안 이유 / 한 줄 요약 (선택)
        </label>
        <input
          id="plan-proposal-reason"
          type="text"
          placeholder="예: 이동을 줄이고 서귀포 호텔에서 여유를 즐기는 안"
          value={proposalReason}
          onChange={(e) => onProposalReasonChange(e.target.value)}
          css={inputStyle}
        />
      </div>

      <div css={fieldStyle}>
        <fieldset
          css={headcountWrapperStyle}
          aria-describedby="plan-headcount-hint"
        >
          <legend css={labelStyle}>비용 기준 인원 *</legend>
          <button
            type="button"
            css={headcountButtonStyle}
            aria-label="비용 기준 인원 한 명 줄이기"
            disabled={baseHeadcount <= 1}
            onClick={() =>
              onBaseHeadcountChange(Math.max(1, baseHeadcount - 1))
            }
          >
            <span aria-hidden="true">-</span>
          </button>
          <span css={headcountValueStyle} aria-live="polite">
            {baseHeadcount}명
          </span>
          <button
            type="button"
            css={headcountButtonStyle}
            aria-label="비용 기준 인원 한 명 늘리기"
            disabled={baseHeadcount >= 20}
            onClick={() => onBaseHeadcountChange(baseHeadcount + 1)}
          >
            <span aria-hidden="true">+</span>
          </button>
        </fieldset>
        <span css={headcountHintStyle} id="plan-headcount-hint">
          이 인원을 기준으로 1인 예상 참고액이 자동 계산됩니다.
        </span>
      </div>
    </section>
  );
}
