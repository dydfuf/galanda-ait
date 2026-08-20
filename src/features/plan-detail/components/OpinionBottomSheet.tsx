import { useEffect, useState } from "react";
import { css } from "@emotion/react";
import { BottomSheet, TextArea, TextButton } from "@toss/tds-mobile";
import { visuallyHiddenStyle } from "../../common/a11y.ts";

export type ReactionType = "LIKE" | "OKAY" | "HARD";

interface OpinionBottomSheetProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly initialReaction?: ReactionType;
  readonly initialReason?: string;
  readonly onSubmit: (reaction: ReactionType, reason?: string) => void;
  readonly isSubmitting?: boolean;
}

const REACTION_OPTIONS = [
  { value: "LIKE", emoji: "👍", label: "좋아요" },
  { value: "OKAY", emoji: "🙂", label: "괜찮아요" },
  { value: "HARD", emoji: "😢", label: "어려워요" },
] as const satisfies ReadonlyArray<{
  value: ReactionType;
  emoji: string;
  label: string;
}>;

const contentStyle = css`
  padding-bottom: 16px;
`;

const sheetHeaderStyle = css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
`;

const reactionGroupStyle = css`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  padding: 4px 0 20px;
`;

const reactionOptionStyle = (isSelected: boolean) => css`
  display: flex;
  min-height: 76px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1px solid ${isSelected ? "var(--adaptiveBlue500, #3182f6)" : "var(--adaptiveGrey200, #e5e8eb)"};
  border-radius: 12px;
  background: ${isSelected ? "var(--adaptiveBlue50, #e8f3ff)" : "var(--adaptiveBackground, #ffffff)"};
  cursor: pointer;

  &:has(:focus-visible) {
    outline: 2px solid var(--adaptiveBlue500, #3182f6);
    outline-offset: 2px;
  }
`;

const emojiStyle = css`
  font-size: 24px;
`;

const labelStyle = (isSelected: boolean) => css`
  color: ${isSelected ? "var(--adaptiveBlue600, #1b64da)" : "var(--adaptiveGrey800, #333d4b)"};
  font-size: 13px;
  font-weight: 700;
`;

export function OpinionBottomSheet({
  isOpen,
  onClose,
  initialReaction,
  initialReason = "",
  onSubmit,
  isSubmitting = false,
}: OpinionBottomSheetProps) {
  const [reaction, setReaction] = useState<ReactionType | undefined>(initialReaction);
  const [reason, setReason] = useState(initialReason);

  useEffect(() => {
    if (!isOpen) return;
    setReaction(initialReaction);
    setReason(initialReason);
  }, [isOpen, initialReaction, initialReason]);

  const isFormValid = Boolean(reaction) && (reaction !== "HARD" || reason.trim().length > 0);
  const handleSubmit = (): void => {
    if (!reaction || !isFormValid || isSubmitting) return;
    onSubmit(reaction, reaction === "HARD" ? reason.trim() : undefined);
  };

  return (
    <BottomSheet
      open={isOpen}
      onClose={onClose}
      header={
        <BottomSheet.Header>
          <span css={sheetHeaderStyle}>
            <span>이 여행안은 어때요?</span>
            <TextButton size="small" variant="clear" onClick={onClose}>
              닫기
            </TextButton>
          </span>
        </BottomSheet.Header>
      }
      headerDescription={
        <BottomSheet.HeaderDescription>내 의견은 언제든 바꿀 수 있어요.</BottomSheet.HeaderDescription>
      }
      cta={
        <BottomSheet.CTA disabled={!isFormValid || isSubmitting} onClick={handleSubmit}>
          {isSubmitting ? "저장 중..." : "의견 저장하기"}
        </BottomSheet.CTA>
      }
      maxHeight="70vh"
      expandedMaxHeight="90vh"
      expandBottomSheet
    >
      <div css={contentStyle}>
        <div role="radiogroup" aria-label="이 여행안에 대한 내 의견" css={reactionGroupStyle}>
          {REACTION_OPTIONS.map((option) => {
            const isSelected = reaction === option.value;

            return (
              <label key={option.value} css={reactionOptionStyle(isSelected)}>
                <input
                  type="radio"
                  name="opinion-reaction"
                  value={option.value}
                  checked={isSelected}
                  onChange={() => setReaction(option.value)}
                  css={visuallyHiddenStyle}
                />
                <span css={emojiStyle} aria-hidden="true">{option.emoji}</span>
                <span css={labelStyle(isSelected)}>{option.label}</span>
              </label>
            );
          })}
        </div>

        {reaction === "HARD" && (
          <TextArea
            variant="box"
            label="어려운 이유"
            labelOption="sustain"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="예: 예산, 숙소 위치, 이동 시간 등"
            help="방장과 나에게만 공개돼요."
            rows={3}
            required
          />
        )}
      </div>
    </BottomSheet>
  );
}
