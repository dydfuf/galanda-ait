import { useState } from "react";
import { BottomSheet, useBottomSheet } from "@toss/tds-mobile";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Result } from "effect";
import { decodeRouteParams, CompareQuerySchema, TripParamsSchema } from "../../app/routes/route-params.ts";
import { RouteErrorFallback } from "../common/RouteErrorFallback.tsx";
import { toUserMessage } from "../common/error-message.ts";
import { PageBody } from "@/components/galanda/page-body.tsx";
import { PageTitle } from "@/components/galanda/page-title.tsx";
import { SectionHeader } from "@/components/galanda/section-header.tsx";
import { BottomAction } from "@/components/galanda/bottom-action.tsx";
import { MobileList, MobileListItem } from "@/components/galanda/mobile-list.tsx";
import { PageState } from "@/components/galanda/page-state.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { ItemDescription, ItemTitle } from "@/components/ui/item.tsx";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group.tsx";
import { useTripRoomDetailQuery } from "../plan-detail/queries.ts";
import { useConfirmPlanMutation } from "../plan-home/mutations.ts";
import {
  buildConfirmPlanSummary,
  buildPlanCompareDifferences,
  canSubmitConfirm,
  getCompareConfirmState,
} from "./plan-compare-view-model.ts";
import { ConfirmPlanSummaryView } from "./components/ConfirmPlanSummaryView.tsx";

