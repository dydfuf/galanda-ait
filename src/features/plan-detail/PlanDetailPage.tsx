import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Result } from "effect";
import { toast } from "sonner";
import { useTripRoomDetailQuery } from "./queries.ts";
import { useSubmitOpinionMutation } from "./mutations.ts";
import { useDeletePlanMutation } from "../plan-editor/mutations.ts";
import { decodeRouteParams, PlanParamsSchema } from "../../app/routes/route-params.ts";
import { RouteErrorFallback } from "../common/RouteErrorFallback.tsx";
import {
  isRevisionConflict,
  isStateConflict,
  toRevisionConflictMessage,
  toUserMessage,
} from "../common/error-message.ts";
import { useSessionQuery } from "../../hooks/useSession.ts";
import { RouteRail } from "../common/RouteRail.tsx";
import { REACTION_DISPLAY, getReactionLabel } from "../common/reaction-display.tsx";
import { PageBody } from "@/components/galanda/page-body.tsx";
import { PageState } from "@/components/galanda/page-state.tsx";
import { SectionHeader } from "@/components/galanda/section-header.tsx";
import { BottomAction } from "@/components/galanda/bottom-action.tsx";
import { MobileList, MobileListItem } from "@/components/galanda/mobile-list.tsx";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer.tsx";
import { ItemDescription, ItemTitle } from "@/components/ui/item.tsx";
import { BookingRiskSummary } from "./components/BookingRiskSummary.tsx";
import { DetailTimeline } from "./components/DetailTimeline.tsx";
import { OpinionBottomSheet, type ReactionType } from "./components/OpinionBottomSheet.tsx";
import {
  getRecommendationActionContext,
  trackRecommendationEvent,
} from "../common/recommendation.ts";
import { OFFLINE_MUTATION_MESSAGE } from "../../app/offline-mutation.ts";
import { useOnlineStatus } from "../../hooks/useOnlineStatus.ts";

const getPlanBadgeVariant = (
  isConfirmed: boolean,
  planTag: string
): "info" | "success-solid" | "neutral" =>
  isConfirmed ? "success-solid" : planTag === "ALTERNATIVE" ? "neutral" : "info";

