import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MapPinned, Plus, UsersRound } from "lucide-react";

import { MobileList, MobileListItem } from "@/components/galanda/mobile-list.tsx";
import { PageBody } from "@/components/galanda/page-body.tsx";
import { PageState } from "@/components/galanda/page-state.tsx";
import { PageTitle } from "@/components/galanda/page-title.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { ItemDescription, ItemTitle } from "@/components/ui/item.tsx";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import { isPastTravelDate, toLocalTravelDate } from "@/core/domain/room.ts";
import { cn } from "@/lib/utils.ts";
import { toUserMessage } from "../common/error-message.ts";
import type { TripRoomViewModel } from "../plan-home/plan-home-view-model.ts";
import { useTripRoomsQuery } from "../plan-home/queries.ts";
import { useSessionQuery } from "../../hooks/useSession.ts";

type TripListTab = "ONGOING" | "PAST";

const DAY_MS = 86_400_000;
const PAST_PREVIEW_LIMIT = 2;

const getTripEntryPath = (room: TripRoomViewModel): string =>
  `/trips/${encodeURIComponent(room.id)}`;

const getTripPeriodText = (room: TripRoomViewModel): string => {
  if (!room.displayStartDate || !room.displayEndDate) return "일정 미정";

  const formatDate = (date: string): string => {
    const match = /^(?:\d{4})-(\d{2})-(\d{2})$/.exec(date);
    return match ? `${Number(match[1])}.${Number(match[2])}` : date;
  };

  return `${formatDate(room.displayStartDate)} ~ ${formatDate(room.displayEndDate)}`;
};

const parseTravelDate = (value: string | undefined): Date | undefined => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const getTripDayLabel = (
  room: TripRoomViewModel,
  today: string,
): string | undefined => {
  const start = parseTravelDate(room.displayStartDate);
  const end = parseTravelDate(room.displayEndDate);
  const current = parseTravelDate(today);
  if (!start || !current) return undefined;

  const daysUntilStart = Math.round((start.getTime() - current.getTime()) / DAY_MS);
  if (daysUntilStart > 0) return `D-${daysUntilStart}`;
  if (daysUntilStart === 0) return "D-Day";
  if (end && current.getTime() <= end.getTime()) return "여행 중";
  return undefined;
};

const getMemberNames = (room: TripRoomViewModel): ReadonlyArray<string> =>
  room.memberNames.map((name) => name.trim()).filter(Boolean);

const getInitial = (name: string): string =>
  Array.from(name.trim())[0]?.toUpperCase() ?? "?";

const sortPastRoomsByMostRecent = (
  rooms: ReadonlyArray<TripRoomViewModel>,
): ReadonlyArray<TripRoomViewModel> =>
  [...rooms].sort((left, right) =>
    (right.displayEndDate ?? "").localeCompare(left.displayEndDate ?? ""),
  );

