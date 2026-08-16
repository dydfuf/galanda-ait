import { css } from "@emotion/react";
import { Button } from "@toss/tds-mobile";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { decodeRouteParams, TripParamsSchema, CompareQuerySchema } from "../../app/routes/route-params.ts";
import { RouteErrorFallback } from "../common/RouteErrorFallback.tsx";
import { Result } from "effect";
import { useTripRoomDetailQuery } from "../plan-detail/queries.ts";
import { useConfirmPlanMutation } from "../plan-home/mutations.ts";
import { RouteRail } from "../common/RouteRail.tsx";

const centerNoticeContainerStyle = css`
  padding: 40px 20px;
  text-align: center;
`;

const loadingTextStyle = css`
  color: var(--adaptiveGrey500, #8b95a1);
  font-size: 15px;
`;

const noticeTitleStyle = css`
  font-size: 18px;
  font-weight: 700;
  margin: 0 0 8px 0;
  color: var(--adaptiveGrey900, #191f28);
`;

const noticeDescStyle = css`
  font-size: 14px;
  color: var(--adaptiveGrey500, #8b95a1);
  margin: 0 0 24px 0;
`;

const pageContainerStyle = css`
  padding: 16px 20px calc(40px + env(safe-area-inset-bottom, 0px));
`;

const pageHeaderStyle = css`
  margin-bottom: 20px;
`;

const pageTitleStyle = css`
  font-size: 20px;
  font-weight: 700;
  margin: 0 0 4px 0;
  color: var(--adaptiveGrey900, #191f28);
`;

const pageSubtitleStyle = css`
  font-size: 13px;
  color: var(--adaptiveGrey500, #8b95a1);
  margin: 0;
`;