export function PlanDetailPage(): JSX.Element {
  const params = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const validated = decodeRouteParams(PlanParamsSchema, params);
  const tripId = Result.isSuccess(validated) ? validated.success.tripId : "";
  const planId = Result.isSuccess(validated) ? validated.success.planId : "";

  const { isError: isSessionError, error: sessionError } = useSessionQuery();
  const { data: room, isLoading, isError, error, refetch } = useTripRoomDetailQuery(tripId);
  const submitOpinionMutation = useSubmitOpinionMutation();
  const deletePlanMutation = useDeletePlanMutation();
  const isOnline = useOnlineStatus();
  const [isOpinionSheetOpen, setIsOpinionSheetOpen] = useState(false);
  const [isManagementDrawerOpen, setIsManagementDrawerOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [opinionError, setOpinionError] = useState<string>();
  const [deleteError, setDeleteError] = useState<string>();
  const [conflictNotice, setConflictNotice] = useState<string>();
  const [isResolvingConflict, setIsResolvingConflict] = useState(false);
  const openedRecommendationId = useRef<string>();
  const recommendationAction = getRecommendationActionContext(location.state);

  useEffect(() => {
    if (
      recommendationAction?.actionId === "GIVE_OPINION" &&
      room &&
      !room.isConfirmed &&
      room.plans.some((plan) => plan.id === planId) &&
      openedRecommendationId.current !==
        recommendationAction.recommendation.recommendationId
    ) {
      openedRecommendationId.current =
        recommendationAction.recommendation.recommendationId;
      setIsOpinionSheetOpen(true);
    }
  }, [planId, recommendationAction, room]);

  if (Result.isFailure(validated)) {
    return <RouteErrorFallback message="유효하지 않은 여행안 경로입니다." />;
  }

  if (isLoading) {
    return <PageState status="loading" message="여행안 상세 정보를 불러오는 중이에요." />;
  }

  if (isSessionError) {
    return (
      <RouteErrorFallback
        title="로그인 정보를 확인할 수 없습니다"
        message={toUserMessage(sessionError, "잠시 후 다시 시도해주세요.")}
      />
    );
  }

  if (isError || !room) {
    return (
      <RouteErrorFallback
        title="여행 정보를 찾을 수 없습니다"
        message={toUserMessage(error, "요청한 정보를 찾을 수 없습니다.")}
      />
    );
  }

  const plan = room.plans.find((candidate) => candidate.id === planId);
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

  const isConfirmed = plan.isConfirmed;
  const canChangeOpinion = room.canSubmitOpinion;
  const canManage = Boolean(plan.canManage);
  const hasBottomAction = isConfirmed || canChangeOpinion;
  const durationText =
    plan.days > 0 ? `${plan.nights}박 ${plan.days}일` : "기간 미정";
  const opinionCounts: Record<ReactionType, number> = {
    LIKE: plan.opinions.likeCount,
    OKAY: plan.opinions.okayCount,
    HARD: plan.opinions.hardCount,
  };
  const opinionSummary = REACTION_DISPLAY.map(
    ({ key, label }) => `${label} ${opinionCounts[key]}`
  ).join(" · ");
  const myReactionLabel = getReactionLabel(plan.myReaction);
  const myOpinionSummary = myReactionLabel
    ? `내 의견: ${myReactionLabel}`
    : canChangeOpinion
      ? "아직 내 의견이 없어요"
      : "의견을 열람할 수 있어요";

  const openOpinionSheet = (): void => {
    if (
      !canChangeOpinion ||
      submitOpinionMutation.isPending ||
      isResolvingConflict
    )
      return;
    setOpinionError(undefined);
    setIsOpinionSheetOpen(true);
  };

  const handleOpinionSubmit = async (
    reaction: ReactionType,
    reason?: string
  ): Promise<void> => {
    if (
      !canChangeOpinion ||
      submitOpinionMutation.isPending ||
      isResolvingConflict
    )
      return;

    if (!isOnline) {
      setOpinionError(OFFLINE_MUTATION_MESSAGE);
      return;
    }

    setConflictNotice(undefined);
    setOpinionError(undefined);
    try {
      await submitOpinionMutation.mutateAsync({
        roomId: room.id,
        planId: plan.id,
        reaction,
        reason,
        expectedRevision: room.revision,
      });
      setIsOpinionSheetOpen(false);
      toast("의견을 저장했어요.");
      if (recommendationAction?.actionId === "GIVE_OPINION") {
        trackRecommendationEvent(
          tripId,
          recommendationAction.recommendation,
          recommendationAction.surface,
          "nba_action_completed",
          recommendationAction.actionId,
        );
        navigate(location.pathname, { replace: true, state: null });
      }
    } catch (err: unknown) {
      if (isRevisionConflict(err) || isStateConflict(err)) {
        setIsResolvingConflict(true);
        const refreshed = await refetch();
        if (refreshed.isError || !refreshed.data) {
          setOpinionError(
            "최신 여행 상태를 불러오지 못했습니다. 다시 시도해주세요.",
          );
        } else if (isStateConflict(err)) {
          setIsOpinionSheetOpen(false);
          setConflictNotice(
            toUserMessage(err, "현재 여행 상태에서는 의견을 바꿀 수 없어요."),
          );
        } else {
          setOpinionError(toRevisionConflictMessage(err));
        }
        setIsResolvingConflict(false);
      } else {
        setOpinionError(toUserMessage(err, "의견을 등록하지 못했습니다."));
      }
    }
  };

  const handleConfirmDelete = async (): Promise<void> => {
    if (!isOnline) {
      setDeleteError(OFFLINE_MUTATION_MESSAGE);
      return;
    }
    if (!canManage || deletePlanMutation.isPending || isResolvingConflict)
      return;

    setConflictNotice(undefined);
    setDeleteError(undefined);
    try {
      await deletePlanMutation.mutateAsync({
        roomId: room.id,
        planId: plan.id,
        expectedRevision: room.revision,
      });
      setIsDeleteConfirmOpen(false);
      navigate(`/trips/${tripId}/plans`, { replace: true });
    } catch (err: unknown) {
      if (isRevisionConflict(err) || isStateConflict(err)) {
        setIsResolvingConflict(true);
        const refreshed = await refetch();
        if (refreshed.isError || !refreshed.data) {
          setDeleteError(
            "최신 여행 상태를 불러오지 못했습니다. 다시 시도해주세요.",
          );
        } else if (isStateConflict(err)) {
          setIsDeleteConfirmOpen(false);
          setConflictNotice(
            toUserMessage(
              err,
              "현재 여행 상태에서는 이 여행안을 삭제할 수 없어요.",
            ),
          );
        } else {
          setDeleteError(toRevisionConflictMessage(err));
        }
        setIsResolvingConflict(false);
      } else {
        setDeleteError(toUserMessage(err, "여행안 삭제에 실패했습니다."));
      }
    }
  };

  return (
    <PageBody withBottomAction={hasBottomAction}>
      <header className="bg-surface-content px-(--app-inline-padding) pb-5">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <h1 className="min-w-0 text-2xl leading-tight font-bold text-foreground [overflow-wrap:anywhere]">
              {plan.title}
            </h1>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Badge variant={getPlanBadgeVariant(isConfirmed, plan.planTag)}>
                {isConfirmed ? "확정안" : plan.planTagLabel}
              </Badge>
              <span className="min-w-0 text-sm leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
                제안자 {plan.authorName} · {plan.period} · {durationText}
              </span>
            </div>
          </div>
          {canManage && (
            <Button
              type="button"
              variant="ghost"
              className="shrink-0 text-primary"
              onClick={() => setIsManagementDrawerOpen(true)}
            >
              더보기
            </Button>
          )}
        </div>
      </header>

      {conflictNotice && (
        <section
          className="mx-(--app-inline-padding) mb-4 rounded-xl border border-warning-border bg-warning-muted p-4"
          role="alert"
        >
          <p className="text-base leading-relaxed text-foreground">
            {conflictNotice}
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-3"
            onClick={() => setConflictNotice(undefined)}
          >
            최신 내용 확인했어요
          </Button>
        </section>
      )}

      <SectionHeader
        title="여행안 요약"
        description="제안된 경로와 다른 안과의 차이를 확인하세요."
      />
      <section
        className="flex min-w-0 flex-col gap-4 bg-surface-content px-(--app-inline-padding) pb-5"
        aria-label="여행안 요약 내용"
      >
        {plan.route.length > 0 ? (
          <RouteRail
            route={plan.route}
            differenceSummary={plan.differenceSummary}
          />
        ) : (
          <p className="text-base leading-relaxed text-muted-foreground">
            경로 미정
          </p>
        )}
        {plan.proposalReason && (
          <blockquote className="min-w-0 border-l-2 border-primary-border pl-3 text-base leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
            “{plan.proposalReason}”
          </blockquote>
        )}
      </section>

      <SectionHeader
        title="예상 경비"
        description="입력된 가격만 합산하며 미정 항목은 별도로 표시해요."
      />
      <MobileList aria-label="예상 경비 상세" className="bg-surface-content">
        <MobileListItem
          trailing={
            <span className="text-right text-base font-bold text-foreground">
              {plan.groupCostText}
            </span>
          }
        >
          <ItemTitle>그룹 예상액</ItemTitle>
          <ItemDescription>
            숙소와 교통에 입력된 그룹 금액 합계예요.
          </ItemDescription>
        </MobileListItem>
        <MobileListItem
          trailing={
            <span className="text-right text-base font-bold text-foreground">
              {plan.perPersonCostText}
            </span>
          }
        >
          <ItemTitle>1인 예상 참고액</ItemTitle>
          <ItemDescription>
            여행안의 기준 인원으로 나눈 금액이에요.
          </ItemDescription>
        </MobileListItem>
        {plan.costSummary.unpricedCount > 0 && (
          <MobileListItem
            trailing={
              <Badge variant="warning">
                {plan.costSummary.unpricedCount}건 미정
              </Badge>
            }
          >
            <ItemTitle>가격 확인 상태</ItemTitle>
            <ItemDescription>
              가격이 없는 항목은 합계에 포함하지 않았어요.
            </ItemDescription>
          </MobileListItem>
        )}
      </MobileList>

      <SectionHeader
        title="숙소·교통"
        description="예약 상태와 입력된 상세 정보를 일정 순서로 확인하세요."
      />
      <div className="bg-surface-content">
        <BookingRiskSummary
          items={plan.bookingRisks}
          hasDetails={plan.timelineItems.length > 0}
        />
        <DetailTimeline items={plan.timelineItems} />
      </div>

      <SectionHeader
        title="참여자 의견"
        description={
          canChangeOpinion
            ? "내 의견은 언제든 다시 저장할 수 있어요."
            : "현재 의견 현황을 확인하세요."
        }
      />
      <MobileList aria-label="참여자 의견" className="bg-surface-content">
        <MobileListItem
          chevron={canChangeOpinion}
          onClick={canChangeOpinion ? openOpinionSheet : undefined}
          aria-label={`참여자 의견, ${opinionSummary}. ${myOpinionSummary}`}
          trailing={
            <div className="flex max-w-full flex-wrap justify-end gap-1">
              {REACTION_DISPLAY.map(({ key, label }) => (
                <Badge key={key} variant="neutral">
                  {label} {opinionCounts[key]}
                </Badge>
              ))}
            </div>
          }
        >
          <div aria-live="polite" className="flex min-w-0 flex-col gap-1">
            <ItemTitle>의견 현황</ItemTitle>
            <ItemDescription>{myOpinionSummary}</ItemDescription>
          </div>
        </MobileListItem>
      </MobileList>

      {room.canCreatePlan && (
        <>
          <SectionHeader title="다른 행동" />
          <MobileList
            aria-label="여행안 보조 작업"
            className="mb-6 bg-surface-content"
          >
            <MobileListItem
              chevron
              onClick={() =>
                navigate(`/trips/${tripId}/plans/new?cloneFrom=${plan.id}`)
              }
            >
              <ItemTitle className="font-normal text-secondary-foreground">
                다른 구성으로 제안하기
              </ItemTitle>
              <ItemDescription>
                이 여행안을 복제해 새 대안을 만들어요.
              </ItemDescription>
            </MobileListItem>
          </MobileList>
        </>
      )}

      {isConfirmed ? (
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
      ) : canChangeOpinion ? (
        <BottomAction>
          <Button
            type="button"
            size="xl"
            disabled={
              submitOpinionMutation.isPending || isResolvingConflict || !isOnline
            }
            aria-busy={submitOpinionMutation.isPending || isResolvingConflict}
            onClick={openOpinionSheet}
          >
            {!isOnline
              ? "온라인 연결 후 의견 저장"
              : plan.myReaction
                ? "내 의견 수정하기"
                : "내 의견 남기기"}
          </Button>
        </BottomAction>
      ) : null}

      <Drawer
        open={isManagementDrawerOpen}
        onOpenChange={(open) => {
          if (!open && (deletePlanMutation.isPending || isResolvingConflict))
            return;
          setIsManagementDrawerOpen(open);
        }}
        showSwipeHandle
      >
        <DrawerContent className="max-h-[60vh]!">
          <DrawerHeader>
            <DrawerTitle className="text-left text-[17px] font-bold">
              여행안 관리
            </DrawerTitle>
            <DrawerDescription className="text-left">
              이 여행안을 관리할 권한이 있는 참여자만 수정하거나 삭제할 수
              있어요.
            </DrawerDescription>
          </DrawerHeader>
          <div className="min-h-0 flex-1 overflow-y-auto bg-surface-raised">
            <MobileList aria-label="여행안 관리" className="pb-2">
              <MobileListItem
                chevron
                onClick={() => {
                  setIsManagementDrawerOpen(false);
                  navigate(`/trips/${tripId}/plans/${plan.id}/edit`);
                }}
              >
                <ItemTitle>여행안 수정</ItemTitle>
                <ItemDescription>작성한 내용을 고쳐요.</ItemDescription>
              </MobileListItem>
              <MobileListItem
                onClick={() => {
                  setDeleteError(undefined);
                  setIsManagementDrawerOpen(false);
                  setIsDeleteConfirmOpen(true);
                }}
                aria-label="여행안 삭제"
              >
                <ItemTitle className="text-destructive-strong">
                  여행안 삭제
                </ItemTitle>
                <ItemDescription>삭제 전 결과를 확인해요.</ItemDescription>
              </MobileListItem>
            </MobileList>
          </div>
          <DrawerFooter>
            <Button
              type="button"
              size="xl"
              variant="secondary"
              onClick={() => setIsManagementDrawerOpen(false)}
            >
              닫기
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <AlertDialog
        open={isDeleteConfirmOpen}
        onOpenChange={(open) => {
          if (!open && (deletePlanMutation.isPending || isResolvingConflict))
            return;
          setIsDeleteConfirmOpen(open);
          if (!open) setDeleteError(undefined);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>여행안을 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              ‘{plan.title}’ 여행안과 작성한 내용이 영구 삭제되며 되돌릴 수
              없어요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <p
              role="alert"
              className="text-base leading-relaxed text-destructive-strong"
            >
              {deleteError}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={deletePlanMutation.isPending || isResolvingConflict}
            >
              취소
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={
                deletePlanMutation.isPending || isResolvingConflict || !isOnline
              }
              aria-busy={deletePlanMutation.isPending || isResolvingConflict}
              onClick={() => void handleConfirmDelete()}
            >
              {deletePlanMutation.isPending || isResolvingConflict
                ? "삭제 중..."
                : "영구 삭제하기"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {canChangeOpinion && (
        <OpinionBottomSheet
          isOpen={isOpinionSheetOpen}
          onClose={() => {
            if (submitOpinionMutation.isPending || isResolvingConflict) return;
            setIsOpinionSheetOpen(false);
            setOpinionError(undefined);
          }}
          initialReaction={plan.myReaction as ReactionType | undefined}
          initialReason={plan.myOpinionReason ?? ""}
          errorMessage={opinionError}
          isOffline={!isOnline}
          isSubmitting={submitOpinionMutation.isPending || isResolvingConflict}
          onSubmit={(reaction, reason) =>
            void handleOpinionSubmit(reaction, reason)
          }
        />
      )}
    </PageBody>
  );
}
