import { useState } from "react";
import { BottomSheet } from "@toss/tds-mobile";
import { useNavigate, useParams } from "react-router-dom";
import { Result } from "effect";
import { decodeRouteParams, TripParamsSchema } from "../../app/routes/route-params.ts";
import { RouteErrorFallback } from "../common/RouteErrorFallback.tsx";
import { toUserMessage } from "../common/error-message.ts";
import { PageState } from "@/components/galanda/page-state.tsx";
import { PageBody } from "@/components/galanda/page-body.tsx";
import { PageTitle } from "@/components/galanda/page-title.tsx";
import { MobileList, MobileListItem } from "@/components/galanda/mobile-list.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { ItemDescription, ItemTitle } from "@/components/ui/item.tsx";
import { RouteRail } from "../common/RouteRail.tsx";
import { useSessionQuery } from "../../hooks/useSession.ts";
import { useTripRoomRawQuery } from "../plan-detail/queries.ts";
import {
  toItineraryViewModel,
  type ItineraryItem,
} from "./itinerary-view-model.ts";

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

  const validated = decodeRouteParams(TripParamsSchema, params);
  const tripId = Result.isSuccess(validated) ? validated.success.tripId : "";

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

  const [selectedItem, setSelectedItem] = useState<ItineraryItem | null>(null);
  const [isNeedCheckSheetOpen, setIsNeedCheckSheetOpen] = useState(false);

  if (Result.isFailure(validated)) {
    return <RouteErrorFallback message="유효하지 않은 여행방 식별자입니다." />;
  }

  if (isLoading) {
    return <PageState status="loading" message="확정 일정을 불러오는 중입니다..." />;
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
        title="일정 정보를 찾을 수 없습니다"
        message={toUserMessage(error, "요청한 정보를 찾을 수 없습니다.")}
        actionText="다시 시도"
        onAction={() => void refetchRoom()}
      />
    );
  }

  const viewModel = toItineraryViewModel(rawRoom, session?.userId);

  if (!viewModel.isConfirmed || !viewModel.confirmedPlanId) {
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
              <h3 className="px-(--app-inline-padding) pt-3 pb-1 text-[14px] font-bold text-foreground">
                {section.dateHeader}
              </h3>
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
                    <ItemTitle>{item.type === "STAY" ? item.hotelName : item.routeTitle}</ItemTitle>
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

      {/* 확인 필요 예약 BottomSheet */}
      <BottomSheet
        open={isNeedCheckSheetOpen}
        onClose={() => setIsNeedCheckSheetOpen(false)}
        header={<BottomSheet.Header>확인이 필요한 예약</BottomSheet.Header>}
        headerDescription={
          <BottomSheet.HeaderDescription>
            예약 상태를 확인해야 하는 항목 {viewModel.needCheckCount}건이에요.
          </BottomSheet.HeaderDescription>
        }
        cta={<BottomSheet.CTA onClick={() => setIsNeedCheckSheetOpen(false)}>닫기</BottomSheet.CTA>}
      >
        <MobileList aria-label="확인 필요 예약 목록" className="pb-4">
          {viewModel.needCheckItems.map((item) => (
            <MobileListItem
              key={item.id}
              leading={<Badge variant={statusVariant[item.statusColor]}>{item.statusLabel}</Badge>}
            >
              <ItemTitle>{item.message}</ItemTitle>
              <ItemDescription className="text-muted-foreground/80">
                {item.snapshotInfo}
              </ItemDescription>
            </MobileListItem>
          ))}
        </MobileList>
      </BottomSheet>

      {/* 일정 항목 상세 BottomSheet */}
      <BottomSheet
        open={selectedItem !== null}
        onClose={() => setSelectedItem(null)}
        header={
          <BottomSheet.Header>
            {selectedItem?.type === "STAY" ? selectedItem.hotelName : selectedItem?.routeTitle}
          </BottomSheet.Header>
        }
        headerDescription={
          <BottomSheet.HeaderDescription>
            {selectedItem?.type === "STAY"
              ? `${selectedItem.city} · ${selectedItem.periodText} · ${selectedItem.nights}박`
              : `${selectedItem?.mode} · ${selectedItem?.hasTransfer ? "환승 필요" : "직통"} · ${selectedItem?.durationText}`}
          </BottomSheet.HeaderDescription>
        }
        cta={<BottomSheet.CTA onClick={() => setSelectedItem(null)}>닫기</BottomSheet.CTA>}
      >
        {selectedItem && (
          <MobileList aria-label="일정 상세 정보" className="pb-4">
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
            {selectedItem.bookingUrl && (
              <MobileListItem
                chevron
                onClick={() => {
                  if (selectedItem.bookingUrl) {
                    window.open(selectedItem.bookingUrl, "_blank", "noopener,noreferrer");
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
      </BottomSheet>
    </PageBody>
  );
}
