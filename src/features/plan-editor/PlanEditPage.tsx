import { useState } from "react";
import { css } from "@emotion/react";
import { BottomAction } from "@/components/galanda/bottom-action.tsx";
import { Button } from "@/components/ui/button.tsx";
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
import { useLocation, useParams, useNavigate } from "react-router-dom";
import { Result } from "effect";
import { decodeRouteParams, PlanParamsSchema } from "../../app/routes/route-params.ts";
import { RouteErrorFallback } from "../common/RouteErrorFallback.tsx";
import { useSessionQuery } from "../../hooks/useSession.ts";
import {
  isRevisionConflict,
  toRevisionConflictMessage,
  toUserMessage,
} from "../common/error-message.ts";
import {
  canManagePlan,
  canMutatePlan,
  isRoomConfirmed,
} from "../../core/domain/auth-guards.ts";
import { useTripRoomRawQuery } from "../plan-detail/queries.ts";
import { usePlanEditorState } from "./hooks/usePlanEditorState.ts";
import {
  PlanEditorSections,
  RevisionConflictChoice,
} from "./components/PlanEditorSections.tsx";
import { isPlanEditorSection, type PlanEditorSection } from "./plan-editor-section.ts";
import { ValidationBanner } from "./components/ValidationBanner.tsx";
import { useUpdatePlanMutation, useDeletePlanMutation } from "./mutations.ts";
import type { TripPlan } from "../../core/domain/room.ts";
import { calculatePlanDifference } from "../../core/calculations/plan-diff.ts";

const pageContainerStyle = css`
  padding: 16px 20px var(--app-cta-space, 112px);
  max-width: 640px;
  width: 100%;
  min-width: 0;
  margin: 0 auto;
  box-sizing: border-box;
`;

const loadingContainerStyle = css`
  padding: 40px 20px;
  text-align: center;
  color: var(--muted-foreground);
  font-size: 15px;
`;

const actionErrorStyle = css`
  display: block;
  color: var(--destructive-strong);
  font-size: 13px;
  line-height: 1.5;
  text-align: center;
`;

