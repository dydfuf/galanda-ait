import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTripRoomRawQuery } from "../plan-detail/queries.ts";
import { decodeRouteParams, TripParamsSchema } from "../../app/routes/route-params.ts";
import { RouteErrorFallback } from "../common/RouteErrorFallback.tsx";
import { toUserMessage } from "../common/error-message.ts";
import { useSessionQuery } from "../../hooks/useSession.ts";
import { Result } from "effect";
import { PageState } from "@/components/galanda/page-state.tsx";
import { PageBody } from "@/components/galanda/page-body.tsx";
import { BottomAction } from "@/components/galanda/bottom-action.tsx";
import { MobileList, MobileListItem } from "@/components/galanda/mobile-list.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { ItemDescription, ItemTitle } from "@/components/ui/item.tsx";
import { PlanDecisionCard } from "./components/PlanDecisionCard.tsx";
import { PlanCandidatesHeader } from "./components/PlanCandidatesHeader.tsx";
import { TripSummarySection } from "./components/TripSummarySection.tsx";
import { DecisionSummarySection } from "./components/DecisionSummarySection.tsx";
import { resolvePlanHomeCta, toTripRoomViewModel } from "./plan-home-view-model.ts";
import { getRoomActor } from "../../core/domain/auth-guards.ts";
import { tripActionPresentation } from "../common/trip-action-presentation.ts";
import {
  NextActionRecommendation,
  NextActionRecommendationPending,
} from "../common/NextActionRecommendation.tsx";
import { useNextTripActionRecommendation } from "../common/use-next-trip-action-recommendation.ts";
import {
  trackRecommendationEvent,
  type RecommendationActionContext,
} from "../common/recommendation.ts";
import { shareTripInvite } from "../invite/share-trip-invite.ts";

