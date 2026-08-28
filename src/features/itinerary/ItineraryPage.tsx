import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Result } from "effect";
import { decodeRouteParams, TripParamsSchema } from "../../app/routes/route-params.ts";
import { RouteErrorFallback } from "../common/RouteErrorFallback.tsx";
import { isRevisionConflict, toUserMessage } from "../common/error-message.ts";
import { PageState } from "@/components/galanda/page-state.tsx";
import { PageBody } from "@/components/galanda/page-body.tsx";
import { PageTitle } from "@/components/galanda/page-title.tsx";
import { MobileList, MobileListItem } from "@/components/galanda/mobile-list.tsx";
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
import { RouteRail } from "../common/RouteRail.tsx";
import { platform } from "../../platform/index.ts";
import { useItineraryQuery } from "./queries.ts";
import { useAcknowledgeItineraryMutation } from "./mutations.ts";
import {
  toItineraryViewModel,
  type ItineraryItem,
} from "./itinerary-view-model.ts";
import {
  getRecommendationActionContext,
  trackRecommendationEvent,
} from "../common/recommendation.ts";

/** 뷰모델의 TDS 시절 상태 색 이름을 semantic badge variant로 옮겨요. */
const statusVariant = {
  green: "success",
  yellow: "warning",
  red: "danger",
  elephant: "neutral",
} as const;

