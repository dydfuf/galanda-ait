import { css } from "@emotion/react";
import { BottomSheet, useBottomSheet } from "@toss/tds-mobile";

const headerStyle = css`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  /* 좁은 화면에서 제목과 자동 저장 상태가 한 줄에 다 들어가지 않으면 줄바꿈해요. */
  flex-wrap: wrap;
  margin-bottom: 20px;
`;

const titleAreaStyle = css`
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1 1 200px;
  min-width: 0;
`;

const titleStyle = css`
  font-size: 20px;
  font-weight: 700;
  color: var(--adaptiveGrey900, #191f28);
  margin: 0;
`;

const subtitleStyle = css`
  font-size: 13px;
  color: var(--adaptiveGrey600, #6b7684);
  margin: 0;
`;

const autoSaveStatusStyle = css`
  font-size: 12px;
  color: var(--adaptiveGrey500, #8b95a1);
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background-color: var(--adaptiveGrey100, #f2f4f6);
  border-radius: 6px;
  white-space: nowrap;
`;

const clearButtonStyle = css`
  background: none;
  border: none;
  font-size: 12px;
  color: var(--adaptiveRed500, #f04452);
  cursor: pointer;
  padding: 4px;
  text-decoration: underline;

  &:hover {
    opacity: 0.8;
  }
`;

const actionAreaStyle = css`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
  flex: 0 0 auto;
`;

interface PlanEditorHeaderProps {
  readonly isEditMode: boolean;
  readonly isCloneMode: boolean;
  readonly lastSavedTime: Date;
  readonly onClearDraft?: () => void;
}

export function PlanEditorHeader({
  isEditMode,
  isCloneMode,
  lastSavedTime: _lastSavedTime,
  onClearDraft,
}: PlanEditorHeaderProps) {
  const { openAsyncTwoButtonSheet } = useBottomSheet();

  const handleClearDraft = async (): Promise<void> => {
    if (!onClearDraft) return;

    const action = await openAsyncTwoButtonSheet({
      header: <BottomSheet.Header>작성 내용을 초기화할까요?</BottomSheet.Header>,
      children: (
        <BottomSheet.HeaderDescription>
          지금까지 입력한 여행안 내용이 사라집니다.
        </BottomSheet.HeaderDescription>
      ),
      leftButton: "취소",
      rightButton: "초기화하기",
    });

    if (action === "rightButtonClick") {
      onClearDraft();
    }
  };

  return (
    <header css={headerStyle}>
      <div css={titleAreaStyle}>
        <h1 css={titleStyle}>
          {isEditMode ? "여행안 수정하기" : isCloneMode ? "복제해 새 대안 제안하기" : "새 여행안 제안하기"}
        </h1>
        <p css={subtitleStyle}>
          {isEditMode
            ? "작성한 여행안의 세부 조건을 보완합니다."
            : isCloneMode
            ? "기존 안을 바탕으로 날짜, 도시, 숙소 조건을 바꾼 대안을 만듭니다."
            : "방문 도시와 숙소/교통 조건을 구성해 친구들과 비교해보세요."}
        </p>
      </div>

      <div css={actionAreaStyle}>
        <span css={autoSaveStatusStyle}>
          ✓ 자동 저장됨
        </span>
        {onClearDraft && (
          <button type="button" onClick={() => void handleClearDraft()} css={clearButtonStyle}>
            작성 초기화
          </button>
        )}
      </div>
    </header>
  );
}
