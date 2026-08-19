/*
 * 네이티브 <dialog>는 바텀시트의 레이아웃/애니메이션과 맞지 않아,
 * div + role="dialog" + aria-modal 조합에 포커스 트랩과 Escape 처리를 직접 붙였어요.
 */
/* oxlint-disable jsx-a11y/prefer-tag-over-role */
import { useEffect, useRef, useState } from "react";
import { css } from "@emotion/react";
import { Button } from "@toss/tds-mobile";
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
  {
    value: "LIKE",
    emoji: "👍",
    label: "좋아요",
    borderColor: "var(--adaptiveGreen500, #2da44e)",
    backgroundColor: "var(--adaptiveGreen50, #f0fbf4)",
    labelColor: "var(--adaptiveGreen600, #15803d)",
  },
  {
    value: "OKAY",
    emoji: "🙂",
    label: "괜찮아요",
    borderColor: "var(--adaptiveBlue500, #3182f6)",
    backgroundColor: "var(--adaptiveBlue50, #e8f3ff)",
    labelColor: "var(--adaptiveBlue600, #1b64da)",
  },
  {
    value: "HARD",
    emoji: "😢",
    label: "어려워요",
    borderColor: "var(--adaptiveRed500, #f04452)",
    backgroundColor: "var(--adaptiveRed50, #fdf2f3)",
    labelColor: "var(--adaptiveRed600, #e0383e)",
  },
] as const satisfies ReadonlyArray<{
  value: ReactionType;
  emoji: string;
  label: string;
  borderColor: string;
  backgroundColor: string;
  labelColor: string;
}>;

/** 바텀시트 안에서 키보드 포커스를 순환시킬 때 대상으로 삼는 요소들이에요. */
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * 시트를 닫은 뒤 원래 버튼으로 포커스를 되돌려요.
 *
 * 의견을 저장하면 시트가 닫히는 것과 동시에 시트를 연 CTA가 저장 중 상태로 비활성화돼서,
 * 그 시점의 `focus()`는 무시돼요. 저장이 얼마나 걸릴지 알 수 없으므로 시간을 재며 재시도하는 대신,
 * `disabled`가 풀리는 순간을 관찰해 그때 포커스를 되돌려요.
 *
 * 트리거가 사라졌거나 사용자가 이미 다른 요소로 이동했다면 포커스를 건드리지 않아요.
 *
 * @returns 관찰을 멈추는 함수
 */
function restoreFocusWhenPossible(trigger: HTMLElement): () => void {
  /** @returns 더 기다릴 필요가 없으면 `true` */
  const tryFocus = (): boolean => {
    const active = document.activeElement;
    if (!trigger.isConnected) return true;
    if (active != null && active !== document.body) return true;

    trigger.focus();
    return document.activeElement === trigger;
  };

  if (tryFocus()) {
    return () => {};
  }

  const observer = new MutationObserver(() => {
    if (tryFocus()) {
      observer.disconnect();
    }
  });
  observer.observe(trigger, { attributes: true, attributeFilter: ["disabled"] });

  return () => observer.disconnect();
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

const reactionFieldsetStyle = css`
  border: none;
  padding: 0;
  margin: 0;
  min-width: 0;
`;

const reactionGridStyle = css`
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 10px;
`;

const reactionOptionStyle = (isSelected: boolean, selectedBorder: string, selectedBg: string) => css`
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

  /* 라디오 입력을 화면에서 감췄기 때문에, 키보드 포커스를 라벨에 표시해요. */
  &:has(:focus-visible) {
    outline: 2px solid var(--adaptiveBlue500, #3182f6);
    outline-offset: 2px;
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
  const sheetRef = useRef<HTMLDivElement>(null);
  const lastFocusedElementRef = useRef<HTMLElement | null>(null);
  const stopFocusRestoreRef = useRef<(() => void) | null>(null);

  // 시트를 열 때마다 현재 저장된 의견을 기준으로 다시 시작해요.
  useEffect(() => {
    if (!isOpen) return;
    setReaction(initialReaction);
    setReason(initialReason);
  }, [isOpen, initialReaction, initialReason]);

  // 열릴 때 시트 안으로 포커스를 옮기고, 닫히면 원래 위치로 되돌려요.
  useEffect(() => {
    if (!isOpen) return;

    // 이전에 닫으면서 시작한 포커스 복귀 관찰이 남아 있으면 정리해요.
    stopFocusRestoreRef.current?.();
    stopFocusRestoreRef.current = null;

    lastFocusedElementRef.current = document.activeElement as HTMLElement | null;
    const firstFocusable = sheetRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    firstFocusable?.focus();

    return () => {
      const trigger = lastFocusedElementRef.current;
      if (trigger == null) return;

      stopFocusRestoreRef.current = restoreFocusWhenPossible(trigger);
    };
  }, [isOpen]);

  // 포커스 복귀 관찰이 남아 있는 채로 언마운트되지 않게 정리해요.
  useEffect(
    () => () => {
      stopFocusRestoreRef.current?.();
    },
    []
  );

  // Escape로 닫고, Tab 포커스가 시트 밖으로 빠져나가지 않게 순환시켜요.
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key !== "Tab") return;

      const focusables = Array.from(
        sheetRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? []
      );
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || !sheetRef.current?.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !sheetRef.current?.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reaction) return;
    if (reaction === "HARD" && !reason.trim()) return;
    onSubmit(reaction, reaction === "HARD" ? reason.trim() : undefined);
  };

  const isFormValid = reaction && (reaction !== "HARD" || reason.trim().length > 0);

  return (
    <div
      css={backdropContainerStyle}
      role="dialog"
      aria-modal="true"
      aria-labelledby="opinion-sheet-title"
    >
      {/* 백드롭 오버레이 (닫기는 아래 닫기 버튼과 Escape로도 가능해요) */}
      <div onClick={onClose} css={backdropOverlayStyle} aria-hidden="true" />

      {/* 바텀시트 컨테이너 */}
      <div css={sheetContainerStyle} ref={sheetRef}>
        <div css={sheetHeaderStyle}>
          <h3 id="opinion-sheet-title" css={sheetTitleStyle}>
            이 여행안은 어때요?
          </h3>
          <button type="button" onClick={onClose} css={closeButtonStyle} aria-label="닫기">
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} css={formStyle}>
          {/* 반응 선택 (라디오 그룹) */}
          <fieldset css={reactionFieldsetStyle}>
            <legend css={visuallyHiddenStyle}>이 여행안에 대한 내 의견</legend>

            <div css={reactionGridStyle}>
              {REACTION_OPTIONS.map((option) => {
                const isSelected = reaction === option.value;

                return (
                  <label
                    key={option.value}
                    css={reactionOptionStyle(isSelected, option.borderColor, option.backgroundColor)}
                  >
                    <input
                      type="radio"
                      name="opinion-reaction"
                      value={option.value}
                      checked={isSelected}
                      onChange={() => setReaction(option.value)}
                      css={visuallyHiddenStyle}
                    />
                    <span css={reactionEmojiStyle} aria-hidden="true">
                      {option.emoji}
                    </span>
                    <span css={reactionLabelStyle(isSelected, option.labelColor)}>
                      {option.label}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {/* 어려워요 선택 시 사유 입력란 */}
          {reaction === "HARD" && (
            <div css={reasonContainerStyle}>
              <label css={reasonLabelStyle} htmlFor="opinion-reason">
                어려운 사유를 알려주세요 *
              </label>
              <textarea
                id="opinion-reason"
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
