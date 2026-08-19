import { useState } from "react";
import { css } from "@emotion/react";
import { BottomSheet, Button, FixedBottomCTA, useBottomSheet } from "@toss/tds-mobile";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { decodeRouteParams, TripParamsSchema, CompareQuerySchema } from "../../app/routes/route-params.ts";
import { RouteErrorFallback } from "../common/RouteErrorFallback.tsx";
import { Result } from "effect";
import { useTripRoomDetailQuery } from "../plan-detail/queries.ts";
import { useConfirmPlanMutation } from "../plan-home/mutations.ts";
import { RouteRail } from "../common/RouteRail.tsx";
import { fixedCtaContainerStyle } from "../common/tds-layout.ts";
import { visuallyHiddenStyle } from "../common/a11y.ts";
import { toUserMessage } from "../common/error-message.ts";
import {
  buildConfirmPlanSummary,
  canSubmitConfirm,
  getCompareConfirmState,
} from "./plan-compare-view-model.ts";
import { ConfirmPlanSummaryView } from "./components/ConfirmPlanSummaryView.tsx";

const pageContainerStyle = css`
  padding: 16px 20px 24px;
  max-width: 640px;
  margin: 0 auto;
  min-height: 100vh;
  box-sizing: border-box;
`;

const pageHeaderStyle = css`
  margin-bottom: 20px;
`;

const pageTitleStyle = css`
  font-size: 22px;
  font-weight: 700;
  margin: 0 0 6px 0;
  color: var(--adaptiveGrey900, #191f28);
  letter-spacing: -0.4px;
`;

const pageSubtitleStyle = css`
  font-size: 13px;
  color: var(--adaptiveGrey600, #6b7684);
  margin: 0;
`;

// PL-04 시안 1 핵심: 상단 핵심 차이 요약 배너
const summaryBannerStyle = css`
  background-color: var(--adaptiveBlue50, #e8f3ff);
  border-radius: 14px;
  padding: 16px 18px;
  margin-bottom: 24px;
  border: 1px solid #d0e4ff;
`;

const summaryBannerTitleStyle = css`
  font-size: 14px;
  font-weight: 700;
  color: var(--adaptiveBlue700, #1b64da);
  margin: 0 0 8px 0;
  display: flex;
  align-items: center;
  gap: 6px;
`;

const summaryBannerListStyle = css`
  margin: 0;
  padding: 0 0 0 18px;
  font-size: 13px;
  color: var(--adaptiveGrey800, #333d4b);
  display: flex;
  flex-direction: column;
  gap: 4px;
  line-height: 1.4;
`;

// 비교 항목 카드 스타일
const compareSectionCardStyle = css`
  background-color: var(--adaptiveBackground, #ffffff);
  border-radius: 16px;
  padding: 20px;
  border: 1px solid var(--adaptiveGrey200, #e5e8eb);
  margin-bottom: 18px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.03);
`;

const sectionHeaderStyle = css`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--adaptiveGrey100, #f2f4f6);
`;

const sectionTitleStyle = css`
  font-size: 15px;
  font-weight: 700;
  color: var(--adaptiveGrey900, #191f28);
  margin: 0;
`;

const twoColumnsGridStyle = css`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
`;

const planChoiceFieldsetStyle = css`
  border: none;
  padding: 0;
  margin: 0;
  min-width: 0;
`;

const planColumnBoxStyle = (isSelected: boolean) => css`
  padding: 12px 14px;
  border-radius: 12px;
  background-color: ${isSelected ? "var(--adaptiveBlue50, #e8f3ff)" : "var(--adaptiveGrey50, #f9fafb)"};
  border: 1.5px solid ${isSelected ? "var(--adaptiveBlue500, #3182f6)" : "var(--adaptiveGrey200, #e5e8eb)"};
  display: flex;
  flex-direction: column;
  gap: 8px;
  cursor: pointer;
  transition: all 0.15s ease;

  /* 라디오 입력은 화면에서 숨겼기 때문에, 키보드 포커스를 라벨에 표시해요. */
  &:has(:focus-visible) {
    outline: 2px solid var(--adaptiveBlue500, #3182f6);
    outline-offset: 2px;
  }
`;

