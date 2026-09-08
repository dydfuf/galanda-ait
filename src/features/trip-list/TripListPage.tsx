import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CalendarDays, ChevronRight, MapPinned, Plus, UsersRound } from "lucide-react";

import { MobileList, MobileListItem } from "@/components/galanda/mobile-list.tsx";
import { PageBody } from "@/components/galanda/page-body.tsx";
import { PageState } from "@/components/galanda/page-state.tsx";
import { GalandaSpot } from "@/components/galanda/galanda-spot.tsx";
import { PageTitle } from "@/components/galanda/page-title.tsx";
import { BottomAction } from "@/components/galanda/bottom-action.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { ItemDescription, ItemTitle } from "@/components/ui/item.tsx";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import { toLocalTravelDate } from "@/core/domain/room.ts";
import { toUserMessage } from "../common/error-message.ts";
import type { TripOverviewDto } from "@/contracts/trip-overview.ts";
import {
  classifyTrip,
} from "@/core/calculations/featured-trip.ts";
import { useTripRoomsQuery } from "../plan-home/queries.ts";
import { useSessionQuery } from "../../hooks/useSession.ts";

type TripListTab = "ONGOING" | "PAST";

const DAY_MS = 86_400_000;

const getTripEntryPath = (trip: TripOverviewDto): string =>
  `/trips/${encodeURIComponent(trip.id)}`;

const formatDate = (date: string): string => {
  const match = /^(?:\d{4})-(\d{2})-(\d{2})$/.exec(date);
  return match ? `${Number(match[1])}.${Number(match[2])}` : date;
};

const getTripPeriodText = (trip: TripOverviewDto): string => {
  if (!trip.confirmedPeriod) return "일정 미정";
  return `${formatDate(trip.confirmedPeriod.startDate)} ~ ${formatDate(trip.confirmedPeriod.endDate)}`;
};

const parseTravelDate = (value: string | undefined): Date | undefined => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const getTripDayLabel = (
  trip: TripOverviewDto,
  today: string,
): { label: string; variant: "success" | "info" | "warning" | "neutral" } => {
  const lifecycle = classifyTrip(trip, today);

  if (lifecycle === "ONGOING_CONFIRMED") {
    const start = parseTravelDate(trip.confirmedPeriod?.startDate);
    const current = parseTravelDate(today);
    if (start && current && start.getTime() === current.getTime()) {
      return { label: "D-Day", variant: "success" };
    }
    return { label: "여행 중", variant: "success" };
  }

  if (lifecycle === "UPCOMING_CONFIRMED") {
    const start = parseTravelDate(trip.confirmedPeriod?.startDate);
    const current = parseTravelDate(today);
    if (start && current) {
      const daysUntilStart = Math.round((start.getTime() - current.getTime()) / DAY_MS);
      if (daysUntilStart === 0) return { label: "D-Day", variant: "info" };
      if (daysUntilStart > 0) return { label: `D-${daysUntilStart}`, variant: "info" };
    }
    return { label: "예정", variant: "info" };
  }

  if (lifecycle === "CONFIRMED_DATE_UNKNOWN") {
    return { label: "확정", variant: "warning" };
  }

  if (lifecycle === "PLANNING") {
    return { label: "계획 중", variant: "info" };
  }

  return { label: "날짜 미정", variant: "neutral" };
};

const sortPastTripsByMostRecent = (
  trips: ReadonlyArray<TripOverviewDto>,
): ReadonlyArray<TripOverviewDto> =>
  [...trips].sort((left, right) => {
    const rightDate = right.confirmedPeriod?.endDate ?? right.updatedAt;
    const leftDate = left.confirmedPeriod?.endDate ?? left.updatedAt;
    return rightDate.localeCompare(leftDate);
  });

