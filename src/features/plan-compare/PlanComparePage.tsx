import { useEffect, useRef, useState } from "react";
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { Result } from "effect";
import {
  CompareQuerySchema,
  decodeRouteParams,
  TripParamsSchema,
} from "../../app/routes/route-params.ts";
import { RouteErrorFallback } from "../common/RouteErrorFallback.tsx";
import {
  isRevisionConflict,
  isStateConflict,
  toRevisionConflictMessage,
  toUserMessage,
} from "../common/error-message.ts";
import { PageBody } from "@/components/galanda/page-body.tsx";
import { PageTitle } from "@/components/galanda/page-title.tsx";
import { SectionHeader } from "@/components/galanda/section-header.tsx";
import { BottomAction } from "@/components/galanda/bottom-action.tsx";
import {
  MobileList,
  MobileListItem,
} from "@/components/galanda/mobile-list.tsx";
import { PageState } from "@/components/galanda/page-state.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer.tsx";
import { ItemDescription, ItemTitle } from "@/components/ui/item.tsx";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group.tsx";
import { useTripRoomDetailQuery } from "../plan-detail/queries.ts";
import { useConfirmPlanMutation } from "../plan-home/mutations.ts";
import {
  buildConfirmPlanSummary,
  buildCompareOpinionSummary,
  buildPlanCompareRows,
  canSubmitConfirm,
  getCompareConfirmState,
} from "./plan-compare-view-model.ts";
import { ConfirmPlanSummaryView } from "./components/ConfirmPlanSummaryView.tsx";
import {
  getRecommendationActionContext,
  trackRecommendationEvent,
} from "../common/recommendation.ts";
import { OFFLINE_MUTATION_MESSAGE } from "../../app/offline-mutation.ts";
import { useOnlineStatus } from "../../hooks/useOnlineStatus.ts";
import { recordCompareOpened } from "../../app/api-client.ts";
import { TripIdSchema } from "../../core/domain/ids.ts";

const getPlanBadgeVariant = (
  planTag: string,
  isConfirmed: boolean,
): "info" | "success" | "neutral" =>
  isConfirmed ? "success" : planTag === "BASIC" ? "info" : "neutral";