function TripParticipantStack({ room }: { readonly room: TripRoomViewModel }) {
  const memberNames = getMemberNames(room);
  const shownMembers = memberNames.slice(0, 4);
  const remainingMembers = Math.max(0, room.memberCount - shownMembers.length);

  if (shownMembers.length === 0) {
    return (
      <span className="flex items-center gap-1.5 text-sm text-foreground-muted">
        <UsersRound className="size-4" aria-hidden="true" />
        {room.memberCount}명
      </span>
    );
  }

  return (
    <ul
      className="flex min-w-0 items-center"
      aria-label={`여행 참여자 ${room.memberCount}명`}
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
  room,
  today,
}: {
  readonly room: TripRoomViewModel;
  readonly today: string;
}) {
  const dayLabel = getTripDayLabel(room, today);
  const hasNoCandidate = room.candidateCount === 0;
  const isParticipationUnknown =
    !hasNoCandidate && room.hasUnattributedOpinions;
  const participationPercent =
    hasNoCandidate || isParticipationUnknown
      ? undefined
      : room.memberCount > 0
        ? Math.min(
            100,
            Math.round((room.participatedMemberCount / room.memberCount) * 100),
          )
        : 0;
  const participationStatus = hasNoCandidate
    ? "여행안 없음"
    : isParticipationUnknown
      ? "집계 전"
      : `${participationPercent}%`;

  return (
    <Link
      to={getTripEntryPath(room)}
      aria-label={`${room.title} 여행 열기`}
      className="group grid min-w-0 grid-cols-[5.5rem_minmax(0,1fr)] gap-3 rounded-2xl border border-border bg-card p-3 text-foreground! no-underline! shadow-sm transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-primary-border hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <div className="flex min-h-32 min-w-0 flex-col items-center justify-center rounded-xl bg-primary-muted px-2 text-center text-primary">
        <MapPinned className="size-7" aria-hidden="true" />
        <span className="mt-2 line-clamp-2 text-xs font-semibold [overflow-wrap:anywhere]">
          {room.destination || "여행"}
        </span>
      </div>

      <div className="flex min-w-0 flex-col">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <h2 className="min-w-0 text-base leading-snug font-bold [overflow-wrap:anywhere]">
            {room.title}
          </h2>
          <Badge
            variant={dayLabel === "여행 중" ? "success" : dayLabel ? "info" : "neutral"}
            className="h-6 px-2.5 text-xs"
          >
            {dayLabel ?? "일정 미정"}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-foreground-muted [overflow-wrap:anywhere]">
          {getTripPeriodText(room)}
        </p>

        <div className="mt-3 min-w-0">
          <div className="mb-1.5 flex min-w-0 items-center justify-between gap-2 text-xs font-medium">
            <span className="min-w-0 text-foreground-muted [overflow-wrap:anywhere]">
              여행안 의견 참여율
            </span>
            <span className="shrink-0 text-foreground">
              {participationStatus}
            </span>
          </div>
          {participationPercent === undefined ? (
            <div
              className="h-1.5 rounded-full bg-muted"
              aria-label={
                hasNoCandidate ? "등록된 여행안 없음" : "의견 참여 인원 집계 전"
              }
            />
          ) : (
            <div
              role="progressbar"
              aria-label={`${room.title} 여행안 의견 참여율`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={participationPercent}
              className="h-1.5 overflow-hidden rounded-full bg-muted"
            >
              <div
                className="h-full rounded-full bg-primary transition-[width]"
                style={{ width: `${participationPercent}%` }}
              />
            </div>
          )}
        </div>

        <div className="mt-auto pt-3">
          <TripParticipantStack room={room} />
        </div>
      </div>
    </Link>
  );
}

function PastTripList({
  rooms,
  label,
}: {
  readonly rooms: ReadonlyArray<TripRoomViewModel>;
  readonly label: string;
}) {
  return (
    <MobileList
      aria-label={label}
      className="overflow-hidden rounded-2xl border border-border bg-card"
    >
      {rooms.map((room) => (
        <MobileListItem
          key={room.id}
          to={getTripEntryPath(room)}
          aria-label={`${room.title} 지난 여행 열기`}
          leading={
            <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-primary-muted text-primary">
              <MapPinned className="size-5" aria-hidden="true" />
            </span>
          }
          trailing={<Badge variant="neutral">완료</Badge>}
          className="px-3 py-3"
        >
          <ItemTitle className="text-base font-semibold [overflow-wrap:anywhere]">
            {room.title}
          </ItemTitle>
          <ItemDescription className="[overflow-wrap:anywhere]">
            {room.destination && `${room.destination} · `}
            {getTripPeriodText(room)} · {room.memberCount}명
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
    data: rooms,
    isLoading,
    isError,
    error,
    refetch: refetchRooms,
  } = useTripRoomsQuery();

  const today = toLocalTravelDate(new Date());
  const ongoingRooms =
    rooms?.filter((room) => !isPastTravelDate(room.displayEndDate, today)) ?? [];
  const pastRooms = sortPastRoomsByMostRecent(
    rooms?.filter((room) => isPastTravelDate(room.displayEndDate, today)) ?? [],
  );
  const pastPreviewRooms = pastRooms.slice(0, PAST_PREVIEW_LIMIT);

  const ongoingContent = (
    <div className="flex flex-col gap-8">
      <section
        aria-labelledby="ongoing-trips-heading"
        className="px-(--app-inline-padding)"
      >
        <h2 id="ongoing-trips-heading" className="sr-only">
          진행 중인 여행
        </h2>
        {ongoingRooms.length === 0 ? (
          <PageState
            status="empty"
            title="진행 중인 여행이 없어요"
            description="새 여행을 시작하려면 아래 버튼을 이용해주세요."
          />
        ) : (
          <div className="flex flex-col gap-3">
            {ongoingRooms.map((room) => (
              <OngoingTripCard key={room.id} room={room} today={today} />
            ))}
          </div>
        )}
      </section>

      {pastRooms.length > 0 && (
        <section
          aria-labelledby="past-preview-heading"
          className="px-(--app-inline-padding)"
        >
          <h2
            id="past-preview-heading"
            className="mb-3 text-lg leading-snug font-bold text-foreground"
          >
            지난 여행 ({pastRooms.length})
          </h2>
          <PastTripList rooms={pastPreviewRooms} label="지난 여행 미리보기" />
        </section>
      )}
    </div>
  );

  const pastContent =
    pastRooms.length === 0 ? (
      <PageState
        status="empty"
        title="지난 여행이 없어요"
        description="지난 여행이 생기면 이곳에서 다시 확인할 수 있어요."
      />
    ) : (
      <section
        aria-labelledby="past-trips-heading"
        className="px-(--app-inline-padding)"
      >
        <h2
          id="past-trips-heading"
          className="mb-3 text-lg leading-snug font-bold text-foreground"
        >
          지난 여행 ({pastRooms.length})
        </h2>
        <PastTripList rooms={pastRooms} label="지난 여행 전체" />
      </section>
    );

  const content =
    isLoading && !rooms ? (
      <PageState status="loading" message="여행 목록을 불러오는 중이에요." />
    ) : isSessionError ? (
      <PageState
        status="error"
        title="로그인 정보를 확인할 수 없어요"
        description={toUserMessage(sessionError, "잠시 후 다시 시도해주세요.")}
        actionText="다시 시도"
        onAction={() => void refetchSession()}
      />
    ) : isError && !rooms ? (
      <PageState
        status="error"
        title="여행 목록을 불러오지 못했어요"
        description={toUserMessage(error, "잠시 후 다시 시도해주세요.")}
        actionText="다시 시도"
        onAction={() => void refetchRooms()}
      />
    ) : !rooms ? (
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

  // 헤더가 없는 최상위 route라 본문이 상단 safe-area를 직접 확보해요(safeTop).
  return (
    <PageBody safeTop withBottomAction data-slot="trip-list-page">
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
              진행 중 ({ongoingRooms.length})
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
        <div className="mx-auto flex w-full max-w-(--content-max-width) justify-end">
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
