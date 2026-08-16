import { css } from "@emotion/react";
import { Button } from "@toss/tds-mobile";
import { useParams, useNavigate } from "react-router-dom";
import { decodeRouteParams, TripParamsSchema } from "../../app/routes/route-params.ts";
import { RouteErrorFallback } from "../common/RouteErrorFallback.tsx";
import { Result } from "effect";
import { useTripRoomDetailQuery } from "../plan-detail/queries.ts";
import { RouteRail } from "../common/RouteRail.tsx";
import { DetailTimeline } from "../plan-detail/components/DetailTimeline.tsx";

const loadingContainerStyle = css`
  padding: 40px 20px;
  text-align: center;
`;

const loadingTextStyle = css`
  color: var(--adaptiveGrey500, #8b95a1);
  font-size: 15px;
`;

const emptyContainerStyle = css`
  padding: 48px 20px;
  text-align: center;
  background-color: var(--adaptiveBackground, #ffffff);
  margin: 20px;
  border-radius: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  border: 1px solid var(--adaptiveGrey200, #e5e8eb);
`;

const emptyIconStyle = css`
  font-size: 36px;
  margin-bottom: 12px;
`;

const emptyTitleStyle = css`
  font-size: 18px;
  font-weight: 700;
  margin: 0 0 8px 0;
  color: var(--adaptiveGrey900, #191f28);
`;

const emptyDescStyle = css`
  font-size: 14px;
  color: var(--adaptiveGrey500, #8b95a1);
  margin: 0 0 24px 0;
  line-height: 1.5;
`;

const pageContainerStyle = css`
  padding: 16px 20px calc(50px + env(safe-area-inset-bottom, 0px));
`;

const headerCardStyle = css`
  background-color: var(--adaptiveBackground, #ffffff);
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  border: 2px solid var(--adaptiveGreen500, #2da44e);
  margin-bottom: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const headerTopStyle = css`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const confirmedBadgeStyle = css`
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 700;
  background-color: var(--adaptiveGreen50, #f0fbf4);
  color: var(--adaptiveGreen600, #15803d);
`;

const destinationTextStyle = css`
  font-size: 12px;
  color: var(--adaptiveGrey500, #8b95a1);
`;

const planTitleStyle = css`
  font-size: 20px;
  font-weight: 700;
  margin: 0;
  color: var(--adaptiveGrey900, #191f28);
`;

const periodTextStyle = css`
  font-size: 13px;
  color: var(--adaptiveGrey500, #8b95a1);
  margin: 0;
`;

const sectionStyle = css`
  margin-bottom: 24px;
`;

const sectionTitleStyle = css`
  font-size: 16px;
  font-weight: 700;
  margin: 0 0 12px 0;
  color: var(--adaptiveGrey900, #191f28);
`;

const bottomActionStyle = css`
  margin-top: 24px;
`;

export function ItineraryPage() {
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
        <p css={loadingTextStyle}>확정 일정을 불러오는 중...</p>
      </div>
    );
  }

  if (isError || !room) {
    return (
      <RouteErrorFallback
        title="일정 정보를 찾을 수 없습니다"
        message={error instanceof Error ? error.message : "요청한 정보를 찾을 수 없습니다."}
      />
    );
  }

  const confirmedPlan = room.plans.find((p) => p.id === room.confirmedPlanId);

  if (!confirmedPlan) {
    return (
      <div css={emptyContainerStyle}>
        <div css={emptyIconStyle}>📅</div>
        <h2 css={emptyTitleStyle}>
          아직 확정된 일정이 없습니다
        </h2>
        <p css={emptyDescStyle}>
          팀원들과 제안된 후보 여행안을 검토하고<br />
          마음에 드는 계획을 확정해보세요.
        </p>
        <Button
          size="medium"
          type="button"
          onClick={() => navigate(`/trips/${tripId}/plans`, { replace: true })}
        >
          후보 여행안 보러가기
        </Button>
      </div>
    );
  }

  return (
    <div css={pageContainerStyle}>
      <header css={headerCardStyle}>
        <div css={headerTopStyle}>
          <span css={confirmedBadgeStyle}>
            ✓ 최종 확정된 공동 일정
          </span>
          <span css={destinationTextStyle}>{room.destination}</span>
        </div>

        <h1 css={planTitleStyle}>
          {confirmedPlan.title}
        </h1>

        <p css={periodTextStyle}>
          {room.period} · {confirmedPlan.nights}박 {confirmedPlan.days}일
        </p>

        <RouteRail route={confirmedPlan.route} />
      </header>

      {/* 숙소 및 교통 일정 */}
      <section css={sectionStyle}>
        <h2 css={sectionTitleStyle}>
          숙소 및 이동 계획
        </h2>
        <DetailTimeline items={confirmedPlan.timelineItems} />
      </section>

      <div css={bottomActionStyle}>
        <Button
          display="block"
          size="medium"
          type="button"
          onClick={() => navigate(`/trips/${tripId}/plans`)}
        >
          검토했던 계획 기록 보기
        </Button>
      </div>
    </div>
  );
}