export function PlanEditPage(): JSX.Element {
  const params = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const section = isPlanEditorSection(params.section) ? params.section : undefined;

  const validated = decodeRouteParams(PlanParamsSchema, params);
  const tripId = Result.isSuccess(validated) ? validated.success.tripId : "";
  const planId = Result.isSuccess(validated) ? validated.success.planId : "";

  const {
    data: session,
    isLoading: isSessionLoading,
    isError: isSessionError,
    error: sessionError,
  } = useSessionQuery();
  const { data: room, isLoading: isRoomLoading, isError, refetch } = useTripRoomRawQuery(tripId);
  const updatePlanMutation = useUpdatePlanMutation();
  const deletePlanMutation = useDeletePlanMutation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [revisionConflict, setRevisionConflict] = useState<string>();
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  const plan = room?.plans.find((p) => p.id === planId);
  const isConfirmed = room ? isRoomConfirmed(room) : false;
  const canEdit = Boolean(
    room &&
    plan &&
    session &&
    canMutatePlan(room, plan, session.participantIds)
  );

  const editor = usePlanEditorState(
    room,
    plan,
    undefined,
    canEdit ? session?.participantId : undefined
  );

  if (Result.isFailure(validated)) {
    return <RouteErrorFallback message="유효하지 않은 여행안 경로입니다." />;
  }

  if (isRoomLoading || isSessionLoading) {
    return <div css={loadingContainerStyle}>여행안 정보를 불러오는 중입니다...</div>;
  }

  if (isError || !room) {
    return (
      <RouteErrorFallback
        title="여행 정보를 찾을 수 없습니다"
        message="요청하신 여행 정보가 없거나 삭제되었습니다."
        actionText="여행 목록으로 이동"
        onAction={() => navigate("/trips", { replace: true })}
      />
    );
  }

  // 1. 여행안 존재 여부 확인 (NotFoundError 대응)
  if (!plan) {
    return (
      <RouteErrorFallback
        title="수정할 여행안을 찾을 수 없습니다"
        message="요청하신 여행안이 존재하지 않거나 이미 삭제되었습니다."
        actionText="계획 목록으로 돌아가기"
        onAction={() => navigate(`/trips/${tripId}/plans`, { replace: true })}
      />
    );
  }

  // 2. 세션 조회 실패는 권한 없음이 아니라 일시적 장애로 안내한다
  if (isSessionError) {
    return (
      <RouteErrorFallback
        title="로그인 정보를 확인할 수 없습니다"
        message={toUserMessage(sessionError, "잠시 후 다시 시도해주세요.")}
        actionText="여행안 상세로 돌아가기"
        onAction={() => navigate(`/trips/${tripId}/plans/${planId}`, { replace: true })}
      />
    );
  }

  // 3. 작성자 소유권 또는 방장 관리 권한 확인 (UnauthorizedError 대응)
  const canManage = canManagePlan(room, plan, session?.participantIds);
  if (!session || !canManage) {
    return (
      <RouteErrorFallback
        title="수정 권한이 없습니다"
        message="여행안 작성자만 해당 여행안을 수정하거나 삭제할 수 있습니다."
        actionText="여행안 상세로 돌아가기"
        onAction={() => navigate(`/trips/${tripId}/plans/${planId}`, { replace: true })}
      />
    );
  }

  // 4. 확정 여부 확인
  if (isConfirmed) {
    return (
      <RouteErrorFallback
        title="확정된 여행에서는 여행안을 수정할 수 없습니다"
        message="확정 이후 변경은 확정 일정에서 진행해주세요."
        actionText="확정 일정 보기"
        onAction={() => navigate(`/trips/${tripId}/itinerary`, { replace: true })}
      />
    );
  }

  const handleSubmit = async (): Promise<void> => {
    if (!editor.validation.isValid || isSubmitting) return;

    setIsSubmitting(true);
    setActionError(null);
    setRevisionConflict(undefined);
    try {
      const updatedPlan: TripPlan = {
        ...plan,
        title: editor.title.trim(),
        proposalReason: editor.proposalReason.trim() || undefined,
        baseHeadcount: editor.baseHeadcount,
        routes: editor.routes.map((r) => ({ ...r, city: r.city.trim() })),
        accommodations: [...editor.accommodations],
        transports: [...editor.transports],
      };

      await updatePlanMutation.mutateAsync({
        roomId: tripId,
        plan: updatedPlan,
        expectedRevision: room.revision,
      });

      editor.discardDraft();
      navigate(`/trips/${tripId}/plans/${plan.id}`, { replace: true });
    } catch (err: unknown) {
      setIsSubmitting(false);
      if (isRevisionConflict(err)) {
        const latest = (await refetch()).data;
        const latestPlan = latest?.plans.find((candidate) => candidate.id === plan.id);
        const difference = latestPlan
          ? calculatePlanDifference(plan, latestPlan)
          : undefined;
        const changed = !latestPlan
          ? "이 여행안이 삭제됐습니다."
          : difference?.hasChanges
            ? `최신 공개본 변경: ${difference.summaryText}.`
            : "여행방의 다른 내용이 변경됐습니다.";
        setRevisionConflict(`${toRevisionConflictMessage(err)} ${changed} 작성 중인 입력은 보존했습니다.`);
      } else {
        setActionError(toUserMessage(err, "여행안 수정에 실패했습니다."));
      }
    }
  };

  const handleConfirmDelete = async (): Promise<void> => {
    if (isSubmitting || deletePlanMutation.isPending) {
      return;
    }

    try {
      await deletePlanMutation.mutateAsync({
        roomId: tripId,
        planId: plan.id,
        expectedRevision: room.revision,
      });
      editor.discardDraft();
      navigate(`/trips/${tripId}/plans`, { replace: true });
    } catch (err: unknown) {
      setIsDeleteConfirmOpen(false);
      if (isRevisionConflict(err)) {
        await refetch();
        setActionError(toRevisionConflictMessage(err));
      } else {
        setActionError(toUserMessage(err, "여행안 삭제에 실패했습니다."));
      }
    }
  };

  const editorBasePath = `/trips/${tripId}/plans/${planId}/edit`;
  const openSection = (nextSection: PlanEditorSection): void => {
    navigate(`${editorBasePath}/${nextSection}`, { state: { fromEditorSummary: true } });
  };
  const completeSection = (): void => {
    if ((location.state as { fromEditorSummary?: boolean } | null)?.fromEditorSummary) {
      navigate(-1);
    } else {
      navigate(editorBasePath, { replace: true });
    }
  };

  return (
    <div css={pageContainerStyle}>
      {revisionConflict ? (
        <RevisionConflictChoice
          message={revisionConflict}
          onReapply={() => setRevisionConflict(undefined)}
          onUseLatest={() => {
            editor.useLatestPublishedPlan();
            setRevisionConflict(undefined);
          }}
        />
      ) : (
        <PlanEditorSections
          editor={editor}
          section={section}
          isEditMode={true}
          isCloneMode={false}
          onOpenSection={openSection}
          onCompleteSection={completeSection}
        />
      )}

      {/* 화면 하단 고정 CTA (safe-area는 BottomAction이 처리해요) */}
      {!section && !editor.draftConflict && !revisionConflict && (
        <BottomAction
          accessory={
            editor.validation.firstError || actionError ? (
              <>
                {actionError && (
                  <span css={actionErrorStyle} role="alert">
                    {actionError}
                  </span>
                )}
                {editor.validation.firstError && (
                  <ValidationBanner
                    firstError={editor.validation.firstError}
                    errorCount={editor.validation.errorCount}
                  />
                )}
              </>
            ) : undefined
          }
        >
          <Button
            type="button"
            size="xl"
            variant="destructive"
            disabled={isSubmitting}
            onClick={() => setIsDeleteConfirmOpen(true)}
          >
            삭제하기
          </Button>
          <Button
            type="button"
            size="xl"
            disabled={!editor.validation.isValid || isSubmitting}
            onClick={() => void handleSubmit()}
          >
            {isSubmitting ? "수정 반영 중..." : "수정안 반영하기"}
          </Button>
        </BottomAction>
      )}

      {/* 여행안 삭제 confirm */}
      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>여행안을 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              '{plan.title}' 여행안과 작성한 내용이 삭제됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletePlanMutation.isPending}>취소</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deletePlanMutation.isPending}
              onClick={() => void handleConfirmDelete()}
            >
              {deletePlanMutation.isPending ? "삭제 중..." : "삭제하기"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
