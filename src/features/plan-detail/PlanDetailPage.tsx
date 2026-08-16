import { useState } from "react";
import { css } from "@emotion/react";
import { Button } from "@toss/tds-mobile";
import { useParams, useNavigate } from "react-router-dom";
import { useTripRoomDetailQuery } from "./queries.ts";
import { useSubmitOpinionMutation } from "./mutations.ts";
import { decodeRouteParams, PlanParamsSchema } from "../../app/routes/route-params.ts";

import { RouteErrorFallback } from "../common/RouteErrorFallback.tsx";
import { Result } from "effect";
import { RouteRail } from "../common/RouteRail.tsx";
import { BookingRiskSummary } from "./components/BookingRiskSummary.tsx";
import { DetailTimeline } from "./components/DetailTimeline.tsx";
import { OpinionBottomSheet, type ReactionType } from "./components/OpinionBottomSheet.tsx";

const loadingContainerStyle = css`
  padding: 40px 20px;
  text-align: center;
`;

const loadingTextStyle = css`
  color: var(--adaptiveGrey500, #8b95a1);
  font-size: 15px;
`;

const pageContainerStyle = css`
  padding: 16px 20px calc(108px + env(safe-area-inset-bottom, 0px));
`;

const summaryCardStyle = (isConfirmed: boolean) => css`
  background-color: var(--adaptiveBackground, #ffffff);
  border-radius: 16px;
  padding: 20px;
  border: ${isConfirmed ? "2px solid var(--adaptiveGreen500, #2da44e)" : "1px solid var(--adaptiveGrey200, #e5e8eb)"};
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  margin-bottom: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const cardHeaderStyle = css`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const tagGroupStyle = css`
  display: flex;
  gap: 6px;
  align-items: center;
`;

const tagBadgeStyle = (isConfirmed: boolean) => css`
  font-size: 11px;
  font-weight: 700;
  padding: 3px 7px;
  border-radius: 6px;
  background-color: ${isConfirmed ? "var(--adaptiveGreen50, #f0fbf4)" : "var(--adaptiveBlue50, #e8f3ff)"};
  color: ${isConfirmed ? "var(--adaptiveGreen600, #15803d)" : "var(--adaptiveBlue600, #1b64da)"};
`;

const authorTextStyle = css`
  font-size: 13px;
  color: var(--adaptiveGrey500, #8b95a1);
`;

const periodTextStyle = css`
  font-size: 12px;
  color: var(--adaptiveGrey500, #8b95a1);
`;

const planTitleStyle = css`
  font-size: 20px;
  font-weight: 700;
  margin: 0;
  color: var(--adaptiveGrey900, #191f28);
`;

const reasonQuoteStyle = css`
  font-size: 14px;
  color: var(--adaptiveGrey700, #4e5968);
  background-color: var(--adaptiveGrey50, #f9fafb);
  padding: 10px 12px;
  border-radius: 8px;
  margin: 0;
  line-height: 1.4;
`;

