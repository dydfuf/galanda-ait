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
import {
  getDraftSaveStatusLabel,
  type DraftSaveStatus,
} from "../hooks/usePlanEditorState.ts";

interface PlanEditorHeaderProps {
  readonly isEditMode: boolean;
  readonly isCloneMode: boolean;
  readonly draftSaveStatus: DraftSaveStatus;
  readonly onClearDraft?: () => void;
}

export function PlanEditorHeader({
  isEditMode,
  isCloneMode,
  draftSaveStatus,
  onClearDraft,
}: PlanEditorHeaderProps) {
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);

  return (
    <header
      className="mb-6 flex min-w-0 flex-wrap items-start justify-between gap-4"
      data-galanda-surface="content"
    >
      <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-1.5">
        <h1 className="min-w-0 text-[22px] leading-tight font-bold text-foreground [overflow-wrap:anywhere]">
          {isEditMode
            ? "여행안 수정하기"
            : isCloneMode
              ? "복제해 새 대안 제안하기"
              : "새 여행안 제안하기"}
        </h1>
        <p className="min-w-0 text-base leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
          {isEditMode
            ? "작성한 여행안의 세부 조건을 보완합니다."
            : isCloneMode
              ? "기존 안을 바탕으로 날짜, 도시, 숙소 조건을 바꾼 대안을 만듭니다."
              : "방문 도시와 숙소/교통 조건을 구성해 친구들과 비교해보세요."}
        </p>
      </div>

      <div className="flex min-w-0 shrink-0 flex-col items-end gap-2">
        <output
          className={`flex min-h-(--touch-target-min) max-w-full min-w-0 items-center rounded-lg px-3 py-2 text-base leading-snug font-medium [overflow-wrap:anywhere] ${
            draftSaveStatus === "ERROR"
              ? "bg-destructive-muted text-destructive-strong"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {getDraftSaveStatusLabel(draftSaveStatus)}
        </output>
        {onClearDraft && (
          <button
            type="button"
            onClick={() => setIsClearConfirmOpen(true)}
            className="min-h-(--touch-target-min) min-w-(--touch-target-min) cursor-pointer rounded-lg px-3 py-2 text-base font-medium text-destructive underline underline-offset-4 hover:bg-destructive-muted"
          >
            작성 초기화
          </button>
        )}
      </div>

      <AlertDialog
        open={isClearConfirmOpen}
        onOpenChange={setIsClearConfirmOpen}
      >
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
