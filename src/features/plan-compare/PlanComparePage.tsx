import { useState } from "react";
import { css } from "@emotion/react";
import {
  Badge,
  BottomSheet,
  Button,
  Checkbox,
  FixedBottomCTA,
  List,
  ListHeader,
  ListRow,
  Text,
  Top,
  useBottomSheet,
} from "@toss/tds-mobile";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Result } from "effect";
import { decodeRouteParams, CompareQuerySchema, TripParamsSchema } from "../../app/routes/route-params.ts";
import { RouteErrorFallback } from "../common/RouteErrorFallback.tsx";
import { toUserMessage } from "../common/error-message.ts";
import { fixedCtaContainerStyle, tdsPageWithBottomCtaStyle } from "../common/tds-layout.ts";
import { useTripRoomDetailQuery } from "../plan-detail/queries.ts";
import { useConfirmPlanMutation } from "../plan-home/mutations.ts";
import {
  buildConfirmPlanSummary,
  buildPlanCompareDifferences,
  canSubmitConfirm,
  getCompareConfirmState,
} from "./plan-compare-view-model.ts";
import { ConfirmPlanSummaryView } from "./components/ConfirmPlanSummaryView.tsx";

const pageStyle = css`
  ${tdsPageWithBottomCtaStyle};
  max-width: 640px;
  margin: 0 auto;
`;

const selectionFieldsetStyle = css`
  border: 0;
  min-width: 0;
  padding: 0;
  margin: 0 0 28px;
`;

const selectionContentsStyle = css`
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const selectionTitleStyle = css`
  min-width: 0;
  overflow-wrap: anywhere;
`;

const selectionCostStyle = css`
  max-width: 132px;
  text-align: right;
  white-space: normal;
`;

const selectionRightStyle = css`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  min-width: 0;
`;

const noticeListStyle = css`
  margin-bottom: 24px;
`;

const noticeContentsStyle = css`
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const differenceListStyle = css`
  margin-bottom: 28px;
`;

const differenceContentsStyle = css`
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const differenceValuesStyle = css`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const differenceValueStyle = css`
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr);
  align-items: start;
  gap: 8px;
  min-width: 0;
`;

const differencePlanLabelStyle = css`
  color: var(--adaptiveGrey600, #6b7684);
  font-size: 12px;
  font-weight: 700;
  line-height: 1.45;
`;

const differenceValueTextStyle = css`
  min-width: 0;
  overflow-wrap: anywhere;
`;

const differenceDeltaStyle = css`
  color: var(--adaptiveBlue600, #1b64da);
  font-size: 12px;
  font-weight: 700;
`;

