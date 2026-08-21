import { useState } from "react";
import { css } from "@emotion/react";
import { useLocation, useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Result } from "effect";
import { decodeRouteParams, TripParamsSchema } from "../../app/routes/route-params.ts";
import { RouteErrorFallback } from "../common/RouteErrorFallback.tsx";
import { BottomAction } from "@/components/galanda/bottom-action.tsx";
import { Button } from "@/components/ui/button.tsx";
import { useTripRoomRawQuery } from "../plan-detail/queries.ts";
import { useSessionQuery } from "../../hooks/useSession.ts";
import { usePlanEditorState } from "./hooks/usePlanEditorState.ts";
import { PlanEditorSections } from "./components/PlanEditorSections.tsx";
import { isPlanEditorSection, type PlanEditorSection } from "./plan-editor-section.ts";
import { ValidationBanner } from "./components/ValidationBanner.tsx";
import { useCreatePlanMutation } from "./mutations.ts";
import { toUserMessage } from "../common/error-message.ts";

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

/** 고정 CTA 위(topAccessory)에 놓이므로 문단이 아닌 인라인 요소로 렌더링해요. */
const errorMessageStyle = css`
  display: block;
  font-size: 13px;
  color: var(--destructive-strong);
  margin: 8px 0 0 0;
  text-align: center;
  line-height: 1.5;
`;

export function PlanCreatePage(): JSX.Element {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const cloneFromPlanId = searchParams.get("cloneFrom");
  const section = isPlanEditorSection(params.section) ? params.section : undefined;

  const validated = decodeRouteParams(TripParamsSchema, params);
  const tripId = Result.isSuccess(validated) ? validated.success.tripId : "";

  const { data: room, isLoading, isError } = useTripRoomRawQuery(tripId);
  const {
    data: session,
    isLoading: isSessionLoading,
    isError: isSessionError,
    error: sessionError,
  } = useSessionQuery();
  const createPlanMutation = useCreatePlanMutation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 복제 원본 플랜 찾기
  const cloneFromPlan = room?.plans.find((p) => p.id === cloneFromPlanId);

  const editor = usePlanEditorState(room, undefined, cloneFromPlan, session?.userId);

  if (Result.isFailure(validated)) {
    return <RouteErrorFallback message="유효하지 않은 여행방 식별자입니다." />;
  }

  if (isLoading || isSessionLoading) {
    return <div css={loadingContainerStyle}>여행방 정보를 불러오는 중입니다...</div>;
  }

  if (isError || !room) {
    return (
      <RouteErrorFallback
        title="여행방을 찾을 수 없습니다"
        message="요청하신 정보가 없거나 삭제되었습니다."
      />
    );
  }

  if (isSessionError || !session) {
    return (
      <RouteErrorFallback
        title="로그인 정보를 확인할 수 없습니다"
        message={isSessionError
          ? toUserMessage(sessionError, "잠시 후 다시 시도해주세요.")
          : "여행안을 작성하려면 로그인이 필요합니다."}
      />
    );
  }

  const handleSubmit = async (): Promise<void> => {
    if (!editor.validation.isValid || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const command = {
        title: editor.title.trim(),
        proposalReason: editor.proposalReason.trim() || undefined,
        baseHeadcount: editor.baseHeadcount,
        routes: editor.routes.map((r) => ({ ...r, city: r.city.trim() })),
        accommodations: [...editor.accommodations],
        transports: [...editor.transports],
        places: cloneFromPlan?.places ?? [],
        cloneFromPlanId: cloneFromPlan ? cloneFromPlan.id : undefined,
      };

      const updatedRoom = await createPlanMutation.mutateAsync({
        roomId: tripId,
        expectedRevision: room.revision,
        ...command,
      });

      editor.discardDraft();
      const createdPlan = updatedRoom.plans[updatedRoom.plans.length - 1];
      if (createdPlan) {
        await navigate(`/trips/${tripId}/plans/${createdPlan.id}`, { replace: true });
      }
    } catch (err: unknown) {
      // 비로그인·권한 부족 등 작성 실패 사유를 화면에 그대로 전달한다
      setIsSubmitting(false);
      setErrorMsg(toUserMessage(err, "여행안을 등록하지 못했어요. 다시 시도해주세요."));
    }
  };

  const editorBasePath = `/trips/${tripId}/plans/new`;
  const openSection = (nextSection: PlanEditorSection): void => {
    void navigate(`${editorBasePath}/${nextSection}${location.search}`, {
      state: { fromEditorSummary: true },
    });
  };
  const completeSection = (): void => {
    if ((location.state as { fromEditorSummary?: boolean } | null)?.fromEditorSummary) {
      void navigate(-1);
    } else {
      void navigate(`${editorBasePath}${location.search}`, { replace: true });
    }
  };

  return (
    <div css={pageContainerStyle}>
      <PlanEditorSections
        editor={editor}
        section={section}
        isEditMode={false}
        isCloneMode={Boolean(cloneFromPlan)}
        cloneTitle={cloneFromPlan?.title}
        onOpenSection={openSection}
        onCompleteSection={completeSection}
      />

      {/* 화면 하단 고정 CTA (safe-area는 BottomAction이 처리해요) */}
      {!section && !editor.draftConflict && (
        <BottomAction
          accessory={
            editor.validation.firstError || errorMsg ? (
              <>
                {editor.validation.firstError && (
                  <ValidationBanner
                    firstError={editor.validation.firstError}
                    errorCount={editor.validation.errorCount}
                  />
                )}
                {errorMsg && (
                  <span css={errorMessageStyle} role="alert">
                    {errorMsg}
                  </span>
                )}
              </>
            ) : undefined
          }
        >
          <Button
            type="button"
            size="xl"
            disabled={!editor.validation.isValid || isSubmitting}
            onClick={() => void handleSubmit()}
          >
            {isSubmitting
              ? "등록 중..."
              : cloneFromPlan
                ? "대안 여행안 제안하기"
                : "여행안 제안 등록"}
          </Button>
        </BottomAction>
      )}
    </div>
  );
}
