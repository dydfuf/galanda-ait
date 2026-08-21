import { useState } from "react";
import { css } from "@emotion/react";
import {
  Badge,
  BottomSheet,
  List,
  ListHeader,
  ListRow,
  Text,
  Top,
} from "@toss/tds-mobile";
import { useNavigate, useParams } from "react-router-dom";
import { Result } from "effect";
import { decodeRouteParams, TripParamsSchema } from "../../app/routes/route-params.ts";
import { RouteErrorFallback } from "../common/RouteErrorFallback.tsx";
import { toUserMessage } from "../common/error-message.ts";
import { PageState } from "@/components/galanda/page-state.tsx";
import { RouteRail } from "../common/RouteRail.tsx";
import { tdsPageStyle } from "../common/tds-layout.ts";
import { useSessionQuery } from "../../hooks/useSession.ts";
import { useTripRoomRawQuery } from "../plan-detail/queries.ts";
import {
  toItineraryViewModel,
  type ItineraryItem,
} from "./itinerary-view-model.ts";

const pageStyle = css`
  ${tdsPageStyle};
  max-width: 640px;
  margin: 0 auto;
  box-sizing: border-box;
`;

const summaryContainerStyle = css`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const topBadgeRowStyle = css`
  padding: 0 var(--app-inline-padding, 16px);
  margin-top: 4px;
`;

const railWrapperStyle = css`
  padding: 0 var(--app-inline-padding, 16px) 16px;
`;

const needCheckSectionStyle = css`
  margin-bottom: 16px;
`;

const sectionStyle = css`
  margin-bottom: 8px;
`;

const contentsStyle = css`
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const ellipsisStyle = css`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const secondaryActionStyle = css`
  margin-top: 24px;
  padding-bottom: 32px;
`;

const sheetListStyle = css`
  padding-bottom: 16px;
