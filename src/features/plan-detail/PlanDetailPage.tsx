import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Result } from "effect";
import { toast } from "sonner";
import { useTripRoomDetailQuery } from "./queries.ts";
import { useSubmitOpinionMutation } from "./mutations.ts";
import { useDeletePlanMutation } from "../plan-editor/mutations.ts";
import { decodeRouteParams, PlanParamsSchema } from "../../app/routes/route-params.ts";
import { RouteErrorFallback } from "../common/RouteErrorFallback.tsx";
import { toUserMessage } from "../common/error-message.ts";
import { useSessionQuery } from "../../hooks/useSession.ts";
import { RouteRail } from "../common/RouteRail.tsx";
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

type PlanSheet = "cost" | "details" | "actions" | null;

const reactionLabels: Record<ReactionType, string> = {
  LIKE: "좋아요",
  OKAY: "괜찮아요",
  HARD: "어려워요",
};

const getPlanBadgeVariant = (
  isConfirmed: boolean,
  planTag: string
): "info" | "success-solid" | "neutral" =>
  isConfirmed ? "success-solid" : planTag === "ALTERNATIVE" ? "neutral" : "info";

export function PlanDetailPage(): JSX.Element {
  const params = useParams();
  const navigate = useNavigate();
  const validated = decodeRouteParams(PlanParamsSchema, params);
  const tripId = Result.isSuccess(validated) ? validated.success.tripId : "";
  const planId = Result.isSuccess(validated) ? validated.success.planId : "";

  const { isError: isSessionError, error: sessionError } = useSessionQuery();
  const { data: room, isLoading, isError, error } = useTripRoomDetailQuery(tripId);
  const submitOpinionMutation = useSubmitOpinionMutation();
  const deletePlanMutation = useDeletePlanMutation();
  const [isOpinionSheetOpen, setIsOpinionSheetOpen] = useState(false);
  const [sheet, setSheet] = useState<PlanSheet>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

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

  const isConfirmed = plan.id === room.confirmedPlanId;
  const isRoomConfirmed = Boolean(room.confirmedPlanId);
  const canChangeOpinion = !isRoomConfirmed;
  const canManage = !isRoomConfirmed && !isConfirmed && Boolean(plan.canManage);
  const opinionSummary = `좋아요 ${plan.opinions.likeCount} · 괜찮아요 ${plan.opinions.okayCount} · 어려워요 ${plan.opinions.hardCount}`;
  const myOpinionSummary = plan.myReaction
    ? `내 의견: ${reactionLabels[plan.myReaction]}`
    : "아직 내 의견이 없어요";

  const handleOpinionSubmit = async (
    reaction: ReactionType,
    reason?: string
  ): Promise<void> => {
    if (submitOpinionMutation.isPending) return;

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
    } catch (err: unknown) {
      toast(toUserMessage(err, "의견을 등록하지 못했습니다."));
    }
  };

  const handleConfirmDelete = async (): Promise<void> => {
    if (deletePlanMutation.isPending) return;

    try {
      await deletePlanMutation.mutateAsync({
        roomId: room.id,
        planId: plan.id,
        expectedRevision: room.revision,
      });
      setIsDeleteConfirmOpen(false);
      navigate(`/trips/${tripId}/plans`, { replace: true });
    } catch (err: unknown) {
      setIsDeleteConfirmOpen(false);
      toast(toUserMessage(err, "여행안 삭제에 실패했습니다."));
    }
  };

  return (
    <PageBody withBottomAction className="mx-auto box-border w-full max-w-[640px] px-5">
      {/* 헤더: 여행안 제목 + 태그/메타 + 관리 action */}
      <div className="flex items-start justify-between gap-3 py-2">
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="text-[22px] leading-tight font-bold text-foreground">{plan.title}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={getPlanBadgeVariant(isConfirmed, plan.planTag)}>
              {isConfirmed ? "확정안" : plan.planTagLabel}
            </Badge>
            <span className="text-[13px] text-muted-foreground">
              제안자 {plan.authorName} · {plan.period} · {plan.nights}박 {plan.days}일
            </span>
          </div>
        </div>
        {canManage && (
          <Button
            type="button"
            variant="ghost"
            className="shrink-0 text-primary"
            onClick={() => setSheet("actions")}
          >
            더보기
          </Button>
        )}
      </div>

      <section className="flex flex-col gap-4 px-1 pt-1 pb-5" aria-label="여행안 요약">
        <RouteRail route={plan.route} differenceSummary={plan.differenceSummary} />
        {plan.proposalReason && (
          <p className="text-sm leading-normal text-muted-foreground">“{plan.proposalReason}”</p>
        )}
      </section>

      <MobileList aria-label="여행안 핵심 정보">
        <MobileListItem
          chevron
          className="px-2"
          onClick={() => setSheet("cost")}
          aria-label={`예상 경비, ${plan.perPersonCostText}`}
          trailing={
            <span className="max-w-[150px] text-right text-[13px] font-bold whitespace-normal text-secondary-foreground">
              {plan.perPersonCostText}
            </span>
          }
        >
          <ItemTitle>예상 경비</ItemTitle>
          <ItemDescription>{plan.groupCostText}</ItemDescription>
        </MobileListItem>

        <BookingRiskSummary
          items={plan.bookingRisks}
          hasDetails={plan.timelineItems.length > 0}
          onClick={() => setSheet("details")}
        />

        <MobileListItem
          chevron={canChangeOpinion}
          className="px-2"
          onClick={canChangeOpinion ? () => setIsOpinionSheetOpen(true) : undefined}
          aria-label={`참여자 의견, ${opinionSummary}. ${myOpinionSummary}`}
          trailing={
            <span className="max-w-[150px] text-right text-[13px] whitespace-normal text-muted-foreground">
              {opinionSummary}
            </span>
          }
        >
          <div aria-live="polite" className="flex min-w-0 flex-col gap-1">
            <ItemTitle>참여자 의견</ItemTitle>
            <ItemDescription>{myOpinionSummary}</ItemDescription>
          </div>
        </MobileListItem>
      </MobileList>

      {!isRoomConfirmed && (
        <>
          <SectionHeader className="px-0" title="다른 행동" />
          <MobileList aria-label="여행안 보조 작업" className="mb-6">
            <MobileListItem
              chevron
              className="px-2"
              onClick={() => navigate(`/trips/${tripId}/plans/new?cloneFrom=${plan.id}`)}
            >
              <ItemTitle className="font-normal text-secondary-foreground">
                다른 구성으로 제안하기
              </ItemTitle>
              <ItemDescription>이 여행안을 복제해 새 대안을 만들어요.</ItemDescription>
            </MobileListItem>
          </MobileList>
        </>
      )}

      {isConfirmed ? (
        <BottomAction>
          <Button
            type="button"
            size="xl"
            onClick={() => navigate(`/trips/${tripId}/itinerary`, { replace: true })}
          >
            확정 일정 보기
          </Button>
        </BottomAction>
      ) : isRoomConfirmed ? null : (
        <BottomAction>
          <Button
            type="button"
            size="xl"
            disabled={submitOpinionMutation.isPending}
            onClick={() => setIsOpinionSheetOpen(true)}
          >
            {plan.myReaction ? "내 의견 수정하기" : "내 의견 남기기"}
          </Button>
        </BottomAction>
      )}

      {/* 예상 경비 / 숙소·교통 상세 / 관리 Drawer */}
      <Drawer
        open={sheet !== null}
        onOpenChange={(open) => {
          if (!open) setSheet(null);
        }}
        showSwipeHandle
        // 숙소·교통 상세만 기존 expand 동작(84vh → 94vh)을 유지해요.
        snapPoints={sheet === "details" ? [0.84, 0.94] : undefined}
        defaultSnapPoint={sheet === "details" ? 0.84 : undefined}
      >
        {/*
          확장이 없던 sheet는 기존 maxHeight 60vh 상한을 유지해요.
          Drawer 내부의 data-variant sizing 유틸리티보다 우선해야 해서 important를 써요.
        */}
        <DrawerContent className={sheet === "details" ? undefined : "max-h-[60vh]!"}>
          <DrawerHeader>
            <DrawerTitle className="text-left text-[17px] font-bold">
              {sheet === "actions" ? "여행안 관리" : sheet === "cost" ? "예상 경비" : "숙소·교통 상세"}
            </DrawerTitle>
            <DrawerDescription className="text-left">
              {sheet === "actions"
                ? "작성자만 여행안을 관리할 수 있어요."
                : sheet === "cost"
                  ? "여행안에 기록한 예상 비용 스냅샷이에요."
                  : "숙소·교통 예약 정보와 확인 상태를 살펴보세요."}
            </DrawerDescription>
          </DrawerHeader>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {sheet === "actions" ? (
              <MobileList aria-label="여행안 관리" className="pb-2">
                <MobileListItem
                  chevron
                  onClick={() => {
                    setSheet(null);
                    navigate(`/trips/${tripId}/plans/${plan.id}/edit`);
                  }}
                >
                  <ItemTitle>여행안 수정</ItemTitle>
                  <ItemDescription>작성한 내용을 고쳐요.</ItemDescription>
                </MobileListItem>
                <MobileListItem
                  onClick={() => {
                    setSheet(null);
                    setIsDeleteConfirmOpen(true);
                  }}
                  aria-label="여행안 삭제"
                >
                  <ItemTitle className="text-destructive-strong">여행안 삭제</ItemTitle>
                  <ItemDescription>삭제 전 한 번 더 확인해요.</ItemDescription>
                </MobileListItem>
              </MobileList>
            ) : sheet === "cost" ? (
              <MobileList aria-label="예상 경비 상세" className="pb-2">
                <MobileListItem
                  trailing={
                    <span className="text-[15px] font-bold text-foreground">
                      {plan.groupCostText}
                    </span>
                  }
                >
                  <p className="text-[15px] text-foreground">그룹 총액</p>
                </MobileListItem>
                <MobileListItem
                  trailing={
                    <span className="text-[15px] font-bold text-foreground">
                      {plan.perPersonCostText}
                    </span>
                  }
                >
                  <p className="text-[15px] text-foreground">1인 예상 참고액</p>
                </MobileListItem>
              </MobileList>
            ) : (
              <DetailTimeline items={plan.timelineItems} />
            )}
          </div>

          <DrawerFooter>
            <Button type="button" size="xl" onClick={() => setSheet(null)}>
              닫기
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* 여행안 삭제 confirm */}
      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>여행안을 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              '{plan.title}' 여행안과 작성한 내용이 삭제됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletePlanMutation.isPending}>취소</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deletePlanMutation.isPending}
              onClick={() => void handleConfirmDelete()}
            >
              {deletePlanMutation.isPending ? "삭제 중..." : "삭제하기"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <OpinionBottomSheet
        isOpen={isOpinionSheetOpen}
        onClose={() => setIsOpinionSheetOpen(false)}
        initialReaction={plan.myReaction as ReactionType | undefined}
        initialReason={plan.myOpinionReason ?? ""}
        isSubmitting={submitOpinionMutation.isPending}
        onSubmit={(reaction, reason) => void handleOpinionSubmit(reaction, reason)}
      />
    </PageBody>
  );
}