const planChoiceMetaStyle = css`
  font-size: 12px;
  color: var(--adaptiveGrey500, #8b95a1);
`;

const planChoiceSelectedTextStyle = css`
  font-size: 11px;
  color: var(--adaptiveBlue600, #1b64da);
  font-weight: 700;
`;

const planBadgeRowStyle = css`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const planBadgeStyle = (isLeft: boolean) => css`
  font-size: 11px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  background-color: ${isLeft ? "var(--adaptiveBlue600, #1b64da)" : "var(--adaptiveGrey700, #4e5968)"};
  color: #ffffff;
`;

const planTitleTextStyle = css`
  font-size: 14px;
  font-weight: 700;
  color: var(--adaptiveGrey900, #191f28);
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const valueTextStyle = css`
  font-size: 13px;
  color: var(--adaptiveGrey800, #333d4b);
  margin: 0;
  line-height: 1.4;
`;

const costHighlightStyle = css`
  font-size: 15px;
  font-weight: 700;
  color: var(--adaptiveGrey900, #191f28);
`;

const alertBadgeStyle = (isWarning: boolean) => css`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 600;
  padding: 4px 8px;
  border-radius: 6px;
  background-color: ${isWarning ? "var(--adaptiveYellow50, #fff8e1)" : "var(--adaptiveGreen50, #f0fbf4)"};
  color: ${isWarning ? "var(--adaptiveYellow700, #b78103)" : "var(--adaptiveGreen700, #15803d)"};
`;

const opinionCountsRowStyle = css`
  display: flex;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
`;

const sectionHintStyle = css`
  font-size: 12px;
  color: var(--adaptiveGrey500, #8b95a1);
  text-align: right;
`;

const noticeBoxStyle = css`
  border-radius: 14px;
  padding: 14px 16px;
  font-size: 13px;
  line-height: 1.45;
  background-color: var(--adaptiveGrey100, #f2f4f6);
  color: var(--adaptiveGrey700, #4e5968);
`;

const confirmedNoticeStyle = css`
  border-radius: 14px;
  padding: 14px 16px;
  font-size: 13px;
  line-height: 1.45;
  background-color: var(--adaptiveGreen50, #f0fbf4);
  border: 1px solid #bbf7d0;
  color: var(--adaptiveGreen700, #15803d);
  font-weight: 600;
`;

/** 고정 CTA 위(topAccessory)에 놓이므로 문단이 아닌 인라인 요소로 렌더링해요. */
const confirmErrorStyle = css`
  display: block;
  font-size: 13px;
  color: var(--adaptiveRed600, #e0383e);
  text-align: center;
  line-height: 1.5;
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
  const { openAsyncTwoButtonSheet } = useBottomSheet();

  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  if (Result.isFailure(tripValidated)) {
    return <RouteErrorFallback message="유효하지 않은 여행방 식별자입니다." />;
  }

  if (isLoading) {
    return (
      <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--adaptiveGrey500, #8b95a1)" }}>
        비교 정보를 불러오는 중...
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

  if (Result.isFailure(queryValidated) || leftParam === rightParam) {
    return (
      <div style={{ padding: "40px 20px", textAlign: "center" }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 8px 0" }}>비교할 두 여행안을 선택해주세요</h2>
        <p style={{ fontSize: 14, color: "var(--adaptiveGrey500, #8b95a1)", margin: "0 0 24px 0" }}>
          비교하려는 서로 다른 두 여행안이 지정되지 않았습니다.
        </p>
        <Button size="medium" type="button" onClick={() => navigate(`/trips/${tripId}/plans`, { replace: true })}>
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
      <div style={{ padding: "40px 20px", textAlign: "center" }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 8px 0" }}>여행안을 찾을 수 없습니다</h2>
        <p style={{ fontSize: 14, color: "var(--adaptiveGrey500, #8b95a1)", margin: "0 0 24px 0" }}>
          비교 대상 중 일부 여행안이 존재하지 않거나 삭제되었습니다.
        </p>
        <Button size="medium" type="button" onClick={() => navigate(`/trips/${tripId}/plans`, { replace: true })}>
          계획 홈으로 이동
        </Button>
      </div>
    );
  }

  const isRoomConfirmed = Boolean(room.confirmedPlanId);
  const confirmState = getCompareConfirmState({
    isViewerHost: room.isViewerHost,
    isRoomConfirmed,
    confirmedPlanTitle: room.confirmedPlanTitle,
  });
  const isSelectionLocked = confirmState.kind === "LOCKED";

  // 확정된 방에서는 확정본을, 그 외에는 사용자가 고른 안을 기준으로 삼아요.
  const confirmedInPair = [leftPlan, rightPlan].find((p) => p.id === room.confirmedPlanId);
  const currentSelectedId = selectedPlanId ?? confirmedInPair?.id ?? leftPlan.id;
  const selectedPlan = currentSelectedId === rightPlan.id ? rightPlan : leftPlan;

  const handleConfirm = async (): Promise<void> => {
    // 빠른 중복 탭으로 같은 revision을 쓰는 요청이 두 번 나가지 않게 막아요.
    if (!canSubmitConfirm({ state: confirmState, isPending: confirmPlanMutation.isPending })) {
      return;
    }

    await openAsyncTwoButtonSheet({
      header: <BottomSheet.Header>이 여행안으로 확정할까요?</BottomSheet.Header>,
      children: <ConfirmPlanSummaryView summary={buildConfirmPlanSummary(selectedPlan)} />,
      leftButton: "다시 보기",
      rightButton: "확정하기",
      onRightButtonClick: async (): Promise<void> => {
        setConfirmError(null);
        try {
          await confirmPlanMutation.mutateAsync({
            roomId: room.id,
            planId: selectedPlan.id,
            revision: room.revision,
          });
          navigate(`/trips/${tripId}/itinerary`, { replace: true });
        } catch (err: unknown) {
          // 실패해도 비교 화면의 선택은 유지하고, 화면에서 바로 다시 시도할 수 있게 안내해요.
          setConfirmError(
            toUserMessage(err, "일정을 확정하지 못했어요. 잠시 후 다시 시도해주세요.")
          );
        }
      },
    });
  };

  // 핵심 차이점 분석 문구 생성 (시안 1 명세)
  const generateDifferences = () => {
    const diffs: string[] = [];
    if (leftPlan.period !== rightPlan.period || leftPlan.nights !== rightPlan.nights) {
      diffs.push(`기간 차이: ${leftPlan.title} (${leftPlan.period}) vs ${rightPlan.title} (${rightPlan.period})`);
    }
    if (rightPlan.differenceSummary) {
      diffs.push(rightPlan.differenceSummary);
    }
    if (leftPlan.groupCostText !== rightPlan.groupCostText) {
      diffs.push(`예상 경비: ${leftPlan.groupCostText} vs ${rightPlan.groupCostText}`);
    }
    if (leftPlan.bookingRisks.length > 0 || rightPlan.bookingRisks.length > 0) {
      const leftRisk = leftPlan.bookingRisks.length > 0 ? `${leftPlan.planTagLabel} 점검 필요` : "위험 없음";
      const rightRisk = rightPlan.bookingRisks.length > 0 ? `${rightPlan.planTagLabel} 점검 필요` : "위험 없음";
      diffs.push(`예약 상태: ${leftPlan.planTagLabel}(${leftRisk}) vs ${rightPlan.planTagLabel}(${rightRisk})`);
    }
    return diffs.length > 0 ? diffs : ["두 여행안의 세부 조건이 유사합니다."];
  };

  const differences = generateDifferences();

  return (
    <div css={pageContainerStyle}>
      <div css={pageHeaderStyle}>
        <h1 css={pageTitleStyle}>여행안 비교</h1>
        <p css={pageSubtitleStyle}>
          {confirmState.kind === "CONFIRMABLE"
            ? "두 여행안의 핵심 차이를 비교하고 확정할 안을 선택하세요."
            : confirmState.kind === "LOCKED"
            ? "확정된 일정과 검토했던 여행안을 함께 확인할 수 있어요."
            : "두 여행안의 핵심 차이를 확인하고 의견을 남겨보세요."}
        </p>
      </div>

      {/* 1. 상단 핵심 차이 요약 배너 (PL-04 시안 1) */}
      <div css={summaryBannerStyle}>
        <h3 css={summaryBannerTitleStyle}>
          <span aria-hidden="true">💡</span>
          <span>핵심 차이점 요약</span>
        </h3>
        <ul css={summaryBannerListStyle}>
          {differences.map((diff, i) => (
            <li key={i}>{diff}</li>
          ))}
        </ul>
      </div>

      {confirmState.kind === "LOCKED" && (
        <p css={confirmedNoticeStyle}>
          <span aria-hidden="true">✓ </span>
          {confirmState.confirmedPlanTitle
            ? `'${confirmState.confirmedPlanTitle}'(으)로 일정이 확정되었어요.`
            : "이미 일정이 확정된 여행이에요."}
        </p>
      )}

      {confirmState.kind === "VIEW_ONLY" && (
        <p css={noticeBoxStyle}>
          여행안 확정은 방장이 진행해요. 비교 결과를 보고 의견을 남겨주세요.
        </p>
      )}

      {/* 비교 대조 항목 1: 여행안 선택 및 기본 정보 */}
      <section css={compareSectionCardStyle}>
        <div css={sectionHeaderStyle}>
          <h3 css={sectionTitleStyle}>1. 비교 대상 선택</h3>
          <span css={sectionHintStyle}>
            {confirmState.kind === "CONFIRMABLE"
              ? "카드를 눌러 확정할 안을 고르세요"
              : confirmState.kind === "LOCKED"
              ? "확정이 끝나 선택할 수 없어요"
              : "방장이 확정할 안을 고를 수 있어요"}
          </span>
        </div>

        <fieldset css={planChoiceFieldsetStyle} disabled={isSelectionLocked}>
          <legend css={visuallyHiddenStyle}>
            {confirmState.kind === "CONFIRMABLE"
              ? "확정할 여행안 선택"
              : confirmState.kind === "LOCKED"
              ? "확정된 여행안"
              : "자세히 비교할 여행안 선택"}
          </legend>

          <div css={twoColumnsGridStyle}>
            {[leftPlan, rightPlan].map((plan, index) => {
              const isSelected = currentSelectedId === plan.id;

              return (
                <label key={plan.id} css={planColumnBoxStyle(isSelected)}>
                  <input
                    type="radio"
                    name="compare-selected-plan"
                    value={plan.id}
                    checked={isSelected}
                    onChange={() => setSelectedPlanId(plan.id)}
                    css={visuallyHiddenStyle}
                  />
                  <span css={planBadgeRowStyle}>
                    <span css={planBadgeStyle(index === 0)}>{plan.planTagLabel}</span>
                    {isSelected && (
                      <span css={planChoiceSelectedTextStyle}>
                        <span aria-hidden="true">✓ </span>선택됨
                      </span>
                    )}
                  </span>
                  <span css={planTitleTextStyle}>{plan.title}</span>
                  <span css={planChoiceMetaStyle}>{plan.authorName} 제안</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      </section>

      {/* 비교 대조 항목 2: 날짜 및 도시 체류 (PL-04 시안 1) */}
      <section css={compareSectionCardStyle}>
        <div css={sectionHeaderStyle}>
          <h3 css={sectionTitleStyle}>2. 날짜 및 체류 도시</h3>
        </div>

        <div css={twoColumnsGridStyle}>
          <div>
            <p css={valueTextStyle} style={{ fontWeight: 600, marginBottom: 6 }}>
              {leftPlan.period} ({leftPlan.nights}박 {leftPlan.days}일)
            </p>
            <RouteRail route={leftPlan.route} />
          </div>

          <div>
            <p css={valueTextStyle} style={{ fontWeight: 600, marginBottom: 6 }}>
              {rightPlan.period} ({rightPlan.nights}박 {rightPlan.days}일)
            </p>
            <RouteRail route={rightPlan.route} differenceSummary={rightPlan.differenceSummary} />
          </div>
        </div>
      </section>

      {/* 비교 대조 항목 3: 예약 및 일정 점검 (PL-04 시안 1) */}
      <section css={compareSectionCardStyle}>
        <div css={sectionHeaderStyle}>
          <h3 css={sectionTitleStyle}>3. 예약 및 일정 점검</h3>
        </div>

        <div css={twoColumnsGridStyle}>
          <div>
            {leftPlan.bookingRisks.length > 0 ? (
              <span css={alertBadgeStyle(true)}>
                ⚠️ {leftPlan.bookingRisks.length}건 확인 필요
              </span>
            ) : (
              <span css={alertBadgeStyle(false)}>
                ✓ 예약 위험 없음
              </span>
            )}
          </div>

          <div>
            {rightPlan.bookingRisks.length > 0 ? (
              <span css={alertBadgeStyle(true)}>
                ⚠️ {rightPlan.bookingRisks.length}건 확인 필요
              </span>
            ) : (
              <span css={alertBadgeStyle(false)}>
                ✓ 예약 위험 없음
              </span>
            )}
          </div>
        </div>
      </section>

      {/* 비교 대조 항목 4: 예상 경비 (PL-04 시안 1) */}
      <section css={compareSectionCardStyle}>
        <div css={sectionHeaderStyle}>
          <h3 css={sectionTitleStyle}>4. 예상 경비</h3>
        </div>

        <div css={twoColumnsGridStyle}>
          <div>
            <span css={costHighlightStyle}>{leftPlan.groupCostText}</span>
            <p css={valueTextStyle} style={{ fontSize: 12, color: "var(--adaptiveGrey500, #8b95a1)", marginTop: 2 }}>
              {leftPlan.perPersonCostText}
            </p>
          </div>

          <div>
            <span css={costHighlightStyle}>{rightPlan.groupCostText}</span>
            <p css={valueTextStyle} style={{ fontSize: 12, color: "var(--adaptiveGrey500, #8b95a1)", marginTop: 2 }}>
              {rightPlan.perPersonCostText}
            </p>
          </div>
        </div>
      </section>

      {/* 비교 대조 항목 5: 구성원 의견 (PL-04 시안 1) */}
      <section css={compareSectionCardStyle}>
        <div css={sectionHeaderStyle}>
          <h3 css={sectionTitleStyle}>5. 구성원 의견</h3>
        </div>

        <div css={twoColumnsGridStyle}>
          <div>
            <div css={opinionCountsRowStyle}>
              <span style={{ color: "var(--adaptiveGreen600, #15803d)" }}>👍 {leftPlan.opinions.likeCount}</span>
              <span style={{ color: "var(--adaptiveBlue600, #1b64da)" }}>🙂 {leftPlan.opinions.okayCount}</span>
              {leftPlan.opinions.hardCount > 0 && (
                <span style={{ color: "var(--adaptiveRed600, #e0383e)" }}>😢 {leftPlan.opinions.hardCount}</span>
              )}
            </div>
          </div>

          <div>
            <div css={opinionCountsRowStyle}>
              <span style={{ color: "var(--adaptiveGreen600, #15803d)" }}>👍 {rightPlan.opinions.likeCount}</span>
              <span style={{ color: "var(--adaptiveBlue600, #1b64da)" }}>🙂 {rightPlan.opinions.okayCount}</span>
              {rightPlan.opinions.hardCount > 0 && (
                <span style={{ color: "var(--adaptiveRed600, #e0383e)" }}>😢 {rightPlan.opinions.hardCount}</span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* PL-04 하단 고정 CTA: 확정 권한과 확정 여부에 따라 달라져요 */}
      {confirmState.kind === "LOCKED" && (
        <FixedBottomCTA
          containerStyle={fixedCtaContainerStyle}
          onClick={() => navigate(`/trips/${tripId}/itinerary`, { replace: true })}
        >
          확정 일정 보기
        </FixedBottomCTA>
      )}

      {confirmState.kind === "CONFIRMABLE" && (
        <FixedBottomCTA
          containerStyle={fixedCtaContainerStyle}
          topAccessory={
            confirmError ? (
              <span css={confirmErrorStyle} role="alert">
                {confirmError}
              </span>
            ) : undefined
          }
          disabled={confirmPlanMutation.isPending}
          onClick={() => void handleConfirm()}
        >
          {confirmPlanMutation.isPending
            ? "일정 확정 중..."
            : `선택한 [${selectedPlan.planTagLabel}]으로 일정 확정하기`}
        </FixedBottomCTA>
      )}
    </div>
  );
}
