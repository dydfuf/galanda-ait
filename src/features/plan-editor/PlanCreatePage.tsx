import { useState } from "react";
import { css } from "@emotion/react";
import { FixedBottomCTA } from "@toss/tds-mobile";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Result } from "effect";
import { decodeRouteParams, TripParamsSchema } from "../../app/routes/route-params.ts";
import { RouteErrorFallback } from "../common/RouteErrorFallback.tsx";
import { fixedCtaContainerStyle } from "../common/tds-layout.ts";
import { useTripRoomRawQuery } from "../plan-detail/queries.ts";
import { usePlanEditorState } from "./hooks/usePlanEditorState.ts";
import { PlanEditorHeader } from "./components/PlanEditorHeader.tsx";
import { DiffBanner } from "./components/DiffBanner.tsx";
import { BasicInfoSection } from "./components/BasicInfoSection.tsx";
import { RouteCitySection } from "./components/RouteCitySection.tsx";
import { AccommodationSection } from "./components/AccommodationSection.tsx";
import { TransportSection } from "./components/TransportSection.tsx";
import { CostSummarySection } from "./components/CostSummarySection.tsx";
import { ValidationBanner } from "./components/ValidationBanner.tsx";
import { useCreatePlanMutation } from "./mutations.ts";
import { PlanIdSchema } from "../../core/domain/ids.ts";
import type { TripPlan } from "../../core/domain/room.ts";
import { toUserMessage } from "../common/error-message.ts";

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

/** 고정 CTA 위(topAccessory)에 놓이므로 문단이 아닌 인라인 요소로 렌더링해요. */
const errorMessageStyle = css`
  display: block;
  font-size: 13px;
  color: var(--adaptiveRed600, #e0383e);
  margin: 8px 0 0 0;
  text-align: center;
  line-height: 1.5;
`;

export function PlanCreatePage(): JSX.Element {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const cloneFromPlanId = searchParams.get("cloneFrom");

  const validated = decodeRouteParams(TripParamsSchema, params);
  const tripId = Result.isSuccess(validated) ? validated.success.tripId : "";

  const { data: room, isLoading, isError } = useTripRoomRawQuery(tripId);
  const createPlanMutation = useCreatePlanMutation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 복제 원본 플랜 찾기
  const cloneFromPlan = room?.plans.find((p) => p.id === cloneFromPlanId);

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
    diffFromOriginal,
    validation,
    lastSavedTime,
    clearDraft,
  } = usePlanEditorState(room, undefined, cloneFromPlan);

  if (Result.isFailure(validated)) {
    return <RouteErrorFallback message="유효하지 않은 여행방 식별자입니다." />;
  }

  if (isLoading) {
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

  const handleSubmit = async (): Promise<void> => {
    if (!validation.isValid || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const newPlanId = PlanIdSchema.make(`plan-${Date.now()}`);

      const newPlan: TripPlan = {
        id: newPlanId,
        title: title.trim(),
        status: "DRAFT",
        proposalReason: proposalReason.trim() || undefined,
        baseHeadcount,
        routes: routes.map((r) => ({ city: r.city.trim(), nights: r.nights })),
        accommodations: [...accommodations],
        transports: [...transports],
        places: [],
        clonedFromPlanId: cloneFromPlan ? cloneFromPlan.id : undefined,
        differenceSummary: diffFromOriginal?.hasChanges ? diffFromOriginal.summaryText : undefined,
        voteCount: 0,
      };

      await createPlanMutation.mutateAsync({
        roomId: tripId,
        plan: newPlan,
        expectedRevision: room.revision,
      });

      clearDraft();
      navigate(`/trips/${tripId}/plans/${newPlan.id}`, { replace: true });
    } catch (err: unknown) {
      // 비로그인·권한 부족 등 작성 실패 사유를 화면에 그대로 전달한다
      setIsSubmitting(false);
      setErrorMsg(toUserMessage(err, "여행안을 등록하지 못했어요. 다시 시도해주세요."));
    }
  };

  return (
    <div css={pageContainerStyle}>
      <PlanEditorHeader
        isEditMode={false}
        isCloneMode={Boolean(cloneFromPlan)}
        lastSavedTime={lastSavedTime}
        onClearDraft={clearDraft}
      />

      {cloneFromPlan && diffFromOriginal && (
        <DiffBanner diff={diffFromOriginal} originalTitle={cloneFromPlan.title} />
      )}

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
          differenceSummary={diffFromOriginal?.summaryText}
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
          validation.firstError || errorMsg ? (
            <>
              {validation.firstError && (
                <ValidationBanner
                  firstError={validation.firstError}
                  errorCount={validation.errorCount}
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
        disabled={!validation.isValid || isSubmitting}
        onClick={() => void handleSubmit()}
      >
        {isSubmitting
          ? "등록 중..."
          : cloneFromPlan
          ? "대안 여행안 제안하기"
          : "여행안 제안 등록"}
      </FixedBottomCTA>
    </div>
  );
}
