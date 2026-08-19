import { useState } from "react";
import { css } from "@emotion/react";
import { FixedBottomCTA } from "@toss/tds-mobile";
import { useParams, useNavigate } from "react-router-dom";
import { Result } from "effect";
import { decodeRouteParams, PlanParamsSchema } from "../../app/routes/route-params.ts";
import { RouteErrorFallback } from "../common/RouteErrorFallback.tsx";
import { fixedCtaContainerStyle } from "../common/tds-layout.ts";
import { useTripRoomRawQuery } from "../plan-detail/queries.ts";
import { usePlanEditorState } from "./hooks/usePlanEditorState.ts";
import { PlanEditorHeader } from "./components/PlanEditorHeader.tsx";
import { BasicInfoSection } from "./components/BasicInfoSection.tsx";
import { RouteCitySection } from "./components/RouteCitySection.tsx";
import { AccommodationSection } from "./components/AccommodationSection.tsx";
import { TransportSection } from "./components/TransportSection.tsx";
import { CostSummarySection } from "./components/CostSummarySection.tsx";
import { ValidationBanner } from "./components/ValidationBanner.tsx";
import { useUpdatePlanMutation } from "./mutations.ts";
import type { TripPlan } from "../../core/domain/room.ts";

const pageContainerStyle = css`
  padding: 16px 20px 24px;
  max-width: 640px;
  width: 100%;
  min-width: 0;
  margin: 0 auto;
  box-sizing: border-box;
`;

const loadingContainerStyle = css`
  padding: 40px 20px;
  text-align: center;
  color: var(--adaptiveGrey600, #6b7684);
  font-size: 15px;
`;

export function PlanEditPage() {
  const params = useParams();
  const navigate = useNavigate();

  const validated = decodeRouteParams(PlanParamsSchema, params);
  const tripId = Result.isSuccess(validated) ? validated.success.tripId : "";
  const planId = Result.isSuccess(validated) ? validated.success.planId : "";

  const { data: room, isLoading, isError } = useTripRoomRawQuery(tripId);
  const updatePlanMutation = useUpdatePlanMutation();
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

  if (isLoading) {
    return <div css={loadingContainerStyle}>여행안 정보를 불러오는 중입니다...</div>;
  }

  if (isError || !room || !plan) {
    return (
      <RouteErrorFallback
        title="수정할 여행안을 찾을 수 없습니다"
        message="요청하신 정보가 없거나 삭제되었습니다."
      />
    );
  }

  const handleSubmit = async () => {
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
    } catch {
      setIsSubmitting(false);
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

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit();
        }}
      >
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

      </form>

      {/* 화면 하단 고정 CTA: safe-area와 모바일 키보드는 TDS가 처리해요. */}
      <FixedBottomCTA
        containerStyle={fixedCtaContainerStyle}
        topAccessory={
          validation.firstError ? (
            <ValidationBanner
              firstError={validation.firstError}
              errorCount={validation.errorCount}
            />
          ) : undefined
        }
        disabled={!validation.isValid || isSubmitting}
        onClick={() => void handleSubmit()}
      >
        {isSubmitting ? "수정 반영 중..." : "수정안 반영하기"}
      </FixedBottomCTA>
    </div>
  );
}