function OngoingTripCard({
  trip,
  today,
}: {
  readonly trip: TripOverviewDto;
  readonly today: string;
}) {
  const { label: dayLabel, variant: badgeVariant } = getTripDayLabel(trip, today);
  const lifecycle = classifyTrip(trip, today);

  return (
    <Link
      to={getTripEntryPath(trip)}
      aria-label={`${trip.title} 여행 열기`}
      className="flex min-w-0 items-center gap-4 border-b border-border py-7 text-foreground! no-underline! focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Badge variant={badgeVariant}>{dayLabel}</Badge>
          {trip.activitySummary && trip.activitySummary.unreadCount > 0 && (
            <span className="text-xs font-medium text-primary">새 활동 {trip.activitySummary.unreadCount}개</span>
          )}
        </div>
        <h2 className="min-w-0 text-2xl leading-snug font-bold tracking-tight break-keep [overflow-wrap:anywhere]">
              {trip.title}
        </h2>
        <div className="flex min-w-0 flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
          <p className="flex items-center gap-2"><CalendarDays className="size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />{getTripPeriodText(trip)}</p>
          <p className="flex items-center gap-2"><UsersRound className="size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />참여 {trip.memberCount}명</p>
        </div>
        <div className="text-sm leading-relaxed text-muted-foreground">
          {lifecycle === "PLANNING" ? (
            <span>
              {trip.hasUnattributedOpinions
                ? "후보 여행안 " + trip.candidateCount + "개"
                : `의견 참여 ${trip.opinionParticipantCount}/${trip.memberCount}명 · 여행안 ${trip.candidateCount}개`}
            </span>
          ) : lifecycle === "DATE_TBD" ? (
            <span>여행안 0개 · 첫 여행안을 작성해주세요</span>
          ) : (
            <span className="flex items-center gap-1 font-medium text-foreground">
              <CalendarDays className="size-3.5 text-primary" aria-hidden="true" />
              확정된 여행 일정
            </span>
          )}
        </div>

      </div>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground" strokeWidth={1.8} aria-hidden="true" />
    </Link>
  );
}

function PastTripList({
  trips,
  label,
}: {
  readonly trips: ReadonlyArray<TripOverviewDto>;
  readonly label: string;
}) {
  return (
    <MobileList
      aria-label={label}
      className="overflow-hidden"
    >
      {trips.map((trip) => (
        <MobileListItem
          key={trip.id}
          to={getTripEntryPath(trip)}
          aria-label={`${trip.title} 지난 여행 열기`}
          leading={
            <span className="grid size-10 shrink-0 place-items-center text-muted-foreground">
              <MapPinned className="size-5" strokeWidth={1.8} aria-hidden="true" />
            </span>
          }
          trailing={<Badge variant="neutral">완료</Badge>}
          className="px-0 py-5"
        >
          <div className="flex min-w-0 items-center gap-1.5">
            <ItemTitle className="text-base font-semibold [overflow-wrap:anywhere]">
              {trip.title}
            </ItemTitle>
            {trip.activitySummary && trip.activitySummary.unreadCount > 0 && (
              <Badge
                variant="default"
                className="h-5 shrink-0 px-1.5 text-[10px] font-bold"
                aria-label={`새 활동 ${trip.activitySummary.unreadCount}개`}
              >
                +{trip.activitySummary.unreadCount}
              </Badge>
            )}
          </div>
          <ItemDescription className="[overflow-wrap:anywhere]">
            {trip.destination && `${trip.destination} · `}
            {getTripPeriodText(trip)} · {trip.memberCount}명
          </ItemDescription>
        </MobileListItem>
      ))}
    </MobileList>
  );
}

