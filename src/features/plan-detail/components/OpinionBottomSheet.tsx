import { useState } from "react";
import { css } from "@emotion/react";
import { Button } from "@toss/tds-mobile";

export type ReactionType = "LIKE" | "OKAY" | "HARD";

interface OpinionBottomSheetProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly initialReaction?: ReactionType;
  readonly initialReason?: string;
  readonly onSubmit: (reaction: ReactionType, reason?: string) => void;
  readonly isSubmitting?: boolean;
}

const backdropContainerStyle = css`
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: flex-end;
  justify-content: center;
`;

const backdropOverlayStyle = css`
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
  animation: fadeIn 0.2s ease-out;
`;

const sheetContainerStyle = css`
  position: relative;
  z-index: 101;
  width: 100%;
  max-width: 480px;
  background-color: var(--adaptiveBackground, #ffffff);
  border-top-left-radius: 20px;
  border-top-right-radius: 20px;
  padding: 24px 20px calc(28px + env(safe-area-inset-bottom, 0px));
  box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.15);
  max-height: 85vh;
  max-height: 85dvh;
  overflow-y: auto;
  animation: slideUp 0.25s ease-out;
`;

const sheetHeaderStyle = css`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
`;

const sheetTitleStyle = css`
  font-size: 18px;
  font-weight: 700;
  color: var(--adaptiveGrey900, #191f28);
  margin: 0;
`;

const closeButtonStyle = css`
  background: none;
  border: none;
  font-size: 18px;
  color: var(--adaptiveGrey500, #8b95a1);
  cursor: pointer;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 18px;
  transition: background-color 0.15s ease;

  &:active {
    background-color: var(--adaptiveGrey100, #f2f4f6);
  }
`;

const formStyle = css`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const reactionGridStyle = css`
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 10px;
`;

const reactionButtonStyle = (isSelected: boolean, selectedBorder: string, selectedBg: string) => css`
  padding: 16px 8px;
  border-radius: 12px;
  border: ${isSelected ? `2px solid ${selectedBorder}` : "1px solid var(--adaptiveGrey200, #e5e8eb)"};
  background-color: ${isSelected ? selectedBg : "var(--adaptiveBackground, #ffffff)"};
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  transition: transform 0.12s ease, border-color 0.15s ease, background-color 0.15s ease;

  &:active {
    transform: scale(0.96);
  }
`;

const reactionEmojiStyle = css`
  font-size: 26px;
`;

const reactionLabelStyle = (isSelected: boolean, selectedColor: string) => css`
  font-size: 14px;
  font-weight: 700;
  color: ${isSelected ? selectedColor : "var(--adaptiveGrey800, #333d4b)"};
`;

const reasonContainerStyle = css`
  animation: fadeIn 0.2s ease;
`;

const reasonLabelStyle = css`
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--adaptiveGrey800, #333d4b);
  margin-bottom: 6px;
`;

const reasonTextareaStyle = css`
  width: 100%;
  padding: 12px;
  border-radius: 10px;
  border: 1px solid var(--adaptiveGrey200, #e5e8eb);
  font-size: 14px;
  font-family: inherit;
  outline: none;
  resize: none;
  box-sizing: border-box;
  background-color: var(--adaptiveBackground, #ffffff);
  color: var(--adaptiveGrey900, #191f28);
  transition: border-color 0.15s ease;

  &:focus {
    border-color: var(--adaptiveBlue500, #3182f6);
  }
`;

const submitWrapperStyle = css`
  margin-top: 4px;
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
  const [reason, setReason] = useState<string>(initialReason);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reaction) return;
    if (reaction === "HARD" && !reason.trim()) {
      alert("어려운 사유를 간략히 입력해주세요.");
      return;
    }
    onSubmit(reaction, reaction === "HARD" ? reason.trim() : undefined);
  };

  const isFormValid = reaction && (reaction !== "HARD" || reason.trim().length > 0);

  return (
    <div css={backdropContainerStyle} role="dialog" aria-modal="true" aria-labelledby="opinion-sheet-title">
      {/* 백드롭 오버레이 */}
      <div onClick={onClose} css={backdropOverlayStyle} />

      {/* 바텀시트 컨테이너 */}
      <div css={sheetContainerStyle}>
        <div css={sheetHeaderStyle}>
          <h3 id="opinion-sheet-title" css={sheetTitleStyle}>
            이 여행안은 어때요?
          </h3>
          <button type="button" onClick={onClose} css={closeButtonStyle} aria-label="닫기">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} css={formStyle}>
          {/* 반응 선택 버튼 3가지 */}
          <div css={reactionGridStyle}>
            <button
              type="button"
              onClick={() => setReaction("LIKE")}
              css={reactionButtonStyle(reaction === "LIKE", "var(--adaptiveGreen500, #2da44e)", "var(--adaptiveGreen50, #f0fbf4)")}
            >
              <span css={reactionEmojiStyle}>👍</span>
              <span css={reactionLabelStyle(reaction === "LIKE", "var(--adaptiveGreen600, #15803d)")}>
                좋아요
              </span>
            </button>

            <button
              type="button"
              onClick={() => setReaction("OKAY")}
              css={reactionButtonStyle(reaction === "OKAY", "var(--adaptiveBlue500, #3182f6)", "var(--adaptiveBlue50, #e8f3ff)")}
            >
              <span css={reactionEmojiStyle}>🙂</span>
              <span css={reactionLabelStyle(reaction === "OKAY", "var(--adaptiveBlue600, #1b64da)")}>
                괜찮아요
              </span>
            </button>

            <button
              type="button"
              onClick={() => setReaction("HARD")}
              css={reactionButtonStyle(reaction === "HARD", "var(--adaptiveRed500, #f04452)", "var(--adaptiveRed50, #fdf2f3)")}
            >
              <span css={reactionEmojiStyle}>😢</span>
              <span css={reactionLabelStyle(reaction === "HARD", "var(--adaptiveRed600, #e0383e)")}>
                어려워요
              </span>
            </button>
          </div>

          {/* 어려워요 선택 시 사유 입력란 */}
          {reaction === "HARD" && (
            <div css={reasonContainerStyle}>
              <label css={reasonLabelStyle}>
                어려운 사유를 알려주세요 *
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="예: 예산 초과, 숙소 위치, 이동 시간 등 (방장과 나에게만 공개돼요)"
                rows={3}
                css={reasonTextareaStyle}
                required
              />
            </div>
          )}

          {/* 제출 버튼 */}
          <div css={submitWrapperStyle}>
            <Button
              display="block"
              size="large"
              type="submit"
              disabled={!isFormValid || isSubmitting}
            >
              {isSubmitting ? "저장 중..." : "의견 저장하기"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
