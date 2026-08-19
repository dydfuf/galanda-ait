import { css } from "@emotion/react";
import { Button, FixedBottomCTA } from "@toss/tds-mobile";
import { useParams, useNavigate } from "react-router-dom";
import { useTripRoomDetailQuery } from "../plan-detail/queries.ts";
import { decodeRouteParams, TripParamsSchema } from "../../app/routes/route-params.ts";
import { RouteErrorFallback } from "../common/RouteErrorFallback.tsx";
import { Result } from "effect";
import { DecisionStatusBanner } from "../common/DecisionStatusBanner.tsx";
import { PlanCard } from "./components/PlanCard.tsx";
import { fixedCtaContainerStyle } from "../common/tds-layout.ts";

const loadingContainerStyle = css`
  padding: 40px 20px;
  text-align: center;
`;

const loadingTextStyle = css`
  color: var(--adaptiveGrey500, #8b95a1);
  font-size: 15px;
`;

const pageContainerStyle = css`
  padding: 16px 20px 24px;
`;

const summaryCardStyle = css`
  background-color: var(--adaptiveBackground, #ffffff);
  border-radius: 16px;
  padding: 18px 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  border: 1px solid var(--adaptiveGrey200, #e5e8eb);
  margin-bottom: 16px;
`;

const summaryHeaderStyle = css`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
`;

const destinationBadgeStyle = css`
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 700;
  background-color: var(--adaptiveBlue50, #e8f3ff);
  color: var(--adaptiveBlue600, #1b64da);
`;

const memberCountTextStyle = css`
  font-size: 12px;
  color: var(--adaptiveGrey500, #8b95a1);
`;

const roomTitleStyle = css`
  font-size: 20px;
  font-weight: 700;
  margin: 0 0 4px 0;
  color: var(--adaptiveGrey900, #191f28);
`;

const roomPeriodStyle = css`
  font-size: 13px;
  color: var(--adaptiveGrey500, #8b95a1);
  margin: 0;
`;

const listHeaderRowStyle = css`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
`;

const listTitleStyle = css`
  font-size: 17px;
  font-weight: 700;
  margin: 0 0 2px 0;
  color: var(--adaptiveGrey900, #191f28);
`;

const listSubtitleStyle = css`
  font-size: 12px;
  color: var(--adaptiveGrey500, #8b95a1);
  margin: 0;
`;

const emptyCardStyle = css`
  background-color: var(--adaptiveBackground, #ffffff);
  border-radius: 16px;
  padding: 48px 20px;
  text-align: center;
  border: 1px solid var(--adaptiveGrey200, #e5e8eb);
`;

const emptyTitleStyle = css`
  font-size: 15px;
  font-weight: 600;
  color: var(--adaptiveGrey800, #333d4b);
  margin: 0 0 6px 0;
`;

const emptyDescStyle = css`
  font-size: 13px;
  color: var(--adaptiveGrey500, #8b95a1);
  margin: 0 0 20px 0;
`;

const planStackStyle = css`
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

export function PlanHomePage() {
  const params = useParams();
  const navigate = useNavigate();

  const validated = decodeRouteParams(TripParamsSchema, params);
  const tripId = Result.isSuccess(validated) ? validated.success.tripId : "";

  const { data: room, isLoading, isError, error } = useTripRoomDetailQuery(tripId);

  if (Result.isFailure(validated)) {
    return <RouteErrorFallback message="유효하지 않은 여행방 식별자입니다." />;
  }

  if (isLoading) {
    return (
      <div css={loadingContainerStyle}>
        <p css={loadingTextStyle}>계획 정보를 불러오는 중입니다...</p>
      </div>
    );
  }

  if (isError || !room) {
    return (
      <RouteErrorFallback
        title="여행 정보를 찾을 수 없습니다"
        message={error instanceof Error ? error.message : "요청한 여행 정보를 불러올 수 없습니다."}
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
    <div css={pageContainerStyle}>
      {/* 여행방 상단 요약 배너 */}
      <div css={summaryCardStyle}>
        <div css={summaryHeaderStyle}>
          <span css={destinationBadgeStyle}>
            {room.destination}
          </span>
          <span css={memberCountTextStyle}>참여 {room.memberCount}명</span>
        </div>

        <h1 css={roomTitleStyle}>
          {room.title}
        </h1>

        <p css={roomPeriodStyle}>
          {room.period} · {room.memberNames}
        </p>
      </div>

      {/* 진행 상태 요약 배너 (PL-01 3번 섹션) */}
      <DecisionStatusBanner
        statusText={room.decisionStatusText}
        subText={room.decisionSubText}
        isConfirmed={isConfirmed}
      />

      {/* 여행안 목록 헤더 */}
      <div css={listHeaderRowStyle}>
        <div>
          <h2 css={listTitleStyle}>
            제안된 여행안 ({plans.length})
          </h2>
          <p css={listSubtitleStyle}>
            카드를 눌러 상세 일정과 숙소·교통을 확인하세요.
          </p>
        </div>
      </div>

      {/* 여행안 카드 리스트 (PL-01 4번 섹션) */}
      {plans.length === 0 ? (
        <div css={emptyCardStyle}>
          <p css={emptyTitleStyle}>
            아직 제안된 여행안이 없습니다.
          </p>
          <p css={emptyDescStyle}>
            첫 여행안을 만들어 친구들과 비교해보세요.
          </p>
          <Button size="medium" type="button" onClick={() => navigate(`/trips/${tripId}/plans/new`)}>
            첫 여행안 만들기
          </Button>
        </div>
      ) : (
        <div css={planStackStyle}>
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              to={`/trips/${tripId}/plans/${plan.id}`}
            />
          ))}
        </div>
      )}

      {/* 하단 고정 핵심 행동 CTA (PL-01 5번 섹션) */}
      <FixedBottomCTA containerStyle={fixedCtaContainerStyle} onClick={primaryCta.onClick}>
        {primaryCta.label}
      </FixedBottomCTA>

    </div>
  );
}