export function ItineraryPage(): JSX.Element {
  const params = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const validated = decodeRouteParams(TripParamsSchema, params);
  const tripId = Result.isSuccess(validated) ? validated.success.tripId : "";

  const {
    data: itineraryState,
    isLoading,
    isError,
    error,
    refetch: refetchItinerary,
  } = useItineraryQuery(tripId);

  const [selectedItem, setSelectedItem] = useState<ItineraryItem | null>(null);
  const [isNeedCheckSheetOpen, setIsNeedCheckSheetOpen] = useState(false);
  const [isChangeReviewOpen, setIsChangeReviewOpen] = useState(false);
  const acknowledgeMutation = useAcknowledgeItineraryMutation();
  const [conflictNotice, setConflictNotice] = useState<string>();
  const [drawerConflictNotice, setDrawerConflictNotice] = useState<string>();
  const [isResolvingConflict, setIsResolvingConflict] = useState(false);
  const completedRecommendationId = useRef<string>();
  const recommendationAction = getRecommendationActionContext(location.state);

  useEffect(() => {
    if (
      recommendationAction?.actionId === "VIEW_ITINERARY" &&
      itineraryState?.status === "CONFIRMED" &&
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
  }, [itineraryState, recommendationAction, tripId]);

  if (Result.isFailure(validated)) {
    return <RouteErrorFallback message="유효하지 않은 여행방 식별자입니다." />;
  }

  if (isLoading) {
    return <PageState status="loading" message="확정 일정을 불러오는 중입니다..." />;
  }

  if (isError || !itineraryState) {
    return (
      <RouteErrorFallback
        title="일정 정보를 찾을 수 없습니다"
        message={toUserMessage(error, "요청한 정보를 찾을 수 없습니다.")}
        actionText="다시 시도"
        onAction={() => void refetchItinerary()}
      />
    );
  }

  if (itineraryState.status === "UNCONFIRMED") {
    return (
      <PageBody>
        <PageState
          status="empty"
          title="아직 확정된 일정이 없어요"
          description="팀원들과 후보 여행안을 검토하고 마음에 드는 계획을 확정해보세요."
          actionText="후보 여행안 보러가기"
          onAction={() => navigate(`/trips/${tripId}/plans`, { replace: true })}
        />
      </PageBody>
    );
  }

  if (itineraryState.status === "MISSING") {
    return (
      <PageBody>
        <PageState
          status="error"
          title="확정 일정 데이터가 없어요"
          description="기존 확정 정보는 있지만 저장된 확정 일정이 없습니다. 복구가 필요합니다."
          actionText="후보 여행안 보러가기"
          onAction={() => navigate(`/trips/${tripId}/plans`, { replace: true })}
        />
      </PageBody>
    );
  }

  const viewModel = toItineraryViewModel(itineraryState.itinerary);
  const changedItemIds = new Set(
    (itineraryState.itinerary.changes ?? []).map(({ itemId }) => itemId)
  );
  const isAcknowledged =
    itineraryState.viewerAcknowledgedRevision ===
    itineraryState.itinerary.currentRevision;

  return (
    <PageBody className="mx-auto box-border max-w-[640px]">
      {/* 1. 상단 확정 Summary */}
      <section className="flex flex-col gap-2" aria-label="확정 일정 요약">
        <div className="mt-1 px-(--app-inline-padding)">
          <Badge variant="success">최종 확정</Badge>
        </div>
        <PageTitle
          className="py-1"
          title={viewModel.confirmedPlanTitle}
          description={`${viewModel.destination} · ${viewModel.periodText} · ${viewModel.nights}박 ${viewModel.days}일`}
        />
      </section>

      {/* 경로 레일 (RouteRail) */}
      {viewModel.route.length > 0 && (
        <div className="px-(--app-inline-padding) pb-4">
          <RouteRail route={viewModel.route} differenceSummary={viewModel.differenceSummary} />
        </div>
      )}

      {(itineraryState.itinerary.currentRevision > 1 || itineraryState.canEdit) && (
        <section className="mb-4 px-(--app-inline-padding)" aria-label="일정 변경 확인">
          <div className="rounded-xl bg-muted p-4">
            <p className="text-[15px] font-bold text-foreground">
              {itineraryState.itinerary.currentRevision > 1
                ? `일정이 v${itineraryState.itinerary.currentRevision}로 변경됐어요`
                : "확정 일정 v1"}
            </p>
            {itineraryState.itinerary.currentRevision > 1 && (
              <p className="mt-1 text-[13px] text-muted-foreground">
                아직 확인하지 않은 참여자 {itineraryState.unacknowledgedCount}명
              </p>
            )}
            <div className="mt-3 flex gap-2">
              {itineraryState.itinerary.currentRevision > 1 && !isAcknowledged && (
                <Button
                  type="button"
                  size="sm"
                  disabled={acknowledgeMutation.isPending || isResolvingConflict}
                  onClick={() => {
                    acknowledgeMutation.reset();
                    setConflictNotice(undefined);
                    setDrawerConflictNotice(undefined);
                    setIsChangeReviewOpen(true);
                  }}
                >
                  변경 내용 확인
                </Button>
              )}
              {itineraryState.canEdit && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(`/trips/${tripId}/itinerary/edit`)}
                >
                  일정 수정
                </Button>
              )}
            </div>
            {conflictNotice ? (
              <p className="mt-2 text-[13px] text-warning" role="alert">
                {conflictNotice}
              </p>
            ) : acknowledgeMutation.isError && (
              <p className="mt-2 text-[13px] text-destructive">
                {toUserMessage(acknowledgeMutation.error, "확인 상태를 저장하지 못했습니다.")}
              </p>
            )}
          </div>
        </section>
      )}

      {/* 2. 확인 필요 예약 Summary Row (Need-Check) */}
      {viewModel.needCheckCount > 0 && (
        <section className="mb-4" aria-label="확인 필요 예약 요약">
          <MobileList aria-label="확인 필요 예약">
            <MobileListItem
              chevron
              onClick={() => setIsNeedCheckSheetOpen(true)}
              aria-label={`확인이 필요한 예약 ${viewModel.needCheckCount}개`}
              leading={
                <Badge variant={viewModel.hasNeedCheckDanger ? "danger" : "warning"}>
                  확인 필요
                </Badge>
              }
              trailing={
                <Badge variant={viewModel.hasNeedCheckDanger ? "danger" : "warning"}>
                  {viewModel.needCheckCount}건
                </Badge>
              }
            >
              <ItemTitle>확인이 필요한 예약 {viewModel.needCheckCount}개</ItemTitle>
              <ItemDescription>예약 상태를 확인하고 일정을 점검해주세요.</ItemDescription>
            </MobileListItem>
          </MobileList>
        </section>
      )}

      {/* 3. 날짜별 일정 목록 (Date-based Sections) */}
      <section aria-label="날짜별 상세 일정">
        {viewModel.sections.length === 0 ? (
          <p className="px-(--app-inline-padding) py-3.5 text-[15px] text-muted-foreground">
            등록된 숙소·교통 일정이 없어요.
          </p>
        ) : (
          viewModel.sections.map((section) => (
            <div key={section.id} id={section.id} className="mb-2">
              <h2 className="px-(--app-inline-padding) pt-3 pb-1 text-[14px] font-bold text-foreground">
                {section.dateHeader}
              </h2>
              <MobileList aria-label={section.dateHeader}>
                {section.items.map((item) => (
                  <MobileListItem
                    key={item.id}
                    chevron
                    onClick={() => setSelectedItem(item)}
                    aria-label={`${item.type === "STAY" ? item.hotelName : item.routeTitle}, ${item.subText}`}
                    leading={
                      <Badge variant={item.type === "STAY" ? "info" : "neutral"}>
                        {item.type === "STAY" ? "숙소" : "이동"}
                      </Badge>
                    }
                    trailing={
                      <Badge variant={statusVariant[item.statusColor]}>{item.statusLabel}</Badge>
                    }
                  >
                    <ItemTitle className="flex items-center gap-2">
                      {item.type === "STAY" ? item.hotelName : item.routeTitle}
                      {changedItemIds.has(item.id) && (
                        <Badge variant="warning">변경됨</Badge>
                      )}
                    </ItemTitle>
                    <ItemDescription className="line-clamp-1">{item.subText}</ItemDescription>
                  </MobileListItem>
                ))}
              </MobileList>
            </div>
          ))
        )}
      </section>

      {/* 4. 하단 보조 작업: 후보 여행안 목록 보기 */}
      <div className="mt-6 pb-8">
        <MobileList aria-label="여행안 목록으로 이동">
          <MobileListItem chevron onClick={() => navigate(`/trips/${tripId}/plans`)}>
            <ItemTitle className="font-normal text-secondary-foreground">
              검토했던 여행안 기록 보기
            </ItemTitle>
            <ItemDescription>후보 여행안 목록과 참여자 의견을 확인해요.</ItemDescription>
          </MobileListItem>
        </MobileList>
      </div>

      {/* 확인 필요 예약 Drawer */}
      <Drawer
        open={isNeedCheckSheetOpen}
        onOpenChange={(open) => setIsNeedCheckSheetOpen(Boolean(open))}
        showSwipeHandle
      >
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="text-left text-[17px] font-bold">
              확인이 필요한 예약
            </DrawerTitle>
            <DrawerDescription className="text-left">
              예약 상태를 확인해야 하는 항목 {viewModel.needCheckCount}건이에요.
            </DrawerDescription>
          </DrawerHeader>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <MobileList aria-label="확인 필요 예약 목록" className="pb-2">
              {viewModel.needCheckItems.map((item) => (
                <MobileListItem
                  key={item.id}
                  leading={
                    <Badge variant={statusVariant[item.statusColor]}>{item.statusLabel}</Badge>
                  }
                >
                  <ItemTitle className="line-clamp-2 whitespace-normal">{item.message}</ItemTitle>
                  <ItemDescription className="text-muted-foreground/80">
                    {item.snapshotInfo}
                  </ItemDescription>
                </MobileListItem>
              ))}
            </MobileList>
          </div>
          <DrawerFooter>
            <Button type="button" size="xl" onClick={() => setIsNeedCheckSheetOpen(false)}>
              닫기
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* 일정 변경 리뷰 Drawer: 변경 전후를 확인하고 명시적으로 확인해요 */}
      <Drawer
        open={isChangeReviewOpen}
        onOpenChange={(open) => {
          if (open) {
            acknowledgeMutation.reset();
            setConflictNotice(undefined);
            setDrawerConflictNotice(undefined);
          }
          setIsChangeReviewOpen(Boolean(open));
        }}
        showSwipeHandle
      >
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="text-left text-[17px] font-bold">
              변경된 일정 확인
            </DrawerTitle>
            <DrawerDescription className="text-left">
              {itineraryState.status === "CONFIRMED" && itineraryState.itinerary.changes?.length
                ? `v${itineraryState.itinerary.currentRevision}에서 ${itineraryState.itinerary.changes.length}개 항목이 변경됐어요. 내용을 확인한 뒤 알려주세요.`
                : "변경된 항목을 확인하고 알려주세요."}
            </DrawerDescription>
          </DrawerHeader>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {itineraryState.status === "CONFIRMED" && itineraryState.itinerary.changes?.length ? (
              <MobileList aria-label="변경된 일정 항목">
                {itineraryState.itinerary.changes.map(({ itemId, before, after }) => {
                  const changedFields: ReadonlyArray<{ label: string; before: string; after: string }> = (() => {
                    if (before.type === "STAY" && after.type === "STAY") {
                      const fields: Array<{ label: string; before: string; after: string }> = [];
                      if (before.accommodation.hotelName !== after.accommodation.hotelName) {
                        fields.push({ label: "숙소", before: before.accommodation.hotelName || "(호텔명 없음)", after: after.accommodation.hotelName || "(호텔명 없음)" });
                      }
                      if (before.accommodation.city !== after.accommodation.city) {
                        fields.push({ label: "도시", before: before.accommodation.city, after: after.accommodation.city });
                      }
                      if (before.date !== after.date) {
                        fields.push({ label: "도착일", before: before.date, after: after.date });
                      }
                      if (before.endDate !== after.endDate) {
                        fields.push({ label: "출발일", before: before.endDate, after: after.endDate });
                      }
                      if ((before.memo ?? "") !== (after.memo ?? "")) {
                        fields.push({ label: "메모", before: before.memo?.trim() || "(메모 없음)", after: after.memo?.trim() || "(메모 없음)" });
                      }
                      if (before.accommodation.bookingStatus !== after.accommodation.bookingStatus) {
                        fields.push({ label: "예약 상태", before: before.accommodation.bookingStatus, after: after.accommodation.bookingStatus });
                      }
                      if (fields.length === 0) {
                        fields.push({ label: "숙소", before: before.accommodation.hotelName, after: after.accommodation.hotelName });
                      }
                      return fields;
                    }
                    if (before.type === "TRANSPORT" && after.type === "TRANSPORT") {
                      const fields: Array<{ label: string; before: string; after: string }> = [];
                      if (before.transport.fromCity !== after.transport.fromCity) {
                        fields.push({ label: "출발지", before: before.transport.fromCity, after: after.transport.fromCity });
                      }
                      if (before.transport.toCity !== after.transport.toCity) {
                        fields.push({ label: "도착지", before: before.transport.toCity, after: after.transport.toCity });
                      }
                      if (before.transport.mode !== after.transport.mode) {
                        fields.push({ label: "수단", before: before.transport.mode || "(수단 없음)", after: after.transport.mode || "(수단 없음)" });
                      }
                      if (before.transport.hasTransfer !== after.transport.hasTransfer) {
                        fields.push({ label: "환승", before: before.transport.hasTransfer ? "환승 필요" : "직통", after: after.transport.hasTransfer ? "환승 필요" : "직통" });
                      }
                      if (before.date !== after.date) {
                        fields.push({ label: "이동일", before: before.date, after: after.date });
                      }
                      if ((before.memo ?? "") !== (after.memo ?? "")) {
                        fields.push({ label: "메모", before: before.memo?.trim() || "(메모 없음)", after: after.memo?.trim() || "(메모 없음)" });
                      }
                      if (fields.length === 0) {
                        fields.push({ label: "이동", before: `${before.transport.fromCity} → ${before.transport.toCity}`, after: `${after.transport.fromCity} → ${after.transport.toCity}` });
                      }
                      return fields;
                    }
                    return [];
                  })();
                  const title = after.type === "STAY" ? after.accommodation.hotelName : `${after.transport.fromCity} → ${after.transport.toCity}`;
                  return (
                    <MobileListItem key={itemId}>
                      <ItemTitle className="flex items-center gap-2">
                        {title}
                        <Badge variant="warning">변경됨</Badge>
                      </ItemTitle>
                      <div className="flex flex-col gap-1.5 pt-1.5">
                        {changedFields.map((field) => (
                          <div key={field.label} className="grid min-w-0 grid-cols-[52px_minmax(0,1fr)] gap-2">
                            <span className="text-xs font-bold text-muted-foreground">{field.label}</span>
                            <span className="min-w-0 text-[13px] break-words">
                              <span className="text-secondary-foreground line-through decoration-muted-foreground/50">{field.before}</span>
                              <span className="px-1 text-muted-foreground">→</span>
                              <span className="font-bold text-info">{field.after}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </MobileListItem>
                  );
                })}
              </MobileList>
            ) : (
              <p className="px-(--app-inline-padding) py-4 text-[13px] text-muted-foreground">
                변경된 항목이 없거나 불러오는 중이에요. 새로고침 후 다시 확인해주세요.
              </p>
            )}
            {(drawerConflictNotice || acknowledgeMutation.isError) && (
              <div className="px-(--app-inline-padding) pt-2">
                <p className="text-[13px] text-warning" role="alert">
                  {drawerConflictNotice ?? toUserMessage(acknowledgeMutation.error, "확인 상태를 저장하지 못했습니다.")}
                </p>
              </div>
            )}
          </div>
          <DrawerFooter className="flex-row *:min-w-0 *:flex-1">
            <Button type="button" size="xl" variant="secondary" onClick={() => setIsChangeReviewOpen(false)}>
              나중에 확인
            </Button>
            <Button
              type="button"
              size="xl"
              disabled={acknowledgeMutation.isPending || isResolvingConflict}
              onClick={() => {
                if (acknowledgeMutation.isPending || isResolvingConflict) return;
                setConflictNotice(undefined);
                setDrawerConflictNotice(undefined);
                void acknowledgeMutation
                  .mutateAsync({
                    tripId,
                    expectedRevision: itineraryState.status === "CONFIRMED" ? itineraryState.itinerary.currentRevision : 1,
                  })
                  .then(() => setIsChangeReviewOpen(false))
                  .catch(async (mutationError: unknown) => {
                    if (isRevisionConflict(mutationError)) {
                      setIsResolvingConflict(true);
                      const refreshed = await refetchItinerary();
                      const message = refreshed.isError || !refreshed.data
                        ? "최신 일정 상태를 불러오지 못했습니다. 다시 시도해주세요."
                        : "일정이 다시 변경되어 최신 내용을 불러왔어요. 새 내용을 확인한 뒤 다시 알려주세요.";
                      setDrawerConflictNotice(message);
                      setConflictNotice(message);
                      setIsResolvingConflict(false);
                    } else {
                      setDrawerConflictNotice(toUserMessage(mutationError, "확인 상태를 저장하지 못했습니다."));
                    }
                  });
              }}
            >
              {acknowledgeMutation.isPending ? "확인 중..." : isResolvingConflict ? "불러오는 중..." : "확인했어요"}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* 일정 항목 상세 Drawer */}
      <Drawer
        open={selectedItem !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedItem(null);
        }}
        showSwipeHandle
      >
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="text-left text-[17px] font-bold">
              {selectedItem?.type === "STAY" ? selectedItem.hotelName : selectedItem?.routeTitle}
            </DrawerTitle>
            <DrawerDescription className="text-left">
              {selectedItem?.type === "STAY"
                ? `${selectedItem.city} · ${selectedItem.periodText} · ${selectedItem.nights}박`
                : `${selectedItem?.mode} · ${selectedItem?.hasTransfer ? "환승 필요" : "직통"} · ${selectedItem?.durationText}`}
            </DrawerDescription>
          </DrawerHeader>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {selectedItem && (
              <MobileList aria-label="일정 상세 정보" className="pb-2">
            <MobileListItem
              trailing={
                <Badge variant={selectedItem.type === "STAY" ? "info" : "neutral"}>
                  {selectedItem.type === "STAY" ? "숙소" : "교통편"}
                </Badge>
              }
            >
              <p className="text-[15px] text-foreground">구분</p>
            </MobileListItem>
            <MobileListItem
              trailing={
                <Badge variant={statusVariant[selectedItem.statusColor]}>
                  {selectedItem.statusLabel}
                </Badge>
              }
            >
              <p className="text-[15px] text-foreground">예약 상태</p>
            </MobileListItem>
            <MobileListItem
              trailing={
                <span className="text-[15px] font-bold text-foreground">
                  {selectedItem.priceText}
                </span>
              }
            >
              <p className="text-[15px] text-foreground">예상 경비</p>
            </MobileListItem>
            <MobileListItem
              trailing={
                <span className="text-right text-[13px] text-muted-foreground">
                  {selectedItem.confirmedInfo}
                </span>
              }
            >
              <p className="text-[15px] text-foreground">확인 정보</p>
            </MobileListItem>
            {selectedItem.memo && (
              <MobileListItem>
                <ItemTitle>메모</ItemTitle>
                <ItemDescription className="whitespace-pre-wrap">
                  {selectedItem.memo}
                </ItemDescription>
              </MobileListItem>
            )}
            {selectedItem.bookingUrl && (
              <MobileListItem
                chevron
                onClick={() => {
                  if (selectedItem.bookingUrl) {
                    void platform.openExternalUrl(selectedItem.bookingUrl);
                  }
                }}
              >
                <ItemTitle className="text-primary">
                  {selectedItem.type === "STAY" ? "숙소 예약 링크 열기" : "교통 예매 링크 열기"}
                </ItemTitle>
              </MobileListItem>
            )}
              </MobileList>
            )}
          </div>
          <DrawerFooter>
            <Button type="button" size="xl" onClick={() => setSelectedItem(null)}>
              닫기
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </PageBody>
  );
}