export function PlanComparePage() {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  const tripValidated = decodeRouteParams(TripParamsSchema, params);
  const tripId = Result.isSuccess(tripValidated)
    ? tripValidated.success.tripId
    : "";
  const leftParam = searchParams.get("left");
  const rightParam = searchParams.get("right");
  const queryValidated = decodeRouteParams(CompareQuerySchema, {
    left: leftParam,
    right: rightParam,
  });

  const {
    data: room,
    isLoading,
    isError,
    error,
    refetch,
  } = useTripRoomDetailQuery(tripId);
  const confirmPlanMutation = useConfirmPlanMutation();
  const isOnline = useOnlineStatus();
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [isConfirmSheetOpen, setIsConfirmSheetOpen] = useState(false);
  const [isResolvingConflict, setIsResolvingConflict] = useState(false);
  const [showAllComparisons, setShowAllComparisons] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<"left" | "right" | null>(
    null,
  );
  const completedRecommendationId = useRef<string>();
  const openedComparison = useRef<string>();
  const recommendationAction = getRecommendationActionContext(location.state);
  const isComparisonReady = Boolean(
    room &&
    Result.isSuccess(queryValidated) &&
    leftParam !== rightParam &&
    room.plans.some((plan) => plan.id === queryValidated.success.left) &&
    room.plans.some((plan) => plan.id === queryValidated.success.right),
  );

  useEffect(() => {
    const key = `${tripId}:${location.key}`;
    if (!isComparisonReady || isError || !isOnline || !leftParam || !rightParam || openedComparison.current === key) return;
    openedComparison.current = key;
    void recordCompareOpened(TripIdSchema.make(tripId), leftParam, rightParam).catch(() => undefined);
  }, [isComparisonReady, isError, isOnline, tripId, location.key, leftParam, rightParam]);

  useEffect(() => {
    if (
      recommendationAction?.actionId === "COMPARE_PLANS" &&
      isComparisonReady &&
      completedRecommendationId.current !==
        recommendationAction.recommendation.recommendationId
    ) {
      completedRecommendationId.current =
        recommendationAction.recommendation.recommendationId;
      trackRecommendationEvent(
        tripId,
        recommendationAction.recommendation,
        recommendationAction.surface,
        "nba_action_completed",
        recommendationAction.actionId,
      );
    }
  }, [isComparisonReady, recommendationAction, tripId]);

  if (Result.isFailure(tripValidated)) {
    return <RouteErrorFallback message="유효하지 않은 여행방 식별자입니다." />;
  }

  if (isLoading) {
    return (
      <PageState status="loading" message="비교 정보를 불러오는 중이에요." />
    );
  }

  if (isError || !room) {
    return (
      <RouteErrorFallback
        title="여행 정보를 찾을 수 없습니다"
        message={toUserMessage(
          error,
          "요청한 여행방의 정보를 불러올 수 없습니다.",
        )}
        actionText="다시 시도"
        onAction={() => void refetch()}
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

  const isRoomConfirmed = room.isConfirmed;
  const confirmState = getCompareConfirmState({
    isViewerHost: room.isViewerHost,
    isRoomConfirmed,
    confirmedPlanTitle: room.confirmedPlanTitle,
  });
  const isSelectionLocked = confirmState.kind === "LOCKED";
  const confirmedInPair = [leftPlan, rightPlan].find(
    (plan) => plan.id === room.confirmedPlanId,
  );
  const currentSelectedId = isSelectionLocked
    ? confirmedInPair?.id
    : (selectedPlanId ?? leftPlan.id);
  const selectedPlan =
    currentSelectedId === rightPlan.id ? rightPlan : leftPlan;
  const compareOpinionSummary = buildCompareOpinionSummary(
    leftPlan,
    rightPlan,
    room.memberParticipants,
  );
  const compareRows = buildPlanCompareRows(
    leftPlan,
    rightPlan,
    room.memberParticipants,
  );
  const changedRows = compareRows.filter((row) => row.isChanged);
  const visibleRows = showAllComparisons
    ? compareRows
    : changedRows;
  const pageSubtitle =
    confirmState.kind === "LOCKED"
      ? "확정된 여행안은 잠겨 있어요. 아래에서 확정 결과를 확인하세요."
      : "두 여행안을 같은 기준으로 확인한 뒤 마음에 드는 안을 선택하세요.";

  const openConfirmSheet = (): void => {
    if (!isOnline) {
      setConfirmError(OFFLINE_MUTATION_MESSAGE);
      return;
    }
    if (
      !canSubmitConfirm({
        state: confirmState,
        isPending: confirmPlanMutation.isPending || isResolvingConflict,
      })
    ) {
      return;
    }
    setIsConfirmSheetOpen(true);
  };

  const handleConfirmSubmit = async (): Promise<void> => {
    if (confirmPlanMutation.isPending || isResolvingConflict) return;

    if (!isOnline) {
      setConfirmError(OFFLINE_MUTATION_MESSAGE);
      return;
    }

    setConfirmError(null);
    try {
      await confirmPlanMutation.mutateAsync({
        roomId: room.id,
        planId: selectedPlan.id,
        revision: room.revision,
      });
      if (recommendationAction?.actionId === "CONFIRM_PLAN") {
        trackRecommendationEvent(
          tripId,
          recommendationAction.recommendation,
          recommendationAction.surface,
          "nba_action_completed",
          recommendationAction.actionId,
        );
      }
      navigate(`/trips/${tripId}/itinerary`, { replace: true });
    } catch (err: unknown) {
      setIsConfirmSheetOpen(false);
      if (isRevisionConflict(err) || isStateConflict(err)) {
        setIsResolvingConflict(true);
        const refreshed = await refetch();
        if (refreshed.isError || !refreshed.data) {
          setConfirmError(
            "최신 여행 상태를 불러오지 못했어요. 다시 시도해주세요.",
          );
        } else if (isRevisionConflict(err)) {
          setConfirmError(toRevisionConflictMessage(err));
        }
        setIsResolvingConflict(false);
      } else {
        setConfirmError(
          toUserMessage(
            err,
            "일정을 확정하지 못했어요. 잠시 후 다시 시도해주세요.",
          ),
        );
      }
    }
  };

  return (
    <PageBody withBottomAction={confirmState.kind !== "VIEW_ONLY"}>
      <PageTitle title="어떤 여행안이 더 좋나요?" description={pageSubtitle} />

      {confirmState.kind === "LOCKED" && (
        <section
          aria-label="확정 상태"
          className="mb-6 px-(--app-inline-padding)"
        >
          <div className="flex min-w-0 items-start gap-2.5 py-2">
            <Badge variant="success" className="mt-0.5 shrink-0">
              확정됨
            </Badge>
            <div className="flex min-w-0 flex-col gap-1">
              <p className="text-base leading-relaxed font-bold text-foreground [overflow-wrap:anywhere]">
                {confirmState.confirmedPlanTitle
                  ? `'${confirmState.confirmedPlanTitle}'(으)로 일정이 확정되었어요.`
                  : "이미 일정이 확정된 여행이에요."}
              </p>
              <p className="text-base leading-relaxed text-muted-foreground">
                확정 일정에서 날짜별 여행을 확인할 수 있어요.
              </p>
            </div>
          </div>
        </section>
      )}

      {confirmState.kind === "VIEW_ONLY" && (
        <section
          aria-label="확정 권한 안내"
          className="mb-6 px-(--app-inline-padding)"
        >
          <div className="flex min-w-0 items-start gap-2.5 py-2">
            <Badge variant="info" className="mt-0.5 shrink-0">
              참여자
            </Badge>
            <div className="flex min-w-0 flex-col gap-1">
              <p className="text-base leading-relaxed font-bold text-foreground">
                여행안 확정은 방장이 진행해요.
              </p>
              <p className="text-base leading-relaxed text-muted-foreground">
                비교 결과를 보고 마음에 드는 안을 선택해보세요.
              </p>
            </div>
          </div>
        </section>
      )}

      <SectionHeader
        title="비교 근거"
        description="두 여행안을 같은 기준으로 읽을 수 있어요."
        action={
          <div
            role="group"
            aria-label="비교 범위"
            className="flex min-w-0 max-w-full rounded-lg border border-border p-0.5"
          >
            <Button
              type="button"
              size="sm"
              variant={showAllComparisons ? "ghost" : "secondary"}
              aria-pressed={!showAllComparisons}
              onClick={() => setShowAllComparisons(false)}
            >
              차이만 보기
            </Button>
            <Button
              type="button"
              size="sm"
              variant={showAllComparisons ? "secondary" : "ghost"}
              aria-pressed={showAllComparisons}
              onClick={() => setShowAllComparisons(true)}
            >
              전체 보기
            </Button>
          </div>
        }
      />

      <p id="plan-compare-matrix-summary" className="sr-only">
        {leftPlan.planTagLabel}과 {rightPlan.planTagLabel}을 날짜와 경로, 1인 비용,
        예약 확인, 그룹 의견과 어려운 조건 기준으로 비교합니다. 선택은 비교 근거 아래에서
        진행합니다.
      </p>
      <div
        role="table"
        aria-label="여행안 비교 근거"
        aria-describedby="plan-compare-matrix-summary"
        className="mx-(--app-inline-padding) min-w-0 overflow-hidden rounded-xl border border-border"
      >
        <div role="rowgroup" className="bg-muted/30">
          <div
            role="row"
            className="grid min-w-0 grid-cols-2 gap-x-3 border-b border-border p-3 md:grid-cols-[minmax(120px,0.7fr)_minmax(0,1fr)_minmax(0,1fr)]"
          >
            <div role="columnheader" className="hidden min-w-0 md:block">
              비교 기준
            </div>
            {[leftPlan, rightPlan].map((plan) => (
              <div
                key={plan.id}
                role="columnheader"
                className="min-w-0 [overflow-wrap:anywhere]"
              >
                <span className="block text-sm leading-relaxed font-semibold text-muted-foreground">
                  {plan.planTagLabel}
                </span>
                <span className="block text-base leading-snug font-bold text-foreground [overflow-wrap:anywhere]">
                  {plan.title}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div role="rowgroup">
          {visibleRows.map((row) => (
            <div
              key={row.kind}
              role="row"
              data-compare-kind={row.kind}
              className="grid min-w-0 grid-cols-2 gap-x-3 border-b border-border p-3 last:border-b-0 md:grid-cols-[minmax(120px,0.7fr)_minmax(0,1fr)_minmax(0,1fr)]"
            >
              <div
                role="rowheader"
                className="col-span-2 min-w-0 whitespace-nowrap text-sm leading-relaxed font-semibold text-foreground md:col-span-1"
              >
                {row.label}
              </div>
              <div
                role="cell"
                className="min-w-0 pt-2 text-base leading-relaxed text-secondary-foreground [overflow-wrap:anywhere] md:pt-0"
              >
                <span className="mb-1 block text-xs leading-relaxed font-semibold text-muted-foreground md:hidden">
                  {row.leftPlanLabel}
                </span>
                {row.leftValue}
              </div>
              <div
                role="cell"
                className="min-w-0 pt-2 text-base leading-relaxed text-secondary-foreground [overflow-wrap:anywhere] md:pt-0"
              >
                <span className="mb-1 block text-xs leading-relaxed font-semibold text-muted-foreground md:hidden">
                  {row.rightPlanLabel}
                </span>
                {row.rightValue}
              </div>
              {(row.deltaText || row.explanationText) && (
                <p
                  role="cell"
                  className="col-span-2 min-w-0 pt-2 text-sm leading-relaxed font-semibold text-info [overflow-wrap:anywhere] md:col-span-3"
                >
                  {row.deltaText ?? row.explanationText}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      <SectionHeader
        title="여행안 선택"
        description={
          isSelectionLocked
            ? "확정된 여행안은 다시 선택할 수 없어요."
            : "비교 근거를 확인한 뒤 확정할 여행안을 선택하세요."
        }
      />

      {room.plans.length > 2 && !isSelectionLocked && (
        <div className="mb-4 flex min-w-0 gap-2 px-(--app-inline-padding)">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="min-w-0 flex-1 whitespace-normal"
            aria-label="왼쪽 비교 대상 바꾸기"
            onClick={() => setPickerTarget("left")}
          >
            왼쪽 바꾸기
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="min-w-0 flex-1 whitespace-normal"
            aria-label="오른쪽 비교 대상 바꾸기"
            onClick={() => setPickerTarget("right")}
          >
            오른쪽 바꾸기
          </Button>
        </div>
      )}

      <RadioGroup
        aria-label={isSelectionLocked ? "확정된 여행안" : "확정할 여행안 선택"}
        className="mb-7 gap-0 divide-y divide-border"
        value={currentSelectedId ?? ""}
        onValueChange={(value) => {
          if (!isSelectionLocked && typeof value === "string") {
            setSelectedPlanId(value);
          }
        }}
        disabled={isSelectionLocked}
      >
        {[leftPlan, rightPlan].map((plan) => {
          const isSelected = currentSelectedId === plan.id;
          const planVariant = getPlanBadgeVariant(
            plan.planTag,
            plan.isConfirmed,
          );
          const optionLabelId = `plan-compare-option-${plan.id}`;

          return (
            <label
              key={plan.id}
              className={
                "flex! min-w-0 w-full items-start gap-3 px-(--app-inline-padding) py-3.5 " +
                (isSelectionLocked
                  ? "opacity-70"
                  : "cursor-pointer transition-colors hover:bg-muted/50 active:bg-muted")
              }
            >
              <span id={optionLabelId} className="sr-only">
                {plan.title} 선택
              </span>
              <RadioGroupItem
                value={plan.id}
                aria-labelledby={optionLabelId}
                className="mt-1 size-5"
              />
              <div className="flex min-w-0 flex-1 flex-col items-start gap-1.5">
                <Badge
                  variant={
                    isSelected
                      ? plan.isConfirmed
                        ? "success-solid"
                        : planVariant === "info"
                          ? "info-solid"
                          : "neutral-solid"
                      : planVariant
                  }
                >
                  {plan.isConfirmed ? "확정안" : plan.planTagLabel}
                </Badge>
                <span className="min-w-0 text-lg leading-snug font-bold text-foreground [overflow-wrap:anywhere]">
                  {plan.title}
                </span>
                <span className="min-w-0 text-base leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
                  {plan.authorName} 제안{isSelected ? " · 현재 선택" : ""}
                </span>
                <span className="min-w-0 text-base leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
                  {plan.perPersonCostText}
                </span>
                {isSelectionLocked && isSelected && (
                  <Badge variant="success">확정 결과</Badge>
                )}
              </div>
            </label>
          );
        })}
      </RadioGroup>

      {confirmState.kind === "LOCKED" && (
        <BottomAction>
          <Button
            type="button"
            size="xl"
            onClick={() =>
              navigate(`/trips/${tripId}/itinerary`, { replace: true })
            }
          >
            확정 일정 보기
          </Button>
        </BottomAction>
      )}

      {confirmState.kind === "CONFIRMABLE" && (
        <BottomAction
          accessory={
            confirmError || !isOnline ? (
              <>
                {!isOnline && (
                  <span
                    role="status"
                    className="block text-center text-base leading-relaxed text-foreground-muted"
                  >
                    {OFFLINE_MUTATION_MESSAGE}
                  </span>
                )}
                {confirmError && (
                  <span
                    role="alert"
                    className="block text-center text-base leading-relaxed text-destructive-strong"
                  >
                    {confirmError}
                  </span>
                )}
              </>
            ) : undefined
          }
        >
          <Button
            type="button"
            size="xl"
            disabled={
              confirmPlanMutation.isPending || isResolvingConflict || !isOnline
            }
            aria-busy={
              confirmPlanMutation.isPending || isResolvingConflict
                ? "true"
                : undefined
            }
            onClick={openConfirmSheet}
          >
            {confirmPlanMutation.isPending
              ? "일정 확정 중..."
              : !isOnline
                ? "온라인 연결 후 확정"
                : `선택한 '${selectedPlan.title}'으로 여행 확정하기`}
          </Button>
        </BottomAction>
      )}

      <Drawer
        open={pickerTarget !== null}
        onOpenChange={(open) => {
          if (!open) setPickerTarget(null);
        }}
        showSwipeHandle
      >
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="text-left text-[17px] font-bold">
              {pickerTarget === "left"
                ? "왼쪽 여행안 선택"
                : "오른쪽 여행안 선택"}
            </DrawerTitle>
          </DrawerHeader>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <MobileList aria-label="비교 대상 후보">
              {room.plans
                .filter((plan) =>
                  pickerTarget === "left"
                    ? plan.id !== right
                    : plan.id !== left,
                )
                .map((plan) => (
                  <MobileListItem
                    key={plan.id}
                    aria-label={`${plan.title} 선택`}
                    onClick={() => {
                      const nextLeft = pickerTarget === "left" ? plan.id : left;
                      const nextRight =
                        pickerTarget === "right" ? plan.id : right;
                      setPickerTarget(null);
                      setSelectedPlanId(null);
                      navigate(
                        `/trips/${tripId}/plans/compare?left=${nextLeft}&right=${nextRight}`,
                        {
                          state: recommendationAction
                            ? { nbaRecommendation: recommendationAction }
                            : undefined,
                        },
                      );
                    }}
                  >
                    <ItemTitle>{plan.title}</ItemTitle>
                    <ItemDescription className="text-base">
                      {plan.planTagLabel} · {plan.authorName} 제안 ·{" "}
                      {plan.nights}박 {plan.days}일
                    </ItemDescription>
                  </MobileListItem>
                ))}
            </MobileList>
          </div>
          <DrawerFooter>
            <Button
              type="button"
              size="xl"
              variant="secondary"
              onClick={() => setPickerTarget(null)}
            >
              닫기
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <Drawer
        open={isConfirmSheetOpen}
        onOpenChange={(open) => {
          if (!open && !confirmPlanMutation.isPending && !isResolvingConflict) {
            setIsConfirmSheetOpen(false);
          }
        }}
        showSwipeHandle
      >
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="text-left text-[17px] font-bold">
              이 여행안으로 확정할까요?
            </DrawerTitle>
          </DrawerHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-2">
            <ConfirmPlanSummaryView
              summary={buildConfirmPlanSummary(
                selectedPlan,
                compareOpinionSummary,
              )}
            />
          </div>
          <DrawerFooter className="flex-row *:min-w-0 *:flex-1">
            <Button
              type="button"
              size="xl"
              variant="secondary"
              disabled={confirmPlanMutation.isPending || isResolvingConflict}
              onClick={() => setIsConfirmSheetOpen(false)}
            >
              다시 보기
            </Button>
            <Button
              type="button"
              size="xl"
              disabled={
                confirmPlanMutation.isPending || isResolvingConflict || !isOnline
              }
              aria-busy={
                confirmPlanMutation.isPending || isResolvingConflict
                  ? "true"
                  : undefined
              }
              onClick={() => void handleConfirmSubmit()}
            >
              {confirmPlanMutation.isPending ? "확정 중..." : "확정하기"}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </PageBody>
  );
}
