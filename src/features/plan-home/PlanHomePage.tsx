import { FixedBottomCTA, List, ListHeader, Top } from "@toss/tds-mobile";
import { useParams, useNavigate } from "react-router-dom";
import { useTripRoomDetailQuery } from "../plan-detail/queries.ts";
import { decodeRouteParams, TripParamsSchema } from "../../app/routes/route-params.ts";
import { RouteErrorFallback } from "../common/RouteErrorFallback.tsx";
import { toUserMessage } from "../common/error-message.ts";
import { useSessionQuery } from "../../hooks/useSession.ts";
import { Result } from "effect";
import { DecisionStatusBanner } from "../common/DecisionStatusBanner.tsx";
import { PageState } from "../common/PageState.tsx";
import { PlanCard } from "./components/PlanCard.tsx";
import {
  fixedCtaContainerStyle,
  tdsPageWithBottomCtaStyle,
} from "../common/tds-layout.ts";

export function PlanHomePage() {
  const params = useParams();
  const navigate = useNavigate();

  const validated = decodeRouteParams(TripParamsSchema, params);
  const tripId = Result.isSuccess(validated) ? validated.success.tripId : "";

  const {
    isError: isSessionError,
    error: sessionError,
    refetch: refetchSession,
  } = useSessionQuery();
  const {
    data: room,
    isLoading,
    isError,
    error,
    refetch: refetchRoom,
  } = useTripRoomDetailQuery(tripId);

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

  if (isError || !room) {
    return (
      <RouteErrorFallback
        title="여행 정보를 찾을 수 없습니다"
        message={toUserMessage(error, "요청한 여행 정보를 불러올 수 없습니다.")}
        actionText="다시 시도"
        onAction={() => void refetchRoom()}
      />
    );
  }

  const isConfirmed = Boolean(room.confirmedPlanId);
  const plans = room.plans;

  const primaryCta = isConfirmed
    ? {
        label: "확정 일정 보기",
        onClick: () => navigate(`/trips/${tripId}/itinerary`, { replace: true }),
      }
    : plans.length >= 2
      ? {
          label: `여행안 비교하기 (${plans.length}개)`,
          onClick: () =>
            navigate(`/trips/${tripId}/plans/compare?left=${plans[0].id}&right=${plans[1].id}`),
        }
      : {
          label: plans.length === 1 ? "새 여행안 제안하기" : "첫 여행안 만들기",
          onClick: () => navigate(`/trips/${tripId}/plans/new`),
        };

  return (
    <div css={tdsPageWithBottomCtaStyle}>
      <Top
        title={<Top.TitleParagraph>{room.title}</Top.TitleParagraph>}
        subtitleBottom={
          <Top.SubtitleParagraph>
            {room.destination} · {room.period} · {room.memberNames}
          </Top.SubtitleParagraph>
        }
      />

      <DecisionStatusBanner
        statusText={room.decisionStatusText}
        subText={room.decisionSubText}
        isConfirmed={isConfirmed}
      />

      <ListHeader
        size="medium"
        descriptionPosition="bottom"
        title={<ListHeader.TitleParagraph>제안된 여행안 ({plans.length})</ListHeader.TitleParagraph>}
        description={
          <ListHeader.DescriptionParagraph>
            여행안을 눌러 상세 일정과 숙소·교통을 확인하세요.
          </ListHeader.DescriptionParagraph>
        }
      />

      {plans.length === 0 ? (
        <PageState
          status="empty"
          title="아직 제안된 여행안이 없습니다"
          description="첫 여행안을 만들어 친구들과 비교해보세요."
          actionText="첫 여행안 만들기"
          onAction={() => navigate(`/trips/${tripId}/plans/new`)}
        />
      ) : (
        <List aria-label="제안된 여행안">
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              to={`/trips/${tripId}/plans/${plan.id}`}
            />
          ))}
        </List>
      )}

      <FixedBottomCTA containerStyle={fixedCtaContainerStyle} onClick={primaryCta.onClick}>
        {primaryCta.label}
      </FixedBottomCTA>
    </div>
  );
}
