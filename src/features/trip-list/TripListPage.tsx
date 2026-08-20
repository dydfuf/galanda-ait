import { useState } from "react";
import { css } from "@emotion/react";
import { FixedBottomCTA, List, ListRow, SegmentedControl, Top } from "@toss/tds-mobile";
import { useNavigate } from "react-router-dom";
import { useTripRoomsQuery } from "../plan-home/queries.ts";
import { toUserMessage } from "../common/error-message.ts";
import { useSessionQuery } from "../../hooks/useSession.ts";
import { PageState } from "../common/PageState.tsx";
import { fixedCtaContainerStyle, tdsPageWithBottomCtaStyle } from "../common/tds-layout.ts";
import {
  getTripListStatusText,
  type TripRoomViewModel,
} from "../plan-home/plan-home-view-model.ts";

const pageStyle = css`
  ${tdsPageWithBottomCtaStyle};
  max-width: 600px;
  margin: 0 auto;
`;

const filterContainerStyle = css`
  margin: 20px 24px 12px;
`;

type TripListTab = "ONGOING" | "PAST";

const getTripEntryPath = (room: TripRoomViewModel): string => {
  if (room.confirmedPlanId) return `/trips/${room.id}/itinerary`;
  if (room.plans.length >= 2) {
    return `/trips/${room.id}/plans/compare?left=${room.plans[0].id}&right=${room.plans[1].id}`;
  }
  if (room.plans.length === 1) return `/trips/${room.id}/plans/${room.plans[0].id}`;
  return `/trips/${room.id}/plans/new`;
};

const getTripPeriodText = (room: TripRoomViewModel): string => {
  if (!room.startDate || !room.endDate) return "일정 미정";

  const formatDate = (date: string): string => {
    const match = /^(?:\d{4})-(\d{2})-(\d{2})$/.exec(date);
    return match ? `${Number(match[1])}.${Number(match[2])}` : date;
  };

  return `${formatDate(room.startDate)} ~ ${formatDate(room.endDate)}`;
};

export function TripListPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TripListTab>("ONGOING");
  const {
    isError: isSessionError,
    error: sessionError,
    refetch: refetchSession,
  } = useSessionQuery();
  const {
    data: rooms,
    isLoading,
    isError,
    error,
    refetch: refetchRooms,
  } = useTripRoomsQuery();

  const now = new Date();
  const ongoingRooms =
    rooms?.filter((room) => {
      if (!room.endDate) return true;
      const end = new Date(room.endDate);
      return end >= now || Number.isNaN(end.getTime());
    }) ?? [];
  const pastRooms =
    rooms?.filter((room) => {
      if (!room.endDate) return false;
      const end = new Date(room.endDate);
      return end < now && !Number.isNaN(end.getTime());
    }) ?? [];
  const displayRooms = activeTab === "ONGOING" ? ongoingRooms : pastRooms;

  const content = isLoading ? (
    <PageState status="loading" message="여행 목록을 불러오는 중이에요." />
  ) : isSessionError ? (
    <PageState
      status="error"
      title="로그인 정보를 확인할 수 없어요"
      description={toUserMessage(sessionError, "잠시 후 다시 시도해주세요.")}
      actionText="다시 시도"
      onAction={() => void refetchSession()}
    />
  ) : isError ? (
    <PageState
      status="error"
      title="여행 목록을 불러오지 못했어요"
      description={toUserMessage(error, "잠시 후 다시 시도해주세요.")}
      actionText="다시 시도"
      onAction={() => void refetchRooms()}
    />
  ) : !rooms ? (
    <PageState status="loading" message="여행 목록을 불러오는 중이에요." />
  ) : displayRooms.length === 0 ? (
    <PageState
      status="empty"
      title={activeTab === "ONGOING" ? "진행 중인 여행이 없어요" : "지난 여행이 없어요"}
      description={
        activeTab === "ONGOING"
          ? "새 여행을 시작하려면 아래 버튼을 이용해주세요."
          : "지난 여행이 생기면 이곳에서 다시 확인할 수 있어요."
      }
    />
  ) : (
    <List aria-label={activeTab === "ONGOING" ? "진행 중인 여행" : "지난 여행"}>
      {displayRooms.map((room) => {
        const statusText = getTripListStatusText(room);
        const periodText = getTripPeriodText(room);

        return (
          <ListRow
            key={room.id}
            border="indented"
            verticalPadding="large"
            withTouchEffect
            aria-label={`${room.title}, ${periodText}, ${statusText}`}
            onClick={() => navigate(getTripEntryPath(room))}
            arrowType="right"
            contents={
              <ListRow.Texts
                type="3RowTypeA"
                top={room.title}
                middle={`${periodText} · ${room.memberCount}명`}
                bottom={statusText}
                topProps={{
                  typography: "t5",
                  color: "var(--adaptiveGrey900, #191f28)",
                  fontWeight: "bold",
                }}
                middleProps={{
                  typography: "t7",
                  color: "var(--adaptiveGrey600, #6b7684)",
                }}
                bottomProps={{
                  typography: "t7",
                  color: room.confirmedPlanId
                    ? "var(--adaptiveGreen600, #15803d)"
                    : "var(--adaptiveBlue600, #1b64da)",
                  fontWeight: "medium",
                }}
              />
            }
          />
        );
      })}
    </List>
  );

  return (
    <div css={pageStyle}>
      <Top
        title={<Top.TitleParagraph>내 여행</Top.TitleParagraph>}
        subtitleBottom={<Top.SubtitleParagraph>참여 중인 여행을 한눈에 확인해요.</Top.SubtitleParagraph>}
      />

      <div css={filterContainerStyle}>
        <SegmentedControl
          aria-label="여행 목록 필터"
          value={activeTab}
          onChange={(value) => setActiveTab(value as TripListTab)}
        >
          <SegmentedControl.Item value="ONGOING">
            진행 중인 여행 ({ongoingRooms.length})
          </SegmentedControl.Item>
          <SegmentedControl.Item value="PAST">
            지난 여행 ({pastRooms.length})
          </SegmentedControl.Item>
        </SegmentedControl>
      </div>

      {content}

      <FixedBottomCTA containerStyle={fixedCtaContainerStyle} onClick={() => navigate("/trips/new")}>
        새 여행 만들기
      </FixedBottomCTA>
    </div>
  );
}