const costBoxStyle = css`
  background-color: var(--adaptiveGrey100, #f2f4f6);
  border-radius: 10px;
  padding: 12px 14px;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const costLabelStyle = css`
  font-size: 13px;
  font-weight: 600;
  color: var(--adaptiveGrey700, #4e5968);
`;

const costValueAlignStyle = css`
  text-align: right;
`;

const groupCostStyle = css`
  font-size: 15px;
  font-weight: 700;
  color: var(--adaptiveGrey900, #191f28);
  margin: 0;
`;

const perPersonCostStyle = css`
  font-size: 12px;
  color: var(--adaptiveGrey500, #8b95a1);
  margin: 2px 0 0 0;
`;

const sectionStyle = css`
  margin-bottom: 24px;
`;

const sectionTitleStyle = css`
  font-size: 15px;
  font-weight: 700;
  color: var(--adaptiveGrey900, #191f28);
  margin: 0 0 10px 0;
`;

const sectionHeaderStyle = css`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
`;

const sectionMainTitleStyle = css`
  font-size: 16px;
  font-weight: 700;
  color: var(--adaptiveGrey900, #191f28);
  margin: 0;
`;

const snapshotCaptionStyle = css`
  font-size: 12px;
  color: var(--adaptiveGrey500, #8b95a1);
`;

const forkSectionStyle = css`
  margin-bottom: 28px;
  text-align: center;
`;

const forkButtonStyle = css`
  width: 100%;
  padding: 14px;
  border-radius: 12px;
  border: 1px dashed var(--adaptiveBlue500, #3182f6);
  background-color: var(--adaptiveBlue50, #e8f3ff);
  color: var(--adaptiveBlue600, #1b64da);
  font-weight: 700;
  font-size: 14px;
  cursor: pointer;
  transition: transform 0.12s ease, background-color 0.12s ease;

  &:active {
    transform: scale(0.985);
    background-color: #dbeafe;
  }
`;

const opinionsCardStyle = css`
  background-color: var(--adaptiveBackground, #ffffff);
  border-radius: 16px;
  padding: 18px 20px;
  border: 1px solid var(--adaptiveGrey200, #e5e8eb);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.03);
`;

const opinionsHeaderStyle = css`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
`;

const opinionsCountsStyle = css`
  display: flex;
  gap: 6px;
  font-size: 12px;
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

const opinionsListStyle = css`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const opinionItemStyle = css`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 10px 12px;
  border-radius: 10px;
  background-color: var(--adaptiveGrey50, #f9fafb);
`;

const opinionUserRowStyle = css`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const opinionUserNameStyle = css`
  font-size: 14px;
  font-weight: 700;
  color: var(--adaptiveGrey800, #333d4b);
`;

const opinionReactionTextStyle = css`
  font-size: 12px;
`;

const opinionReasonStyle = css`
  font-size: 12px;
  color: var(--adaptiveRed600, #e0383e);
  margin: 4px 0 0 0;
`;

const fixedCtaContainerStyle = css`
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  max-width: 480px;
  margin: 0 auto;
  background-color: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-top: 1px solid var(--adaptiveGrey200, #e5e8eb);
  padding: 12px 20px calc(14px + env(safe-area-inset-bottom, 0px));
  z-index: 30;
  box-sizing: border-box;
`;

export function PlanDetailPage() {
  const params = useParams();
  const navigate = useNavigate();

  const validated = decodeRouteParams(PlanParamsSchema, params);
  const tripId = Result.isSuccess(validated) ? validated.success.tripId : "";
  const planId = Result.isSuccess(validated) ? validated.success.planId : "";

  const { data: room, isLoading, isError, error } = useTripRoomDetailQuery(tripId);
  const submitOpinionMutation = useSubmitOpinionMutation();

  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);

  if (Result.isFailure(validated)) {
    return <RouteErrorFallback message="유효하지 않은 여행안 경로입니다." />;
  }

  if (isLoading) {
    return (
      <div css={loadingContainerStyle}>
        <p css={loadingTextStyle}>여행안 상세 정보를 불러오는 중...</p>
      </div>
    );
  }

  if (isError || !room) {
    return (
      <RouteErrorFallback
        title="여행 정보를 찾을 수 없습니다"
        message={error instanceof Error ? error.message : "요청한 정보를 찾을 수 없습니다."}
      />
    );
  }

  const plan = room.plans.find((p) => p.id === planId);
  if (!plan) {
    return (
      <RouteErrorFallback
        title="여행안을 찾을 수 없습니다"
        message="요청하신 여행안이 삭제되었거나 존재하지 않습니다."
        actionText="계획 목록으로 돌아가기"
        onAction={() => navigate(`/trips/${tripId}/plans`, { replace: true })}
      />
    );
  }

  const isConfirmed = plan.id === room.confirmedPlanId;
  const isRoomConfirmed = Boolean(room.confirmedPlanId);

  const handleOpinionSubmit = (reaction: ReactionType, reason?: string) => {
    submitOpinionMutation.mutate({
      roomId: room.id,
      planId: plan.id,
      reaction,
      reason,
      expectedRevision: room.revision,
    });
    setIsBottomSheetOpen(false);
  };


  return (
    <div css={pageContainerStyle}>
      {/* 1. 여행안 요약 카드 (PL-02 1번 섹션) */}
      <div css={summaryCardStyle(isConfirmed)}>
        <div css={cardHeaderStyle}>
          <div css={tagGroupStyle}>
            <span css={tagBadgeStyle(isConfirmed)}>
              {isConfirmed ? "확정된 여행안" : plan.planTagLabel}
            </span>
            <span css={authorTextStyle}>{plan.authorName} 제안</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span css={periodTextStyle}>
              {plan.period}
            </span>
            {!isConfirmed && !isRoomConfirmed && (
              <button
                type="button"
                onClick={() => navigate(`/trips/${tripId}/plans/${plan.id}/edit`)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--adaptiveBlue600, #1b64da)",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                  padding: "2px 4px",
                }}
              >
                수정
              </button>
            )}
          </div>
        </div>

        <h1 css={planTitleStyle}>
          {plan.title}
        </h1>

        {plan.proposalReason && (
          <p css={reasonQuoteStyle}>
            💬 "{plan.proposalReason}"
          </p>
        )}

        {/* 압축 경로 레일 */}
        <RouteRail route={plan.route} differenceSummary={plan.differenceSummary} />

        {/* 그룹 총액 및 1인 예상 참고액 */}
        <div css={costBoxStyle}>
          <span css={costLabelStyle}>예상 경비</span>
          <div css={costValueAlignStyle}>
            <p css={groupCostStyle}>
              {plan.groupCostText}
            </p>
            <p css={perPersonCostStyle}>
              {plan.perPersonCostText}
            </p>
          </div>
        </div>
      </div>

      {/* 2. 예약 위험 요약 (PL-02 2번 섹션) */}
      <section css={sectionStyle}>
        <h3 css={sectionTitleStyle}>
          예약 및 일정 점검
        </h3>
        <BookingRiskSummary items={plan.bookingRisks} />
      </section>

      {/* 3. 도시별 상세 및 숙소/교통 타임라인 (PL-02 3번 섹션) */}
      <section css={sectionStyle}>
        <div css={sectionHeaderStyle}>
          <h3 css={sectionMainTitleStyle}>
            상세 일정 및 숙소·교통
          </h3>
          <span css={snapshotCaptionStyle}>스냅샷 기준</span>
        </div>
        <DetailTimeline items={plan.timelineItems} />
      </section>

      {/* 4. 대안 제안 버튼 (PL-02 4번 섹션) */}
      {!isRoomConfirmed && (
        <section css={forkSectionStyle}>
          <button
            type="button"
            onClick={() => navigate(`/trips/${tripId}/plans/new?cloneFrom=${plan.id}`)}
            css={forkButtonStyle}
          >
            📋 이 여행안을 복제해 다른 구성으로 제안하기
          </button>
        </section>
      )}

      {/* 5. 구성원 의견 (PL-02 5번 섹션) */}
      <section css={opinionsCardStyle}>
        <div css={opinionsHeaderStyle}>
          <h3 css={sectionMainTitleStyle}>
            친구들 의견 ({plan.memberOpinions.length}명)
          </h3>
          <div css={opinionsCountsStyle}>
            <span css={likeCountStyle}>👍 {plan.opinions.likeCount}</span>
            <span css={okayCountStyle}>🙂 {plan.opinions.okayCount}</span>
            <span css={hardCountStyle}>😢 {plan.opinions.hardCount}</span>
          </div>
        </div>

        <div css={opinionsListStyle}>
          {plan.memberOpinions.map((opinion) => (
            <div key={opinion.userId} css={opinionItemStyle}>
              <div>
                <div css={opinionUserRowStyle}>
                  <span css={opinionUserNameStyle}>
                    {opinion.userName}
                  </span>
                  <span css={opinionReactionTextStyle}>
                    {opinion.reaction === "LIKE" && "👍 좋아요"}
                    {opinion.reaction === "OKAY" && "🙂 괜찮아요"}
                    {opinion.reaction === "HARD" && "😢 어려워요"}
                  </span>
                </div>
                {opinion.reason && (
                  <p css={opinionReasonStyle}>
                    사유: {opinion.reason}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 6. 하단 핵심 행동 CTA (PL-02 6번 섹션) */}
      <div css={fixedCtaContainerStyle}>
        {isConfirmed ? (
          <Button
            display="block"
            size="large"
            type="button"
            onClick={() => navigate(`/trips/${tripId}/itinerary`, { replace: true })}
          >
            확정 일정 보기
          </Button>
        ) : isRoomConfirmed ? null : (
          <Button
            display="block"
            size="large"
            type="button"
            disabled={submitOpinionMutation.isPending}
            onClick={() => setIsBottomSheetOpen(true)}
          >
            {plan.myReaction ? "내 의견 바꾸기" : "의견 남기기"}
          </Button>
        )}
      </div>

      {/* 의견 작성 바텀시트 */}
      <OpinionBottomSheet
        isOpen={isBottomSheetOpen}
        onClose={() => setIsBottomSheetOpen(false)}
        initialReaction={plan.myReaction as ReactionType | undefined}
        initialReason={
          plan.memberOpinions.find(
            (m) => m.userId === "user-local-me" || m.userId === "user-local-host"
          )?.reason || ""
        }
        onSubmit={handleOpinionSubmit}
      />
    </div>
  );
}

