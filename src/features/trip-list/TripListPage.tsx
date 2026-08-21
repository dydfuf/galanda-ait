import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTripRoomsQuery } from "../plan-home/queries.ts";
import { toUserMessage } from "../common/error-message.ts";
import { useSessionQuery } from "../../hooks/useSession.ts";
import { PageState } from "@/components/galanda/page-state.tsx";
import { PageBody } from "@/components/galanda/page-body.tsx";
import { PageTitle } from "@/components/galanda/page-title.tsx";
import { BottomAction } from "@/components/galanda/bottom-action.tsx";
import { MobileList, MobileListItem } from "@/components/galanda/mobile-list.tsx";
import { Button } from "@/components/ui/button.tsx";
import { ItemDescription, ItemTitle } from "@/components/ui/item.tsx";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import { cn } from "@/lib/utils.ts";
import {
  getTripListStatusText,
  type TripRoomViewModel,
} from "../plan-home/plan-home-view-model.ts";

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
  if (!room.displayStartDate || !room.displayEndDate) return "일정 미정";

  const formatDate = (date: string): string => {
    const match = /^(?:\d{4})-(\d{2})-(\d{2})$/.exec(date);
    return match ? `${Number(match[1])}.${Number(match[2])}` : date;
  };

  return `${formatDate(room.displayStartDate)} ~ ${formatDate(room.displayEndDate)}`;
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
      if (!room.displayEndDate) return true;
      const end = new Date(room.displayEndDate);
      return end >= now || Number.isNaN(end.getTime());
    }) ?? [];
  const pastRooms =
    rooms?.filter((room) => {
      if (!room.displayEndDate) return false;
      const end = new Date(room.displayEndDate);
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
    <MobileList aria-label={activeTab === "ONGOING" ? "진행 중인 여행" : "지난 여행"}>
      {displayRooms.map((room) => {
        const statusText = getTripListStatusText(room);
        const periodText = getTripPeriodText(room);

        return (
          <MobileListItem
            key={room.id}
            chevron
            aria-label={`${room.title}, ${periodText}, ${statusText}`}
            onClick={() => void navigate(getTripEntryPath(room))}
            className="py-4"
          >
            <ItemTitle className="text-[17px]">{room.title}</ItemTitle>
            <ItemDescription>
              {periodText} · {room.memberCount}명
            </ItemDescription>
            <ItemDescription
              className={cn("font-medium", room.confirmedPlanId ? "text-success" : "text-info")}
            >
              {statusText}
            </ItemDescription>
          </MobileListItem>
        );
      })}
    </MobileList>
  );

  // 헤더가 없는 최상위 route라 본문이 상단 safe-area를 직접 확보해요(safeTop).
  return (
    <PageBody safeTop withBottomAction className="mx-auto max-w-[600px]">
      <PageTitle title="내 여행" description="참여 중인 여행을 한눈에 확인해요." />

      <div className="mx-6 mt-4 mb-3">
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value === "PAST" ? "PAST" : "ONGOING")}
        >
          <TabsList aria-label="여행 목록 필터" className="h-10 w-full">
            <TabsTrigger value="ONGOING">진행 중인 여행 ({ongoingRooms.length})</TabsTrigger>
            <TabsTrigger value="PAST">지난 여행 ({pastRooms.length})</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {content}

      <BottomAction>
        <Button type="button" size="xl" onClick={() => void navigate("/trips/new")}>
          새 여행 만들기
        </Button>
      </BottomAction>
    </PageBody>
  );
}
