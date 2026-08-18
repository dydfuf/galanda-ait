import { useState } from "react";
import { css } from "@emotion/react";
import { Button } from "@toss/tds-mobile";
import { useParams, useNavigate } from "react-router-dom";
import { Result } from "effect";
import { decodeRouteParams, PlanParamsSchema } from "../../app/routes/route-params.ts";
import { RouteErrorFallback } from "../common/RouteErrorFallback.tsx";
import { useSessionQuery } from "../../hooks/useSession.ts";
import { toUserMessage } from "../common/error-message.ts";
import { canManagePlan } from "../../core/domain/auth-guards.ts";
import { useTripRoomRawQuery } from "../plan-detail/queries.ts";
import { usePlanEditorState } from "./hooks/usePlanEditorState.ts";
import { PlanEditorHeader } from "./components/PlanEditorHeader.tsx";
import { BasicInfoSection } from "./components/BasicInfoSection.tsx";
import { RouteCitySection } from "./components/RouteCitySection.tsx";
import { AccommodationSection } from "./components/AccommodationSection.tsx";
import { TransportSection } from "./components/TransportSection.tsx";
import { CostSummarySection } from "./components/CostSummarySection.tsx";
import { ValidationBanner } from "./components/ValidationBanner.tsx";
import { useUpdatePlanMutation, useDeletePlanMutation } from "./mutations.ts";
import type { TripPlan } from "../../core/domain/room.ts";

const pageContainerStyle = css`
  padding: 16px 20px calc(48px + env(safe-area-inset-bottom, 0px));
  max-width: 640px;
  margin: 0 auto;
`;

const loadingContainerStyle = css`
  padding: 40px 20px;
  text-align: center;
  color: var(--adaptiveGrey600, #6b7684);
  font-size: 15px;
`;

const bottomCTAWrapperStyle = css`
  position: sticky;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0) 0%, var(--adaptiveBackground, #ffffff) 20%);
  padding: 16px 0 env(safe-area-inset-bottom, 0px);
  margin-top: 16px;
`;

export function PlanEditPage(): JSX.Element {
  const params = useParams();
  const navigate = useNavigate();

  const validated = decodeRouteParams(PlanParamsSchema, params);
  const tripId = Result.isSuccess(validated) ? validated.success.tripId : "";
  const planId = Result.isSuccess(validated) ? validated.success.planId : "";

  const {
    data: session,
    isLoading: isSessionLoading,
    isError: isSessionError,
    error: sessionError,
  } = useSessionQuery();
  const { data: room, isLoading: isRoomLoading, isError } = useTripRoomRawQuery(tripId);
  const updatePlanMutation = useUpdatePlanMutation();
  const deletePlanMutation = useDeletePlanMutation();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const plan = room?.plans.find((p) => p.id === planId);

  const {
    title,
    setTitle,
    proposalReason,
    setProposalReason,
    baseHeadcount,
    setBaseHeadcount,
    routes,
    totalTripNights,
    currentTotalNights,
    handleAddCity,
    handleUpdateCity,
    handleRemoveCity,
    accommodations,
    handleAddAccommodation,
    handleUpdateAccommodation,
    handleRemoveAccommodation,
    transports,
    handleAddTransport,
    handleUpdateTransport,
    handleRemoveTransport,
    costSummary,
    validation,
    lastSavedTime,
    clearDraft,
  } = usePlanEditorState(room, plan, undefined);

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
  const canManage = canManagePlan(room, plan, session?.userId);
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
  const isConfirmed = plan.id === room.confirmedPlanId || plan.status === "CONFIRMED";
  if (isConfirmed) {
    return (
      <RouteErrorFallback
        title="확정된 여행안은 수정할 수 없습니다"
        message="이미 확정된 여행안은 세부 일정을 변경할 수 없습니다."
        actionText="여행안 상세로 돌아가기"
        onAction={() => navigate(`/trips/${tripId}/plans/${planId}`, { replace: true })}
      />
    );
  }

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!validation.isValid || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const updatedPlan: TripPlan = {
        ...plan,
        title: title.trim(),
        proposalReason: proposalReason.trim() || undefined,
        baseHeadcount,
        routes: routes.map((r) => ({ city: r.city.trim(), nights: r.nights })),
        accommodations: [...accommodations],
        transports: [...transports],
      };

      await updatePlanMutation.mutateAsync({
        roomId: tripId,
        plan: updatedPlan,
        expectedRevision: room.revision,
      });

      clearDraft();
      navigate(`/trips/${tripId}/plans/${plan.id}`, { replace: true });
    } catch (err: unknown) {
      setIsSubmitting(false);
      alert(toUserMessage(err, "여행안 수정에 실패했습니다."));
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (!window.confirm(`'${plan.title}' 여행안을 삭제하시겠습니까?`)) {
      return;
    }
    try {
      await deletePlanMutation.mutateAsync({
        roomId: tripId,
        planId: plan.id,
        expectedRevision: room.revision,
      });
      clearDraft();
      navigate(`/trips/${tripId}/plans`, { replace: true });
    } catch (err: unknown) {
      alert(toUserMessage(err, "여행안 삭제에 실패했습니다."));
    }
  };

  return (
    <div css={pageContainerStyle}>
      <PlanEditorHeader
        isEditMode={true}
        isCloneMode={false}
        lastSavedTime={lastSavedTime}
        onClearDraft={clearDraft}
      />

      <form onSubmit={handleSubmit}>
        <BasicInfoSection
          title={title}
          onTitleChange={setTitle}
          proposalReason={proposalReason}
          onProposalReasonChange={setProposalReason}
          baseHeadcount={baseHeadcount}
          onBaseHeadcountChange={setBaseHeadcount}
        />

        <RouteCitySection
          routes={routes}
          totalTripNights={totalTripNights}
          currentTotalNights={currentTotalNights}
          onAddCity={handleAddCity}
          onUpdateCity={handleUpdateCity}
          onRemoveCity={handleRemoveCity}
        />

        <AccommodationSection
          accommodations={accommodations}
          routes={routes}
          onAdd={handleAddAccommodation}
          onUpdate={handleUpdateAccommodation}
          onRemove={handleRemoveAccommodation}
        />

        <TransportSection
          transports={transports}
          onAdd={handleAddTransport}
          onUpdate={handleUpdateTransport}
          onRemove={handleRemoveTransport}
        />

        <CostSummarySection costSummary={costSummary} />

        <div css={bottomCTAWrapperStyle}>
          <ValidationBanner
            firstError={validation.firstError}
            errorCount={validation.errorCount}
          />
          <div style={{ display: "flex", gap: "8px" }}>
            <Button
              display="block"
              size="large"
              type="button"
              color="danger"
              style={{ flex: 1 }}
              onClick={handleDelete}
              disabled={isSubmitting}
            >
              삭제하기
            </Button>
            <Button
              display="block"
              size="large"
              type="submit"
              style={{ flex: 2 }}
              disabled={!validation.isValid || isSubmitting}
            >
              {isSubmitting ? "수정 반영 중..." : "수정안 반영하기"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