const compareStackStyle = css`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const compareCardStyle = css`
  background-color: var(--adaptiveBackground, #ffffff);
  border-radius: 16px;
  padding: 18px 20px;
  border: 1px solid var(--adaptiveGrey200, #e5e8eb);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
`;

const cardHeaderStyle = css`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
`;

const tagLabelStyle = (isLeft: boolean) => css`
  font-size: 11px;
  font-weight: 700;
  padding: 3px 7px;
  border-radius: 6px;
  background-color: ${isLeft ? "var(--adaptiveBlue50, #e8f3ff)" : "var(--adaptiveGrey100, #f2f4f6)"};
  color: ${isLeft ? "var(--adaptiveBlue600, #1b64da)" : "var(--adaptiveGrey700, #4e5968)"};
`;

const authorTextStyle = css`
  font-size: 12px;
  color: var(--adaptiveGrey500, #8b95a1);
`;

const cardTitleStyle = css`
  font-size: 17px;
  font-weight: 700;
  color: var(--adaptiveGrey900, #191f28);
  margin: 0 0 8px 0;
`;

const railWrapperStyle = css`
  margin-bottom: 12px;
`;

const costBoxStyle = css`
  background-color: var(--adaptiveGrey50, #f9fafb);
  border-radius: 10px;
  padding: 10px 12px;
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  margin-bottom: 12px;
`;

const costLabelStyle = css`
  color: var(--adaptiveGrey700, #4e5968);
`;

const costValueStyle = css`
  font-weight: 700;
  color: var(--adaptiveGrey900, #191f28);
`;

const cardFooterStyle = css`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
`;

const opinionGroupStyle = css`
  display: flex;
  gap: 8px;
`;

const likeCountStyle = css`
  color: var(--adaptiveGreen600, #15803d);
  font-weight: 600;
`;

const okayCountStyle = css`
  color: var(--adaptiveBlue600, #1b64da);
  font-weight: 600;
`;

const hardCountStyle = css`
  color: var(--adaptiveRed600, #e0383e);
  font-weight: 600;
`;

const vsWrapperStyle = css`
  text-align: center;
  position: relative;
`;

const vsHrStyle = css`
  border: none;
  border-top: 1px solid var(--adaptiveGrey200, #e5e8eb);
  margin: 10px 0;
`;

const vsBadgeStyle = css`
  position: absolute;
  top: -10px;
  left: 50%;
  transform: translateX(-50%);
  background-color: var(--adaptiveGrey100, #f2f4f6);
  padding: 2px 10px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 700;
  color: var(--adaptiveGrey500, #8b95a1);
`;

export function PlanComparePage() {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const tripValidated = decodeRouteParams(TripParamsSchema, params);
  const tripId = Result.isSuccess(tripValidated) ? tripValidated.success.tripId : "";

  const leftParam = searchParams.get("left");
  const rightParam = searchParams.get("right");

  const queryValidated = decodeRouteParams(CompareQuerySchema, {
    left: leftParam,
    right: rightParam,
  });

  const { data: room, isLoading, isError } = useTripRoomDetailQuery(tripId);
  const confirmPlanMutation = useConfirmPlanMutation();

  if (Result.isFailure(tripValidated)) {
    return <RouteErrorFallback message="유효하지 않은 여행방 식별자입니다." />;
  }

  if (isLoading) {
    return (
      <div css={centerNoticeContainerStyle}>
        <p css={loadingTextStyle}>비교 정보를 불러오는 중...</p>
      </div>
    );
  }

  if (isError || !room) {
    return (
      <RouteErrorFallback
        title="여행 정보를 찾을 수 없습니다"
        message="요청한 여행방의 정보를 불러올 수 없습니다."
      />
    );
  }

  // 쿼리가 없거나 유효하지 않거나, left와 right가 같은 경우
  if (Result.isFailure(queryValidated) || leftParam === rightParam) {
    return (
      <div css={centerNoticeContainerStyle}>
        <h2 css={noticeTitleStyle}>
          비교할 두 여행안을 선택해주세요
        </h2>
        <p css={noticeDescStyle}>
          비교하려는 서로 다른 두 여행안이 지정되지 않았습니다.
        </p>
        <Button
          size="medium"
          type="button"
          onClick={() => navigate(`/trips/${tripId}/plans`, { replace: true })}
        >
          계획 홈으로 돌아가기
        </Button>
      </div>
    );
  }

  const { left, right } = queryValidated.success;
  const leftPlan = room.plans.find((p) => p.id === left);
  const rightPlan = room.plans.find((p) => p.id === right);

  if (!leftPlan || !rightPlan) {
    return (
      <div css={centerNoticeContainerStyle}>
        <h2 css={noticeTitleStyle}>
          여행안을 찾을 수 없습니다
        </h2>
        <p css={noticeDescStyle}>
          비교 대상 중 일부 여행안이 존재하지 않거나 삭제되었습니다.
        </p>
        <Button
          size="medium"
          type="button"
          onClick={() => navigate(`/trips/${tripId}/plans`, { replace: true })}
        >
          계획 홈으로 이동
        </Button>
      </div>
    );
  }

  const isRoomConfirmed = Boolean(room.confirmedPlanId);

  const handleConfirm = (planId: string) => {
    if (!window.confirm("이 여행안으로 일정을 최종 확정하시겠습니까?")) return;

    confirmPlanMutation.mutate(
      {
        roomId: room.id,
        planId,
        revision: room.revision,
      },
      {
        onSuccess: () => {
          navigate(`/trips/${tripId}/itinerary`, { replace: true });
        },
      }
    );
  };

  return (
    <div css={pageContainerStyle}>
      {/* 상단 안내 */}
      <div css={pageHeaderStyle}>
        <h1 css={pageTitleStyle}>
          여행안 비교하기
        </h1>
        <p css={pageSubtitleStyle}>
          두 여행안의 코스, 예상 경비, 구성원 의견 차이를 비교하세요.
        </p>
      </div>

      {/* 두 여행안 카드 비교 */}
      <div css={compareStackStyle}>
        {/* 좌측 여행안 카드 */}
        <div css={compareCardStyle}>
          <div css={cardHeaderStyle}>
            <span css={tagLabelStyle(true)}>
              {leftPlan.planTagLabel}
            </span>
            <span css={authorTextStyle}>{leftPlan.authorName} 제안</span>
          </div>

          <h3 css={cardTitleStyle}>
            {leftPlan.title}
          </h3>

          <div css={railWrapperStyle}>
            <RouteRail route={leftPlan.route} />
          </div>

          <div css={costBoxStyle}>
            <span css={costLabelStyle}>예상 총액</span>
            <span css={costValueStyle}>{leftPlan.groupCostText}</span>
          </div>

          <div css={cardFooterStyle}>
            <div css={opinionGroupStyle}>
              <span css={likeCountStyle}>👍 {leftPlan.opinions.likeCount}</span>
              <span css={okayCountStyle}>🙂 {leftPlan.opinions.okayCount}</span>
              {leftPlan.opinions.hardCount > 0 && (
                <span css={hardCountStyle}>😢 {leftPlan.opinions.hardCount}</span>
              )}
            </div>

            {!isRoomConfirmed && (
              <Button
                size="small"
                type="button"
                disabled={confirmPlanMutation.isPending}
                onClick={() => handleConfirm(leftPlan.id)}
              >
                이 안으로 확정
              </Button>
            )}
          </div>
        </div>

        {/* VS 구분자 */}
        <div css={vsWrapperStyle}>
          <hr css={vsHrStyle} />
          <span css={vsBadgeStyle}>
            VS
          </span>
        </div>

        {/* 우측 여행안 카드 */}
        <div css={compareCardStyle}>
          <div css={cardHeaderStyle}>
            <span css={tagLabelStyle(false)}>
              {rightPlan.planTagLabel}
            </span>
            <span css={authorTextStyle}>{rightPlan.authorName} 제안</span>
          </div>

          <h3 css={cardTitleStyle}>
            {rightPlan.title}
          </h3>

          <div css={railWrapperStyle}>
            <RouteRail route={rightPlan.route} differenceSummary={rightPlan.differenceSummary} />
          </div>

          <div css={costBoxStyle}>
            <span css={costLabelStyle}>예상 총액</span>
            <span css={costValueStyle}>{rightPlan.groupCostText}</span>
          </div>

          <div css={cardFooterStyle}>
            <div css={opinionGroupStyle}>
              <span css={likeCountStyle}>👍 {rightPlan.opinions.likeCount}</span>
              <span css={okayCountStyle}>🙂 {rightPlan.opinions.okayCount}</span>
              {rightPlan.opinions.hardCount > 0 && (
                <span css={hardCountStyle}>😢 {rightPlan.opinions.hardCount}</span>
              )}
            </div>

            {!isRoomConfirmed && (
              <Button
                size="small"
                type="button"
                disabled={confirmPlanMutation.isPending}
                onClick={() => handleConfirm(rightPlan.id)}
              >
                이 안으로 확정
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
