import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";

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
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);

  return (
    <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 flex-[1_1_200px] flex-col gap-1">
        <h1 className="text-xl font-bold text-foreground">
          {isEditMode ? "여행안 수정하기" : isCloneMode ? "복제해 새 대안 제안하기" : "새 여행안 제안하기"}
        </h1>
        <p className="text-[13px] text-muted-foreground">
          {isEditMode
            ? "작성한 여행안의 세부 조건을 보완합니다."
            : isCloneMode
            ? "기존 안을 바탕으로 날짜, 도시, 숙소 조건을 바꾼 대안을 만듭니다."
            : "방문 도시와 숙소/교통 조건을 구성해 친구들과 비교해보세요."}
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <span className="flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs whitespace-nowrap text-muted-foreground">
          ✓ 자동 저장됨
        </span>
        {onClearDraft && (
          <button
            type="button"
            onClick={() => setIsClearConfirmOpen(true)}
            className="cursor-pointer p-1 text-xs text-destructive underline hover:opacity-80"
          >
            작성 초기화
          </button>
        )}
      </div>

      {/* 작성 초기화 confirm */}
      <AlertDialog open={isClearConfirmOpen} onOpenChange={setIsClearConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>작성 내용을 초기화할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              {isEditMode
                ? "임시 수정 내용만 사라지고 공개된 여행안은 바뀌지 않아요."
                : "지금 입력한 임시 내용이 사라지고 처음 상태로 돌아가요."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setIsClearConfirmOpen(false);
                onClearDraft?.();
              }}
            >
              초기화하기
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </header>
  );
}
