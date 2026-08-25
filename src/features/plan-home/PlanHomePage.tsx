import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTripRoomRawQuery } from "../plan-detail/queries.ts";
import { decodeRouteParams, TripParamsSchema } from "../../app/routes/route-params.ts";
import { RouteErrorFallback } from "../common/RouteErrorFallback.tsx";
import { toUserMessage } from "../common/error-message.ts";
import { useSessionQuery } from "../../hooks/useSession.ts";
import { Result } from "effect";
import { DecisionStatusBanner } from "../common/DecisionStatusBanner.tsx";
import { PageState } from "@/components/galanda/page-state.tsx";
import { PageBody } from "@/components/galanda/page-body.tsx";
import { PageTitle } from "@/components/galanda/page-title.tsx";
import { SectionHeader } from "@/components/galanda/section-header.tsx";
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
import { PlanListRow } from "./components/PlanListRow.tsx";
import { toTripRoomViewModel } from "./plan-home-view-model.ts";
import { isRoomConfirmed } from "../../core/domain/auth-guards.ts";

export function PlanHomePage() {
  const params = useParams();
  const navigate = useNavigate();

  const validated = decodeRouteParams(TripParamsSchema, params);
  const tripId = Result.isSuccess(validated) ? validated.success.tripId : "";

  const [isComparePickerOpen, setIsComparePickerOpen] = useState(false);
  const [selectedCompareIds, setSelectedCompareIds] = useState<ReadonlyArray<string>>([]);

  const {
    isError: isSessionError,
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

  if (Result.isFailure(validated)) {
    return <RouteErrorFallback message="유효하지 않은 여행방 식별자입니다." />;
  }

  if (isLoading) {
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

  const isConfirmed = isRoomConfirmed(rawRoom);
  const plans = room.plans;

  const toggleCompareSelection = (planId: string): void => {
    setSelectedCompareIds((prev) => {
      if (prev.includes(planId)) return prev.filter((id) => id !== planId);
      if (prev.length < 2) return [...prev, planId];
      // 이미 2개 선택된 상태에서 다른 카드를 탭하면 가장 오래된 선택을 교체해요.
      return [prev[1] as string, planId];
    });
  };

  const openComparePicker = (): void => {
    if (plans.length === 2) {
      navigate(`/trips/${tripId}/plans/compare?left=${plans[0].id}&right=${plans[1].id}`);
      return;
    }
    // 3개 이상이면 명시적 선택을 위해 Drawer를 열어요. 초기값은 비워두고 사용자가 고르게 해요.
    if (selectedCompareIds.length === 0 && plans.length >= 2) {
      setSelectedCompareIds([plans[0].id, plans[1].id].slice(0, 2));
    }
    setIsComparePickerOpen(true);
  };

  const handleCompareConfirm = (): void => {
    if (selectedCompareIds.length !== 2) return;
    const [left, right] = selectedCompareIds as [string, string];
    setIsComparePickerOpen(false);
    navigate(`/trips/${tripId}/plans/compare?left=${left}&right=${right}`);
  };

  const primaryCta = isConfirmed
    ? {
        label: "확정 일정 보기",
        onClick: () => navigate(`/trips/${tripId}/itinerary`, { replace: true }),
      }
    : plans.length === 1
      ? {
          label: "새 여행안 제안하기",
          onClick: () => navigate(`/trips/${tripId}/plans/new`),
        }
      : plans.length === 0
        ? {
            label: "첫 여행안 만들기",
            onClick: () => navigate(`/trips/${tripId}/plans/new`),
          }
        : {
            label: "여행안 비교하기",
            onClick: openComparePicker,
          };

  return (
    <PageBody withBottomAction={plans.length > 0}>
      <PageTitle
        title={room.title}
        description={`${room.destination} · ${room.period} · 참여 ${room.memberCount}명`}
      />

      <DecisionStatusBanner
        statusText={room.decisionStatusText}
        subText={room.decisionSubText}
        isConfirmed={isConfirmed}
      />

      <SectionHeader title="여행안" description="후보를 훑어보고 자세히 볼 여행안을 선택하세요." />

      {plans.length === 0 ? (
        <PageState
          status="empty"
          title="아직 여행안이 없어요"
          description="첫 여행안을 만들어 친구들과 함께 골라보세요."
          actionText={primaryCta.label}
          onAction={primaryCta.onClick}
        />
      ) : (
        <MobileList aria-label="제안된 여행안">
          {plans.map((plan) => (
            <PlanListRow key={plan.id} plan={plan} to={`/trips/${tripId}/plans/${plan.id}`} />
          ))}
        </MobileList>
      )}

      {plans.length > 0 && (
        <BottomAction>
          <Button type="button" size="xl" onClick={primaryCta.onClick}>
            {primaryCta.label}
          </Button>
        </BottomAction>
      )}

      {/* 3개 이상일 때 명시적 2개 선택 Drawer */}
      <Drawer open={isComparePickerOpen} onOpenChange={setIsComparePickerOpen} showSwipeHandle>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="text-left text-[17px] font-bold">비교할 여행안 2개 선택</DrawerTitle>
            <DrawerDescription className="text-left">
              {selectedCompareIds.length === 2
                ? "선택한 2개의 여행안을 비교해요."
                : `여행안을 ${selectedCompareIds.length}/2개 선택했어요. 하나를 더 선택해주세요.`}
            </DrawerDescription>
          </DrawerHeader>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <MobileList aria-label="비교 대상 선택">
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
                        <Badge variant="info-solid">선택 {selectedIndex + 1}</Badge>
                      ) : undefined
                    }
                  >
                    <ItemTitle className="line-clamp-1">{plan.title}</ItemTitle>
                    <ItemDescription>
                      {plan.planTagLabel} · {plan.authorName} 제안 · {plan.nights}박 {plan.days}일
                    </ItemDescription>
                  </MobileListItem>
                );
              })}
            </MobileList>
          </div>
          <DrawerFooter className="flex-row *:min-w-0 *:flex-1">
            <Button type="button" size="xl" variant="secondary" onClick={() => setIsComparePickerOpen(false)}>
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