export function TripListPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TripListTab>("ONGOING");
  const {
    isError: isSessionError,
    error: sessionError,
    refetch: refetchSession,
  } = useSessionQuery();
  const {
    data: trips,
    isLoading,
    isError,
    error,
    refetch: refetchRooms,
  } = useTripRoomsQuery();

  const today = toLocalTravelDate(new Date());
  const ongoingTrips =
    trips?.filter((t) => classifyTrip(t, today) !== "PAST") ?? [];
  const pastTrips = sortPastTripsByMostRecent(
    trips?.filter((t) => classifyTrip(t, today) === "PAST") ?? []
  );

  const ongoingContent = (
    <div className="flex flex-col gap-8 pb-12">
      <section
        aria-labelledby="ongoing-trips-heading"
        className="px-(--app-inline-padding)"
      >
        <h2 id="ongoing-trips-heading" className="sr-only">
          진행 중인 여행
        </h2>
        {ongoingTrips.length === 0 ? (
          <PageState
            status="empty"
            title="진행 중인 여행이 없어요"
            illustration={!isError && trips?.length === 0 ? <GalandaSpot name="empty-trips" /> : undefined}
            description="새 여행을 시작하려면 아래 버튼을 이용해주세요."
          />
        ) : (
          <div className="flex flex-col">
            {ongoingTrips.map((trip) => (
              <OngoingTripCard key={trip.id} trip={trip} today={today} />
            ))}
          </div>
        )}
      </section>

    </div>
  );

  const pastContent =
    pastTrips.length === 0 ? (
      <PageState
        status="empty"
        title="지난 여행이 없어요"
        description="지난 여행이 생기면 이곳에서 다시 확인할 수 있어요."
      />
    ) : (
      <section
        aria-labelledby="past-trips-heading"
        className="px-(--app-inline-padding) pb-12"
      >
        <h2
          id="past-trips-heading"
          className="mb-3 text-lg leading-snug font-bold text-foreground"
        >
          지난 여행 ({pastTrips.length})
        </h2>
        <PastTripList trips={pastTrips} label="지난 여행 전체" />
      </section>
    );

  const content =
    isLoading && !trips ? (
      <PageState status="loading" message="여행 목록을 불러오는 중이에요." />
    ) : isSessionError ? (
      <PageState
        status="error"
        title="로그인 정보를 확인할 수 없어요"
        description={toUserMessage(sessionError, "잠시 후 다시 시도해주세요.")}
        actionText="다시 시도"
        onAction={() => void refetchSession()}
      />
    ) : isError && !trips ? (
      <PageState
        status="error"
        title="여행 목록을 불러오지 못했어요"
        description={toUserMessage(error, "잠시 후 다시 시도해주세요.")}
        actionText="다시 시도"
        onAction={() => void refetchRooms()}
      />
    ) : !trips ? (
      <PageState status="loading" message="여행 목록을 불러오는 중이에요." />
    ) : (
      <>
        {isError && (
          <div
            role="alert"
            className="mx-(--app-inline-padding) mb-4 flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl border border-warning-border bg-warning-muted p-3 text-sm text-foreground"
          >
            <p className="min-w-0 flex-1 [overflow-wrap:anywhere]">
              표시된 내용은 이전에 불러온 정보예요.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void refetchRooms()}
            >
              여행 정보 다시 확인
            </Button>
          </div>
        )}
        {activeTab === "ONGOING" ? ongoingContent : pastContent}
      </>
    );

  return (
    <PageBody safeTop withBottomAction data-slot="trip-list-page" className="[--app-inline-padding:24px]">
      <PageTitle title="내 여행" />

      <div className="mt-4 mb-4 px-(--app-inline-padding)">
        <Tabs
          value={activeTab}
          onValueChange={(value) =>
            setActiveTab(value === "PAST" ? "PAST" : "ONGOING")
          }
        >
          <TabsList
            variant="line"
            aria-label="여행 목록 필터"
            className="w-full"
          >
            <TabsTrigger value="ONGOING">
              진행 중 ({ongoingTrips.length})
            </TabsTrigger>
            <TabsTrigger value="PAST">지난 여행</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {content}

      <BottomAction>
          <Button
            type="button"
            size="xl"
            aria-label="새 여행 만들기"
            onClick={() => navigate("/trips/new")}
          >
            <Plus className="size-5" strokeWidth={1.8} aria-hidden="true" />
            새 여행 만들기
          </Button>
      </BottomAction>
    </PageBody>
  );
}
