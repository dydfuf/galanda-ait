import { useParams, useNavigate } from "react-router-dom";
import { useTripRoomRawQuery } from "../plan-detail/queries.ts";
import { decodeRouteParams, TripParamsSchema } from "../../app/routes/route-params.ts";
import { RouteErrorFallback } from "../common/RouteErrorFallback.tsx";
import { toUserMessage } from "../common/error-message.ts";
import { useSessionQuery } from "../../hooks/useSession.ts";
import { Result } from "effect";
import { DecisionStatusBanner } from "../common/DecisionStatusBanner.tsx";
import { PageState } from "@/components/galanda/page-state.tsx";
import { PageBody } from "@/components/galanda/page-body.tsx";
import { PageTitle } from "@/components/galanda/page-title.tsx";
import { SectionHeader } from "@/components/galanda/section-header.tsx";
import { BottomAction } from "@/components/galanda/bottom-action.tsx";
import { MobileList } from "@/components/galanda/mobile-list.tsx";
import { Button } from "@/components/ui/button.tsx";
import { PlanListRow } from "./components/PlanListRow.tsx";
import { toTripRoomViewModel } from "./plan-home-view-model.ts";

export function PlanHomePage() {
  const params = useParams();
  const navigate = useNavigate();

  const validated = decodeRouteParams(TripParamsSchema, params);
  const tripId = Result.isSuccess(validated) ? validated.success.tripId : "";

  const {
    isError: isSessionError,
    error: sessionError,
    data: session,
    refetch: refetchSession,
  } = useSessionQuery();
  const {
    data: rawRoom,
    isLoading,
    isError,
    error,
    refetch: refetchRoom,
  } = useTripRoomRawQuery(tripId);

  if (Result.isFailure(validated)) {
    return <RouteErrorFallback message="유효하지 않은 여행방 식별자입니다." />;
  }

  if (isLoading) {
    return <PageState status="loading" message="계획 정보를 불러오는 중입니다..." />;
  }

  if (isSessionError) {
    return (
      <RouteErrorFallback
        title="로그인 정보를 확인할 수 없습니다"
        message={toUserMessage(sessionError, "잠시 후 다시 시도해주세요.")}
        actionText="다시 시도"
        onAction={() => void refetchSession()}
      />
    );
  }

  if (isError || !rawRoom) {
    return (
      <RouteErrorFallback
        title="여행 정보를 찾을 수 없습니다"
        message={toUserMessage(error, "요청한 여행 정보를 불러올 수 없습니다.")}
        actionText="다시 시도"
        onAction={() => void refetchRoom()}
      />
    );
  }

  const room = toTripRoomViewModel(rawRoom, session?.participantIds);

  const isConfirmed = Boolean(room.confirmedPlanId);
  const plans = room.plans;

  const primaryCta = isConfirmed
    ? {
        label: "확정 일정 보기",
        onClick: () => navigate(`/trips/${tripId}/itinerary`, { replace: true }),
      }
    : plans.length >= 2
      ? {
          label: "여행안 비교하기",
          onClick: () =>
            navigate(`/trips/${tripId}/plans/compare?left=${plans[0].id}&right=${plans[1].id}`),
        }
      : {
          label: plans.length === 1 ? "새 여행안 제안하기" : "첫 여행안 만들기",
          onClick: () => navigate(`/trips/${tripId}/plans/new`),
        };

  return (
    <PageBody withBottomAction={plans.length > 0}>
      <PageTitle
        title={room.title}
        description={`${room.destination} · ${room.period} · 참여 ${room.memberCount}명`}
      />

      <DecisionStatusBanner
        statusText={room.decisionStatusText}
        subText={room.decisionSubText}
        isConfirmed={isConfirmed}
      />

      <SectionHeader title="여행안" description="후보를 훑어보고 자세히 볼 여행안을 선택하세요." />

      {plans.length === 0 ? (
        <PageState
          status="empty"
          title="아직 여행안이 없어요"
          description="첫 여행안을 만들어 친구들과 함께 골라보세요."
          actionText={primaryCta.label}
          onAction={primaryCta.onClick}
        />
      ) : (
        <MobileList aria-label="제안된 여행안">
          {plans.map((plan) => (
            <PlanListRow key={plan.id} plan={plan} to={`/trips/${tripId}/plans/${plan.id}`} />
          ))}
        </MobileList>
      )}

      {plans.length > 0 && (
        <BottomAction>
          <Button type="button" size="xl" onClick={primaryCta.onClick}>
            {primaryCta.label}
          </Button>
        </BottomAction>
      )}
    </PageBody>
  );
}