export function PlanHomePage() {
  const params = useParams();
  const navigate = useNavigate();

  const validated = decodeRouteParams(TripParamsSchema, params);
  const tripId = Result.isSuccess(validated) ? validated.success.tripId : "";

  const [isComparePickerOpen, setIsComparePickerOpen] = useState(false);
  const [selectedCompareIds, setSelectedCompareIds] = useState<ReadonlyArray<string>>([]);
  const [compareRecommendation, setCompareRecommendation] =
    useState<RecommendationActionContext>();
  const [dismissedRecommendationId, setDismissedRecommendationId] =
    useState<string>();

  const {
    isError: isSessionError,
    isLoading: isSessionLoading,
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
  const recommendationQuery = useNextTripActionRecommendation(
    tripId,
    { surface: "PLAN_HOME" },
    rawRoom?.revision,
    Boolean(rawRoom && session),
  );

  if (Result.isFailure(validated)) {
    return <RouteErrorFallback message="유효하지 않은 여행방 식별자입니다." />;
  }

  if (isLoading) {
    return <PageState status="loading" message="계획 정보를 불러오는 중입니다..." />;
  }

  // room query는 session 성공 이후 enabled 되므로, 세션 로딩 중에는
  // rawRoom 부재를 오류로 판단하거나 capability을 GUEST로 확정하지 않는다.
  if (isSessionLoading) {
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

  const plans = room.plans;

  const toggleCompareSelection = (planId: string): void => {
    setSelectedCompareIds((prev) => {
      if (prev.includes(planId)) return prev.filter((id) => id !== planId);
      if (prev.length < 2) return [...prev, planId];
      // 이미 2개 선택된 상태에서 다른 카드를 탭하면 가장 오래된 선택을 교체해요.
      return [prev[1] as string, planId];
    });
  };

  const openComparePicker = (
    recommendation?: RecommendationActionContext,
  ): void => {
    if (plans.length === 2) {
      navigate(`/trips/${tripId}/plans/compare?left=${plans[0].id}&right=${plans[1].id}`, {
        state: recommendation ? { nbaRecommendation: recommendation } : undefined,
      });
      return;
    }
    // 3개 이상이면 명시적 선택을 위해 Drawer를 열어요. 초기값은 비워두고 사용자가 직접 고르게 해요.
    setIsComparePickerOpen(true);
    setCompareRecommendation(recommendation);
  };

  const handleCompareConfirm = (): void => {
    if (selectedCompareIds.length !== 2) return;
    const [left, right] = selectedCompareIds as [string, string];
    setIsComparePickerOpen(false);
    navigate(`/trips/${tripId}/plans/compare?left=${left}&right=${right}`, {
      state: compareRecommendation
        ? { nbaRecommendation: compareRecommendation }
        : undefined,
    });
  };

  // CTA 노출은 서버 use case와 동일한 도메인 RBAC/NBA 계약을 따른다.
  const actor = getRoomActor(rawRoom, session?.participantIds);
  const canCreatePlan = actor.can("plan:create");
  const cta = resolvePlanHomeCta(rawRoom, actor);
  const recommendation = recommendationQuery.data?.recommendationId ===
      dismissedRecommendationId
    ? undefined
    : recommendationQuery.data;
  const isRecommendationPending = actor.isMember && recommendationQuery.isPending;
  const hasRecommendationSurface = Boolean(recommendation) || isRecommendationPending;

  const runRecommendationAction = async (
    context: RecommendationActionContext,
  ): Promise<void> => {
    if (context.actionId === "INVITE_MEMBER") {
      const outcome = await shareTripInvite(tripId);
      if (outcome === "shared" || outcome === "copied") {
        trackRecommendationEvent(
          tripId,
          context.recommendation,
          context.surface,
          "nba_action_completed",
          context.actionId,
        );
      }
      return;
    }
    if (context.actionId === "GIVE_OPINION") {
      const target = plans.find((plan) => !plan.myReaction) ?? plans[0];
      if (target) {
        navigate(`/trips/${tripId}/plans/${target.id}`, {
          state: { nbaRecommendation: context },
        });
      }
      return;
    }
    if (
      context.actionId === "COMPARE_PLANS" ||
      context.actionId === "CONFIRM_PLAN"
    ) {
      openComparePicker(context);
      return;
    }
    navigate(tripActionPresentation[context.actionId].route(tripId), {
      replace: context.actionId === "VIEW_ITINERARY",
      state: { nbaRecommendation: context },
    });
  };

  const runPrimaryCta = (): void => {
    if (!cta.primaryKind) return;
    switch (cta.primaryKind) {
      case "view-itinerary":
        navigate(`/trips/${tripId}/itinerary`, { replace: true });
        return;
      case "create-first":
      case "propose-new":
        navigate(`/trips/${tripId}/plans/new`);
        return;
      case "compare":
        openComparePicker();
        return;
    }
  };

  const proposeNewPlan = (): void => {
    navigate(`/trips/${tripId}/plans/new`);
  };

  // 후보 0개의 create-first는 empty state 안에서만 렌더한다.
  // sticky BottomAction과 경쟁시키면 primary가 두 개가 된다 (RAON-228 계약).
  const showBottomPrimary =
    plans.length > 0 && cta.primaryKind !== null && !hasRecommendationSurface;

  return (
    <PageBody withBottomAction={showBottomPrimary}>
      <TripSummarySection
        title={room.title}
        destination={room.destination}
        period={room.period}
        memberCount={room.memberCount}
      />

      <DecisionSummarySection
        badgeText={room.decisionBadgeText}
        badgeVariant={room.decisionBadgeVariant}
        statusText={room.decisionStatusText}
        subText={room.decisionSubText}
        candidateCount={room.candidateCount}
        totalOpinionCount={room.totalOpinionCount}
        participatedMemberCount={room.participatedMemberCount}
        memberCount={room.memberCount}
      />

      {recommendation && (
        <NextActionRecommendation
          tripId={tripId}
          surface="PLAN_HOME"
          recommendation={recommendation}
          onAction={(context) => void runRecommendationAction(context)}
          onDismiss={setDismissedRecommendationId}
        />
      )}
      {isRecommendationPending && <NextActionRecommendationPending />}

      <section aria-labelledby="plan-candidates-heading" className="pt-5">
        <PlanCandidatesHeader
          candidateCount={room.candidateCount}
          showNewProposalAction={
            cta.showNewProposalEntry &&
            recommendation?.primary.actionId !== "PROPOSE_ALTERNATIVE"
          }
          onNewProposalAction={proposeNewPlan}
        />

        {plans.length === 0 ? (
          <PageState
            status="empty"
            title="아직 여행안이 없어요"
            description={
              canCreatePlan
                ? "첫 여행안을 만들어 친구들과 함께 골라보세요."
                : "여행 참여자가 첫 여행안을 만들면 여기에 표시돼요."
            }
            actionText={hasRecommendationSurface ? undefined : cta.primaryLabel ?? undefined}
            onAction={hasRecommendationSurface || !cta.primaryKind ? undefined : runPrimaryCta}
          />
        ) : (
          <ul
            className="flex list-none flex-col gap-3 px-(--app-inline-padding) pb-4"
            aria-label="제안된 여행안"
          >
            {plans.map((plan) => (
              <li key={plan.id} className="min-w-0 list-none">
                <PlanDecisionCard
                  plan={plan}
                  to={`/trips/${tripId}/plans/${plan.id}`}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {showBottomPrimary && (
        <BottomAction>
          <Button type="button" size="xl" onClick={runPrimaryCta}>
            {cta.primaryLabel}
          </Button>
        </BottomAction>
      )}

      {/* 3개 이상일 때 명시적 2개 선택 Drawer */}
      <Drawer
        open={isComparePickerOpen}
        onOpenChange={setIsComparePickerOpen}
        showSwipeHandle
      >
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="text-left text-lg font-bold">
              비교할 여행안 2개 선택
            </DrawerTitle>
            <DrawerDescription className="text-left">
              {selectedCompareIds.length === 2
                ? "선택한 2개의 여행안을 비교해요."
                : `여행안을 ${selectedCompareIds.length}/2개 선택했어요. 하나를 더 선택해주세요.`}
            </DrawerDescription>
          </DrawerHeader>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <MobileList
              aria-label="비교 대상 선택"
              className="bg-surface-content"
            >
              {plans.map((plan) => {
                const isSelected = selectedCompareIds.includes(plan.id);
                const selectedIndex = selectedCompareIds.indexOf(plan.id);
                return (
                  <MobileListItem
                    key={plan.id}
                    aria-label={`${plan.title} ${isSelected ? "선택됨" : "선택 안 됨"}`}
                    onClick={() => toggleCompareSelection(plan.id)}
                    leading={
                      <span
                        aria-hidden="true"
                        className={
                          "flex size-6 items-center justify-center rounded-full border text-xs font-bold " +
                          (isSelected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-input bg-background text-muted-foreground")
                        }
                      >
                        {isSelected ? String(selectedIndex + 1) : ""}
                      </span>
                    }
                    trailing={
                      isSelected ? (
                        <Badge variant="info-solid">
                          선택 {selectedIndex + 1}
                        </Badge>
                      ) : undefined
                    }
                  >
                    <ItemTitle className="min-w-0 [overflow-wrap:anywhere]">
                      {plan.title}
                    </ItemTitle>
                    <ItemDescription className="min-w-0 text-base [overflow-wrap:anywhere]">
                      {plan.planTagLabel} · {plan.authorName} 제안 ·{" "}
                      {plan.days > 0
                        ? `${plan.nights}박 ${plan.days}일`
                        : "일정 미정"}
                    </ItemDescription>
                  </MobileListItem>
                );
              })}
            </MobileList>
          </div>
          <DrawerFooter className="flex-row *:min-w-0 *:flex-1">
            <Button
              type="button"
              size="xl"
              variant="secondary"
              onClick={() => setIsComparePickerOpen(false)}
            >
              닫기
            </Button>
            <Button
              type="button"
              size="xl"
              disabled={selectedCompareIds.length !== 2}
              onClick={handleCompareConfirm}
            >
              선택한 2개 비교하기
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </PageBody>
  );
}
