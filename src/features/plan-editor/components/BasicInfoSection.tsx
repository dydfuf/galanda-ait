import { css } from "@emotion/react";

const cardStyle = css`
  background-color: var(--adaptiveBackground, #ffffff);
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  border: 1px solid var(--adaptiveGrey200, #e5e8eb);
  margin-bottom: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const fieldStyle = css`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const labelStyle = css`
  font-size: 13px;
  font-weight: 600;
  color: var(--adaptiveGrey700, #4e5968);
`;

const inputStyle = css`
  width: 100%;
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid var(--adaptiveGrey200, #e5e8eb);
  font-size: 14px;
  outline: none;
  box-sizing: border-box;
  background-color: var(--adaptiveBackground, #ffffff);
  color: var(--adaptiveGrey900, #191f28);
  transition: border-color 0.15s ease;

  &:focus {
    border-color: var(--adaptiveBlue500, #3182f6);
  }
`;

const headcountWrapperStyle = css`
  display: flex;
  align-items: center;
  gap: 12px;
  border: none;
  padding: 0;
  margin: 0;
  min-width: 0;
`;

const headcountButtonStyle = css`
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: 1px solid var(--adaptiveGrey300, #d1d6db);
  background-color: var(--adaptiveGrey50, #f9fafb);
  color: var(--adaptiveGrey900, #191f28);
  font-size: 16px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 0.15s ease;

  &:hover {
    background-color: var(--adaptiveGrey100, #f2f4f6);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;

const headcountValueStyle = css`
  font-size: 15px;
  font-weight: 700;
  color: var(--adaptiveGrey900, #191f28);
  min-width: 40px;
  text-align: center;
`;

const headcountHintStyle = css`
  font-size: 12px;
  color: var(--adaptiveGrey500, #8b95a1);
  margin-top: 2px;
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
    <section css={cardStyle}>
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
        <fieldset css={headcountWrapperStyle} aria-describedby="plan-headcount-hint">
          <legend css={labelStyle}>비용 기준 인원 *</legend>
          <button
            type="button"
            css={headcountButtonStyle}
            aria-label="비용 기준 인원 한 명 줄이기"
            disabled={baseHeadcount <= 1}
            onClick={() => onBaseHeadcountChange(Math.max(1, baseHeadcount - 1))}
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
