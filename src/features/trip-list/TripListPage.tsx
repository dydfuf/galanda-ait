import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CalendarDays, MapPinned, Plus, UsersRound } from "lucide-react";

import { MobileList, MobileListItem } from "@/components/galanda/mobile-list.tsx";
import { PageBody } from "@/components/galanda/page-body.tsx";
import { PageState } from "@/components/galanda/page-state.tsx";
import { PageTitle } from "@/components/galanda/page-title.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { ItemDescription, ItemTitle } from "@/components/ui/item.tsx";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import { toLocalTravelDate } from "@/core/domain/room.ts";
import { cn } from "@/lib/utils.ts";
import { toUserMessage } from "../common/error-message.ts";
import type { TripOverviewDto } from "@/contracts/trip-overview.ts";
import {
  classifyTrip,
} from "@/core/calculations/featured-trip.ts";
import { useTripRoomsQuery } from "../plan-home/queries.ts";
import { useSessionQuery } from "../../hooks/useSession.ts";

type TripListTab = "ONGOING" | "PAST";

const DAY_MS = 86_400_000;
const PAST_PREVIEW_LIMIT = 2;

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

const getMemberNames = (trip: TripOverviewDto): ReadonlyArray<string> =>
  trip.memberNames.map((name) => name.trim()).filter(Boolean);

const getInitial = (name: string): string =>
  Array.from(name.trim())[0]?.toUpperCase() ?? "?";

const sortPastTripsByMostRecent = (
  trips: ReadonlyArray<TripOverviewDto>,
): ReadonlyArray<TripOverviewDto> =>
  [...trips].sort((left, right) => {
    const rightDate = right.confirmedPeriod?.endDate ?? right.updatedAt;
    const leftDate = left.confirmedPeriod?.endDate ?? left.updatedAt;
    return rightDate.localeCompare(leftDate);
  });

function TripParticipantStack({ trip }: { readonly trip: TripOverviewDto }) {
  const memberNames = getMemberNames(trip);
  const shownMembers = memberNames.slice(0, 4);
  const remainingMembers = Math.max(0, trip.memberCount - shownMembers.length);

  if (shownMembers.length === 0) {
    return (
      <span className="flex items-center gap-1.5 text-sm text-foreground-muted">
        <UsersRound className="size-4" aria-hidden="true" />
        {trip.memberCount}명
      </span>
    );
  }

  return (
    <ul
      className="flex min-w-0 items-center"
      aria-label={`여행 참여자 ${trip.memberCount}명`}
    >
      {shownMembers.map((name, index) => (
        <li
          key={`${name}-${index}`}
          title={name}
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-full border-2 border-card bg-primary-muted text-xs font-bold text-primary",
            index > 0 && "-ml-2",
          )}
        >
          <span aria-hidden="true">{getInitial(name)}</span>
          <span className="sr-only">{name}</span>
        </li>
      ))}
      {remainingMembers > 0 && (
        <li className="-ml-2 grid size-8 shrink-0 place-items-center rounded-full border-2 border-card bg-muted text-xs font-bold text-foreground-muted">
          <span aria-hidden="true">+{remainingMembers}</span>
          <span className="sr-only">추가 참여자 {remainingMembers}명</span>
        </li>
      )}
    </ul>
  );
}

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
      className="group grid min-w-0 grid-cols-[5.5rem_minmax(0,1fr)] gap-3 rounded-2xl border border-border bg-card p-3 text-foreground! no-underline! shadow-sm transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-primary-border hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <div className="flex min-h-32 min-w-0 flex-col items-center justify-center rounded-xl bg-primary-muted px-2 text-center text-primary">
        <MapPinned className="size-7" aria-hidden="true" />
        <span className="mt-2 line-clamp-2 text-xs font-semibold [overflow-wrap:anywhere]">
          {trip.destination || "여행"}
        </span>
      </div>

      <div className="flex min-w-0 flex-col">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <h2 className="min-w-0 text-base leading-snug font-bold [overflow-wrap:anywhere]">
              {trip.title}
            </h2>
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
          <Badge
            variant={badgeVariant}
            className="h-6 shrink-0 px-2.5 text-xs"
          >
            {dayLabel}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-foreground-muted [overflow-wrap:anywhere]">
          {getTripPeriodText(trip)}
        </p>

        <div className="mt-2 flex flex-col gap-1 text-xs text-foreground-muted">
          {lifecycle === "PLANNING" ? (
            <span>
              {trip.hasUnattributedOpinions
                ? "후보 여행안 " + trip.candidateCount + "개"
                : `의견 참여 ${trip.opinionParticipantCount}/${trip.memberCount}명 · 여행안 ${trip.candidateCount}개`}
            </span>
          ) : lifecycle === "DATE_TBD" ? (
            <span>여행안 0개</span>
          ) : (
            <span className="flex items-center gap-1 font-medium text-foreground">
              <CalendarDays className="size-3.5 text-primary" aria-hidden="true" />
              확정된 여행 일정
            </span>
          )}
        </div>

        <div className="mt-auto pt-3">
          <TripParticipantStack trip={trip} />
        </div>
      </div>
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
      className="overflow-hidden rounded-2xl border border-border bg-card"
    >
      {trips.map((trip) => (
        <MobileListItem
          key={trip.id}
          to={getTripEntryPath(trip)}
          aria-label={`${trip.title} 지난 여행 열기`}
          leading={
            <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-primary-muted text-primary">
              <MapPinned className="size-5" aria-hidden="true" />
            </span>
          }
          trailing={<Badge variant="neutral">완료</Badge>}
          className="px-3 py-3"
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
  const pastPreviewTrips = pastTrips.slice(0, PAST_PREVIEW_LIMIT);

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
            description="새 여행을 시작하려면 아래 버튼을 이용해주세요."
          />
        ) : (
          <div className="flex flex-col gap-3">
            {ongoingTrips.map((trip) => (
              <OngoingTripCard key={trip.id} trip={trip} today={today} />
            ))}
          </div>
        )}
      </section>

      {pastTrips.length > 0 && (
        <section
          aria-labelledby="past-preview-heading"
          className="px-(--app-inline-padding)"
        >
          <h2
            id="past-preview-heading"
            className="mb-3 text-lg leading-snug font-bold text-foreground"
          >
            지난 여행 ({pastTrips.length})
          </h2>
          <PastTripList trips={pastPreviewTrips} label="지난 여행 미리보기" />
        </section>
      )}
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
    <PageBody
      safeTop
      withBottomAction
      className="scroll-pb-[calc(var(--global-nav-height,64px)+5.5rem)]"
      data-slot="trip-list-page"
    >
      <PageTitle title="내 여행" />

      <div className="mt-4 mb-4 px-(--app-inline-padding)">
        <Tabs
          value={activeTab}
          onValueChange={(value) =>
            setActiveTab(value === "PAST" ? "PAST" : "ONGOING")
          }
        >
          <TabsList
            variant="default"
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

      <div
        className="pointer-events-none fixed inset-x-0 z-30 px-(--app-inline-padding)"
        style={{ bottom: "calc(var(--global-nav-height, 0px) + 1rem)" }}
      >
        <div className="mx-auto flex w-full max-w-(--content-max-width) justify-end min-[960px]:max-w-[calc(var(--content-max-width)+20rem)]">
          <Button
            type="button"
            size="lg"
            aria-label="새 여행 만들기"
            onClick={() => navigate("/trips/new")}
            className="pointer-events-auto rounded-full px-5 shadow-lg"
          >
            <Plus className="size-5" aria-hidden="true" />
            새 여행
          </Button>
        </div>
      </div>
    </PageBody>
  );
}
