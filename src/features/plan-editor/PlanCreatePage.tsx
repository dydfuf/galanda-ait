import { useState } from "react";
import { css } from "@emotion/react";
import { Button } from "@toss/tds-mobile";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Result } from "effect";
import { decodeRouteParams, TripParamsSchema } from "../../app/routes/route-params.ts";
import { RouteErrorFallback } from "../common/RouteErrorFallback.tsx";
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
import { PlanIdSchema, UserIdSchema } from "../../core/domain/ids.ts";
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

export function PlanCreatePage() {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const cloneFromPlanId = searchParams.get("cloneFrom");

  const validated = decodeRouteParams(TripParamsSchema, params);
  const tripId = Result.isSuccess(validated) ? validated.success.tripId : "";

  const { data: room, isLoading, isError } = useTripRoomRawQuery(tripId);
  const createPlanMutation = useCreatePlanMutation();
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validation.isValid || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const hostUser = room.members[0];
      const authorId = hostUser?.id || UserIdSchema.make("user-local-me");
      const authorName = hostUser?.name || "나";
      const newPlanId = PlanIdSchema.make(`plan-${Date.now()}`);

      const newPlan: TripPlan = {

        id: newPlanId,
        title: title.trim(),
        status: "DRAFT",
        proposalReason: proposalReason.trim() || undefined,
        authorId,
        authorName,
        baseHeadcount,
        routes: routes.map((r) => ({ city: r.city.trim(), nights: r.nights })),
        accommodations: [...accommodations],
        transports: [...transports],
        places: [],
        clonedFromPlanId: cloneFromPlan ? cloneFromPlan.id : undefined,
        differenceSummary: diffFromOriginal?.hasChanges ? diffFromOriginal.summaryText : undefined,
        memberOpinions: [
          {
            userId: authorId,
            userName: authorName,
            reaction: "LIKE",
          },
        ],
        voteCount: 1,
      };


      await createPlanMutation.mutateAsync({
        roomId: tripId,
        plan: newPlan,
        expectedRevision: room.revision,
      });

      clearDraft();
      navigate(`/trips/${tripId}/plans/${newPlan.id}`, { replace: true });
    } catch {
      setIsSubmitting(false);
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

        <div css={bottomCTAWrapperStyle}>
          <ValidationBanner
            firstError={validation.firstError}
            errorCount={validation.errorCount}
          />
          <Button
            display="block"
            size="large"
            type="submit"
            disabled={!validation.isValid || isSubmitting}
          >
            {isSubmitting
              ? "등록 중..."
              : cloneFromPlan
              ? "대안 여행안 제안하기"
              : "여행안 제안 등록"}
          </Button>
        </div>
      </form>
    </div>
  );
}