const getPlanBadgeVariant = (
  planTag: string,
  isConfirmed: boolean
): "info" | "success" | "neutral" => (isConfirmed ? "success" : planTag === "BASIC" ? "info" : "neutral");

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
    return <PageState status="loading" message="비교 정보를 불러오는 중이에요." />;
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
      <PageState
        status="error"
        title="비교할 두 여행안을 선택해주세요"
        description="비교하려는 서로 다른 두 여행안이 지정되지 않았습니다."
        actionText="계획 홈으로 돌아가기"
        onAction={() => navigate(`/trips/${tripId}/plans`, { replace: true })}
      />
    );
  }

  const { left, right } = queryValidated.success;
  const leftPlan = room.plans.find((plan) => plan.id === left);
  const rightPlan = room.plans.find((plan) => plan.id === right);

  if (!leftPlan || !rightPlan) {
    return (
      <PageState
        status="error"
        title="여행안을 찾을 수 없습니다"
        description="비교 대상 중 일부 여행안이 존재하지 않거나 삭제되었습니다."
        actionText="계획 홈으로 이동"
        onAction={() => navigate(`/trips/${tripId}/plans`, { replace: true })}
      />
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
    <PageBody withBottomAction={confirmState.kind !== "VIEW_ONLY"} className="mx-auto max-w-[640px]">
      <PageTitle title="어떤 여행안이 더 좋나요?" description={pageSubtitle} />

      {confirmState.kind === "LOCKED" && (
        <section aria-label="확정 상태" className="mb-6 px-(--app-inline-padding)">
          <div className="flex items-start gap-2.5 py-2">
            <Badge variant="success" className="mt-0.5 shrink-0">
              확정됨
            </Badge>
            <div className="flex min-w-0 flex-col gap-1">
              <p className="text-[15px] font-bold text-foreground">
                {confirmState.confirmedPlanTitle
                  ? `'${confirmState.confirmedPlanTitle}'(으)로 일정이 확정되었어요.`
                  : "이미 일정이 확정된 여행이에요."}
              </p>
              <p className="text-[13px] text-muted-foreground">
                확정 일정에서 날짜별 여행을 확인할 수 있어요.
              </p>
            </div>
          </div>
        </section>
      )}

      {confirmState.kind === "VIEW_ONLY" && (
        <section aria-label="확정 권한 안내" className="mb-6 px-(--app-inline-padding)">
          <div className="flex items-start gap-2.5 py-2">
            <Badge variant="info" className="mt-0.5 shrink-0">
              참여자
            </Badge>
            <div className="flex min-w-0 flex-col gap-1">
              <p className="text-[15px] font-bold text-foreground">여행안 확정은 방장이 진행해요.</p>
              <p className="text-[13px] text-muted-foreground">
                비교 결과를 보고 마음에 드는 안을 선택해보세요.
              </p>
            </div>
          </div>
        </section>
      )}

      <SectionHeader
        title="여행안 선택"
        description={
          isSelectionLocked ? "확정된 여행안은 다시 선택할 수 없어요." : "아래 선택이 마지막 확정 버튼에 반영돼요."
        }
      />

      <RadioGroup
        aria-label={isSelectionLocked ? "확정된 여행안" : "확정할 여행안 선택"}
        className="mb-7 gap-0 divide-y divide-border"
        value={currentSelectedId ?? ""}
        onValueChange={(value) => {
          if (!isSelectionLocked && typeof value === "string") setSelectedPlanId(value);
        }}
        disabled={isSelectionLocked}
      >
        {[leftPlan, rightPlan].map((plan) => {
          const isSelected = currentSelectedId === plan.id;
          const planVariant = getPlanBadgeVariant(plan.planTag, plan.isConfirmed);

          return (
            <label
              key={plan.id}
              className={
                "flex w-full items-start gap-3 px-(--app-inline-padding) py-3.5 " +
                (isSelectionLocked
                  ? "opacity-70"
                  : "cursor-pointer transition-colors hover:bg-muted/50 active:bg-muted")
              }
            >
              <RadioGroupItem
                value={plan.id}
                aria-label={`${plan.title} 선택`}
                className="mt-1 size-5"
              />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div>
                  <Badge variant={isSelected ? (plan.isConfirmed ? "success-solid" : planVariant === "info" ? "info-solid" : "neutral-solid") : planVariant}>
                    {plan.isConfirmed ? "확정안" : plan.planTagLabel}
                  </Badge>
                </div>
                <span className="min-w-0 text-[17px] font-bold break-keep text-foreground">
                  {plan.title}
                </span>
                <span className="text-[13px] text-muted-foreground">
                  {plan.authorName} 제안{isSelected ? " · 현재 선택" : ""}
                </span>
              </div>
              <div className="flex max-w-[132px] shrink-0 flex-col items-end gap-1">
                <span className="text-right text-[13px] text-muted-foreground">
                  {plan.perPersonCostText}
                </span>
                {isSelectionLocked && isSelected && <Badge variant="success">확정 결과</Badge>}
              </div>
            </label>
          );
        })}
      </RadioGroup>

      <SectionHeader
        title="두 안은 이것이 달라요"
        description={
          differences.length > 0
            ? "일정 구조, 예약 현실성, 비용, 의견 순서로 정리했어요."
            : "판단에 영향을 줄 만한 차이가 없어요."
        }
      />

      {differences.length > 0 ? (
        <MobileList aria-label="여행안이 다른 항목" className="mb-7">
          {differences.map((difference) => (
            <MobileListItem key={difference.kind}>
              <ItemTitle>{difference.label}</ItemTitle>
              <div className="flex flex-col gap-2 pt-1.5">
                <div className="grid min-w-0 grid-cols-[52px_minmax(0,1fr)] items-start gap-2">
                  <span className="text-xs leading-relaxed font-bold text-muted-foreground">
                    {difference.leftPlanLabel}
                  </span>
                  <span className="min-w-0 text-[13px] break-words text-secondary-foreground">
                    {difference.leftValue}
                  </span>
                </div>
                <div className="grid min-w-0 grid-cols-[52px_minmax(0,1fr)] items-start gap-2">
                  <span className="text-xs leading-relaxed font-bold text-muted-foreground">
                    {difference.rightPlanLabel}
                  </span>
                  <span className="min-w-0 text-[13px] break-words text-secondary-foreground">
                    {difference.rightValue}
                  </span>
                </div>
              </div>
              {difference.deltaText && (
                <span className="pt-1 text-xs font-bold text-info">{difference.deltaText}</span>
              )}
            </MobileListItem>
          ))}
        </MobileList>
      ) : (
        <MobileList aria-label="여행안이 같은 항목" className="mb-7">
          <MobileListItem trailing={<Badge variant="success">차이 없음</Badge>}>
            <ItemTitle>핵심 구성은 같아요</ItemTitle>
            <ItemDescription>같은 항목은 접어두고 선택만 쉽게 했어요.</ItemDescription>
          </MobileListItem>
        </MobileList>
      )}

      {confirmState.kind === "LOCKED" && (
        <BottomAction>
          <Button
            type="button"
            size="xl"
            onClick={() => navigate(`/trips/${tripId}/itinerary`, { replace: true })}
          >
            확정 일정 보기
          </Button>
        </BottomAction>
      )}

      {confirmState.kind === "CONFIRMABLE" && (
        <BottomAction
          accessory={
            confirmError ? (
              <span role="alert" className="block text-center text-[13px] leading-relaxed text-destructive-strong">
                {confirmError}
              </span>
            ) : undefined
          }
        >
          <Button
            type="button"
            size="xl"
            disabled={confirmPlanMutation.isPending}
            onClick={() => void handleConfirm()}
          >
            {confirmPlanMutation.isPending
              ? "일정 확정 중..."
              : `선택한 '${selectedPlan.title}'으로 여행 확정하기`}
          </Button>
        </BottomAction>
      )}
    </PageBody>
  );
}