`;

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
      <div css={tdsPageStyle}>
        <PageState
          status="empty"
          title="아직 확정된 일정이 없어요"
          description="팀원들과 후보 여행안을 검토하고 마음에 드는 계획을 확정해보세요."
          actionText="후보 여행안 보러가기"
          onAction={() => navigate(`/trips/${tripId}/plans`, { replace: true })}
        />
      </div>
    );
  }

  return (
    <div css={pageStyle}>
      {/* 1. 상단 확정 Summary */}
      <section css={summaryContainerStyle} aria-label="확정 일정 요약">
        <div css={topBadgeRowStyle}>
          <Badge size="small" variant="weak" color="green">
            최종 확정
          </Badge>
        </div>
        <Top
          title={<Top.TitleParagraph>{viewModel.confirmedPlanTitle}</Top.TitleParagraph>}
          subtitleBottom={
            <Top.SubtitleParagraph>
              {viewModel.destination} · {viewModel.periodText} · {viewModel.nights}박 {viewModel.days}일
            </Top.SubtitleParagraph>
          }
        />
      </section>

      {/* 경로 레일 (RouteRail) */}
      {viewModel.route.length > 0 && (
        <div css={railWrapperStyle}>
          <RouteRail route={viewModel.route} differenceSummary={viewModel.differenceSummary} />
        </div>
      )}

      {/* 2. 확인 필요 예약 Summary Row (Need-Check) */}
      {viewModel.needCheckCount > 0 && (
        <section css={needCheckSectionStyle} aria-label="확인 필요 예약 요약">
          <List aria-label="확인 필요 예약">
            <ListRow
              border="indented"
              verticalPadding="medium"
              horizontalPadding="small"
              withTouchEffect
              arrowType="right"
              onClick={() => setIsNeedCheckSheetOpen(true)}
              aria-label={`확인이 필요한 예약 ${viewModel.needCheckCount}개`}
              left={
                <Badge
                  size="small"
                  variant="weak"
                  color={viewModel.hasNeedCheckDanger ? "red" : "yellow"}
                >
                  확인 필요
                </Badge>
              }
              contents={
                <div css={contentsStyle}>
                  <Text typography="t6" fontWeight="bold" color="var(--adaptiveGrey900, #191f28)">
                    확인이 필요한 예약 {viewModel.needCheckCount}개
                  </Text>
                  <Text typography="t7" color="var(--adaptiveGrey600, #6b7684)">
                    예약 상태를 확인하고 일정을 점검해주세요.
                  </Text>
                </div>
              }
              right={
                <Badge
                  size="small"
                  variant="weak"
                  color={viewModel.hasNeedCheckDanger ? "red" : "yellow"}
                >
                  {viewModel.needCheckCount}건
                </Badge>
              }
            />
          </List>
        </section>
      )}

      {/* 3. 날짜별 일정 목록 (Date-based Sections) */}
      <section aria-label="날짜별 상세 일정">
        {viewModel.sections.length === 0 ? (
          <List aria-label="날짜별 상세 일정">
            <ListRow
              border="none"
              verticalPadding="medium"
              horizontalPadding="small"
              contents={
                <Text typography="t6" color="var(--adaptiveGrey600, #6b7684)">
                  등록된 숙소·교통 일정이 없어요.
                </Text>
              }
            />
          </List>
        ) : (
          viewModel.sections.map((section) => (
            <div key={section.id} id={section.id} css={sectionStyle}>
              <ListHeader
                size="small"
                title={<ListHeader.TitleParagraph>{section.dateHeader}</ListHeader.TitleParagraph>}
              />
              <List aria-label={section.dateHeader}>
                {section.items.map((item) => (
                  <ListRow
                    key={item.id}
                    border="indented"
                    verticalPadding="medium"
                    horizontalPadding="small"
                    withTouchEffect
                    arrowType="right"
                    onClick={() => setSelectedItem(item)}
                    aria-label={`${item.type === "STAY" ? item.hotelName : item.routeTitle}, ${item.subText}`}
                    left={
                      <Badge
                        size="small"
                        variant="weak"
                        color={item.type === "STAY" ? "blue" : "elephant"}
                      >
                        {item.type === "STAY" ? "숙소" : "이동"}
                      </Badge>
                    }
                    contents={
                      <div css={contentsStyle}>
                        <Text
                          typography="t6"
                          fontWeight="bold"
                          color="var(--adaptiveGrey900, #191f28)"
                          css={ellipsisStyle}
                        >
                          {item.type === "STAY" ? item.hotelName : item.routeTitle}
                        </Text>
                        <Text
                          typography="t7"
                          color="var(--adaptiveGrey600, #6b7684)"
                          css={ellipsisStyle}
                        >
                          {item.subText}
                        </Text>
                      </div>
                    }
                    right={
                      <Badge size="small" variant="weak" color={item.statusColor}>
                        {item.statusLabel}
                      </Badge>
                    }
                  />
                ))}
              </List>
            </div>
          ))
        )}
      </section>

      {/* 4. 하단 보조 작업: 후보 여행안 목록 보기 */}
      <div css={secondaryActionStyle}>
        <List aria-label="여행안 목록으로 이동">
          <ListRow
            border="none"
            verticalPadding="medium"
            horizontalPadding="small"
            withTouchEffect
            arrowType="right"
            onClick={() => navigate(`/trips/${tripId}/plans`)}
            contents={
              <div css={contentsStyle}>
                <Text typography="t6" color="var(--adaptiveGrey800, #333d4b)">
                  검토했던 여행안 기록 보기
                </Text>
                <Text typography="t7" color="var(--adaptiveGrey600, #6b7684)">
                  후보 여행안 목록과 참여자 의견을 확인해요.
                </Text>
              </div>
            }
          />
        </List>
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
        <List aria-label="확인 필요 예약 목록" css={sheetListStyle}>
          {viewModel.needCheckItems.map((item) => (
            <ListRow
              key={item.id}
              border="indented"
              verticalPadding="medium"
              horizontalPadding="small"
              left={
                <Badge size="small" variant="weak" color={item.statusColor}>
                  {item.statusLabel}
                </Badge>
              }
              contents={
                <div css={contentsStyle}>
                  <Text typography="t6" fontWeight="bold" color="var(--adaptiveGrey900, #191f28)">
                    {item.message}
                  </Text>
                  <Text typography="t7" color="var(--adaptiveGrey500, #8b95a1)">
                    {item.snapshotInfo}
                  </Text>
                </div>
              }
            />
          ))}
        </List>
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
          <List aria-label="일정 상세 정보" css={sheetListStyle}>
            <ListRow
              border="indented"
              verticalPadding="medium"
              horizontalPadding="small"
              contents={<Text typography="t6">구분</Text>}
              right={
                <Badge
                  size="small"
                  variant="weak"
                  color={selectedItem.type === "STAY" ? "blue" : "elephant"}
                >
                  {selectedItem.type === "STAY" ? "숙소" : "교통편"}
                </Badge>
              }
            />
            <ListRow
              border="indented"
              verticalPadding="medium"
              horizontalPadding="small"
              contents={<Text typography="t6">예약 상태</Text>}
              right={
                <Badge size="small" variant="weak" color={selectedItem.statusColor}>
                  {selectedItem.statusLabel}
                </Badge>
              }
            />
            <ListRow
              border="indented"
              verticalPadding="medium"
              horizontalPadding="small"
              contents={<Text typography="t6">예상 경비</Text>}
              right={<Text typography="t6" fontWeight="bold">{selectedItem.priceText}</Text>}
            />
            <ListRow
              border="indented"
              verticalPadding="medium"
              horizontalPadding="small"
              contents={<Text typography="t6">확인 정보</Text>}
              right={
                <Text typography="t7" color="var(--adaptiveGrey600, #6b7684)">
                  {selectedItem.confirmedInfo}
                </Text>
              }
            />
            {selectedItem.bookingUrl && (
              <ListRow
                border="none"
                verticalPadding="medium"
                horizontalPadding="small"
                withTouchEffect
                arrowType="right"
                onClick={() => {
                  if (selectedItem.bookingUrl) {
                    window.open(selectedItem.bookingUrl, "_blank", "noopener,noreferrer");
                  }
                }}
                contents={
                  <Text typography="t6" color="var(--adaptiveBlue500, #3182f6)" fontWeight="bold">
                    {selectedItem.type === "STAY" ? "숙소 예약 링크 열기" : "교통 예매 링크 열기"}
                  </Text>
                }
              />
            )}
          </List>
        )}
      </BottomSheet>
    </div>
  );
}