const emptyDifferenceStyle = css`
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const confirmErrorStyle = css`
  display: block;
  color: var(--adaptiveRed600, #e0383e);
  font-size: 13px;
  line-height: 1.5;
  text-align: center;
`;

const getPlanBadgeColor = (planTag: string, isConfirmed: boolean): "blue" | "green" | "elephant" =>
  isConfirmed ? "green" : planTag === "BASIC" ? "blue" : "elephant";

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

  const { data: room, isLoading, isError, error } = useTripRoomDetailQuery(tripId);
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
        message={toUserMessage(error, "요청한 여행방의 정보를 불러올 수 없습니다.")}
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
  const leftPlan = room.plans.find((plan) => plan.id === left);
  const rightPlan = room.plans.find((plan) => plan.id === right);

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
  const confirmedInPair = [leftPlan, rightPlan].find((plan) => plan.id === room.confirmedPlanId);
  const currentSelectedId = isSelectionLocked
    ? confirmedInPair?.id
    : selectedPlanId ?? leftPlan.id;
  const selectedPlan = currentSelectedId === rightPlan.id ? rightPlan : leftPlan;
  const differences = buildPlanCompareDifferences(leftPlan, rightPlan);
  const pageSubtitle =
    confirmState.kind === "LOCKED"
      ? "확정된 여행안은 잠겨 있어요. 아래에서 확정 결과를 확인하세요."
      : differences.length > 0
        ? `${differences.length}가지 차이를 먼저 보여드려요. 마음에 드는 안을 선택하세요.`
        : "두 여행안의 핵심 구성이 같아요. 마음에 드는 안을 선택하세요.";

  const handleConfirm = async (): Promise<void> => {
    if (!canSubmitConfirm({ state: confirmState, isPending: confirmPlanMutation.isPending })) return;

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
          setConfirmError(toUserMessage(err, "일정을 확정하지 못했어요. 잠시 후 다시 시도해주세요."));
        }
      },
    });
  };

  return (
    <div css={pageStyle}>
      <Top
        title={<Top.TitleParagraph>어떤 여행안이 더 좋나요?</Top.TitleParagraph>}
        subtitleBottom={<Top.SubtitleParagraph>{pageSubtitle}</Top.SubtitleParagraph>}
      />

      {confirmState.kind === "LOCKED" && (
        <List aria-label="확정 상태" css={noticeListStyle}>
          <ListRow
            border="none"
            verticalPadding="small"
            horizontalPadding="small"
            left={<Badge size="small" variant="weak" color="green">확정됨</Badge>}
            contents={
              <div css={noticeContentsStyle}>
                <Text typography="t6" fontWeight="bold" color="var(--adaptiveGrey900, #191f28)">
                  {confirmState.confirmedPlanTitle
                    ? `'${confirmState.confirmedPlanTitle}'(으)로 일정이 확정되었어요.`
                    : "이미 일정이 확정된 여행이에요."}
                </Text>
                <Text typography="t7" color="var(--adaptiveGrey600, #6b7684)">
                  확정 일정에서 날짜별 여행을 확인할 수 있어요.
                </Text>
              </div>
            }
          />
        </List>
      )}

      {confirmState.kind === "VIEW_ONLY" && (
        <List aria-label="확정 권한 안내" css={noticeListStyle}>
          <ListRow
            border="none"
            verticalPadding="small"
            horizontalPadding="small"
            left={<Badge size="small" variant="weak" color="blue">참여자</Badge>}
            contents={
              <div css={noticeContentsStyle}>
                <Text typography="t6" fontWeight="bold" color="var(--adaptiveGrey900, #191f28)">
                  여행안 확정은 방장이 진행해요.
                </Text>
                <Text typography="t7" color="var(--adaptiveGrey600, #6b7684)">
                  비교 결과를 보고 마음에 드는 안을 선택해보세요.
                </Text>
              </div>
            }
          />
        </List>
      )}

      <ListHeader
        size="medium"
        descriptionPosition="bottom"
        title={<ListHeader.TitleParagraph>여행안 선택</ListHeader.TitleParagraph>}
        description={
          <ListHeader.DescriptionParagraph>
            {isSelectionLocked ? "확정된 여행안은 다시 선택할 수 없어요." : "아래 선택이 마지막 확정 버튼에 반영돼요."}
          </ListHeader.DescriptionParagraph>
        }
      />

      <fieldset css={selectionFieldsetStyle} disabled={isSelectionLocked}>
        <legend style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
          {isSelectionLocked ? "확정된 여행안" : "확정할 여행안 선택"}
        </legend>
        <List aria-label="비교할 여행안">
          {[leftPlan, rightPlan].map((plan) => {
            const isSelected = currentSelectedId === plan.id;
            const planColor = getPlanBadgeColor(plan.planTag, plan.isConfirmed);

            return (
              <ListRow
                key={plan.id}
                border="indented"
                verticalPadding="medium"
                horizontalPadding="small"
                disabled={isSelectionLocked}
                withTouchEffect={!isSelectionLocked}
                onClick={isSelectionLocked ? undefined : () => setSelectedPlanId(plan.id)}
                aria-label={`${plan.planTagLabel}, ${plan.title}, ${plan.authorName} 제안`}
                left={
                  <Checkbox.Circle
                    inputType="radio"
                    name="compare-selected-plan"
                    value={plan.id}
                    checked={isSelected}
                    disabled={isSelectionLocked}
                    aria-label={`${plan.title} 선택`}
                    onChange={() => setSelectedPlanId(plan.id)}
                  />
                }
                contents={
                  <div css={selectionContentsStyle}>
                    <Badge size="small" variant={isSelected ? "fill" : "weak"} color={planColor}>
                      {plan.isConfirmed ? "확정안" : plan.planTagLabel}
                    </Badge>
                    <Text typography="t5" fontWeight="bold" color="var(--adaptiveGrey900, #191f28)" css={selectionTitleStyle}>
                      {plan.title}
                    </Text>
                    <Text typography="t7" color="var(--adaptiveGrey600, #6b7684)">
                      {plan.authorName} 제안{isSelected ? " · 현재 선택" : ""}
                    </Text>
                  </div>
                }
                right={
                  <div css={selectionRightStyle}>
                    <Text typography="t7" color="var(--adaptiveGrey600, #6b7684)" css={selectionCostStyle}>
                      {plan.perPersonCostText}
                    </Text>
                    {isSelectionLocked && isSelected && (
                      <Badge size="small" variant="weak" color="green">확정 결과</Badge>
                    )}
                  </div>
                }
              />
            );
          })}
        </List>
      </fieldset>

      <ListHeader
        size="medium"
        descriptionPosition="bottom"
        title={<ListHeader.TitleParagraph>두 안은 이것이 달라요</ListHeader.TitleParagraph>}
        description={
          <ListHeader.DescriptionParagraph>
            {differences.length > 0 ? "일정 구조, 예약 현실성, 비용, 의견 순서로 정리했어요." : "판단에 영향을 줄 만한 차이가 없어요."}
          </ListHeader.DescriptionParagraph>
        }
      />

      {differences.length > 0 ? (
        <List aria-label="여행안이 다른 항목" css={differenceListStyle}>
          {differences.map((difference) => (
            <ListRow
              key={difference.kind}
              border="indented"
              verticalPadding="medium"
              horizontalPadding="small"
              contents={
                <div css={differenceContentsStyle}>
                  <Text typography="t6" fontWeight="bold" color="var(--adaptiveGrey900, #191f28)">
                    {difference.label}
                  </Text>
                  <div css={differenceValuesStyle}>
                    <div css={differenceValueStyle}>
                      <span css={differencePlanLabelStyle}>{difference.leftPlanLabel}</span>
                      <Text typography="t7" color="var(--adaptiveGrey800, #333d4b)" css={differenceValueTextStyle}>
                        {difference.leftValue}
                      </Text>
                    </div>
                    <div css={differenceValueStyle}>
                      <span css={differencePlanLabelStyle}>{difference.rightPlanLabel}</span>
                      <Text typography="t7" color="var(--adaptiveGrey800, #333d4b)" css={differenceValueTextStyle}>
                        {difference.rightValue}
                      </Text>
                    </div>
                  </div>
                  {difference.deltaText && <span css={differenceDeltaStyle}>{difference.deltaText}</span>}
                </div>
              }
            />
          ))}
        </List>
      ) : (
        <List aria-label="여행안이 같은 항목" css={differenceListStyle}>
          <ListRow
            border="indented"
            verticalPadding="medium"
            horizontalPadding="small"
            contents={
              <div css={emptyDifferenceStyle}>
                <Text typography="t6" fontWeight="bold" color="var(--adaptiveGrey900, #191f28)">
                  핵심 구성은 같아요
                </Text>
                <Text typography="t7" color="var(--adaptiveGrey600, #6b7684)">
                  같은 항목은 접어두고 선택만 쉽게 했어요.
                </Text>
              </div>
            }
            right={<Badge size="small" variant="weak" color="green">차이 없음</Badge>}
          />
        </List>
      )}

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
          {confirmPlanMutation.isPending ? "일정 확정 중..." : `선택한 '${selectedPlan.title}'으로 여행 확정하기`}
        </FixedBottomCTA>
      )}
    </div>
  );
}
