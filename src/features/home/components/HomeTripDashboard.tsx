import { Link } from "react-router-dom";
import {
  BedDouble,
  CalendarDays,
  CarFront,
  MapPinned,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge.tsx";
import { isPastTravelDate } from "@/core/domain/room.ts";
import type { TripRoomViewModel } from "@/features/plan-home/plan-home-view-model.ts";
import { cn } from "@/lib/utils.ts";

const DAY_MS = 86_400_000;
const KOREAN_WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

const parseTravelDate = (value: string | undefined): Date | undefined => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const formatTravelDate = (value: string | undefined): string | undefined => {
  const parsed = parseTravelDate(value);
  if (!parsed) return undefined;
  const year = parsed.getUTCFullYear();
  const month = String(parsed.getUTCMonth() + 1).padStart(2, "0");
  const day = String(parsed.getUTCDate()).padStart(2, "0");
  return `${year}.${month}.${day} (${KOREAN_WEEKDAYS[parsed.getUTCDay()]})`;
};

export const formatHomeTripPeriod = (
  startDate: string | undefined,
  endDate: string | undefined,
): string => {
  const start = formatTravelDate(startDate);
  const end = formatTravelDate(endDate);
  return start && end ? `${start} ~ ${end}` : "일정 미정";
};

export const getHomeTripDayLabel = (
  startDate: string | undefined,
  endDate: string | undefined,
  today: string,
): string | undefined => {
  const start = parseTravelDate(startDate);
  const end = parseTravelDate(endDate);
  const current = parseTravelDate(today);
  if (!start || !current) return undefined;

  const daysUntilStart = Math.round((start.getTime() - current.getTime()) / DAY_MS);
  if (daysUntilStart > 0) return `D-${daysUntilStart}`;
  if (daysUntilStart === 0) return "D-Day";
  if (end && current.getTime() <= end.getTime()) return "여행 중";
  return undefined;
};

/**
 * 내 여행 화면과 같은 ongoing 경계를 사용하고 서버의 최신 생성순을 보존한다.
 * 날짜가 확정되지 않은 방도 기존 계약상 ongoing으로 취급한다.
 */
export const selectHomeTrip = (
  rooms: ReadonlyArray<TripRoomViewModel>,
  today: string,
): TripRoomViewModel | undefined =>
  rooms.find((room) => !isPastTravelDate(room.displayEndDate, today));

const getMemberNames = (room: TripRoomViewModel): ReadonlyArray<string> =>
  room.memberNames.map((name) => name.trim()).filter(Boolean);

const getInitial = (name: string): string =>
  Array.from(name.trim())[0]?.toUpperCase() ?? "?";

interface HomeTripCardProps {
  readonly room: TripRoomViewModel;
  readonly userName: string;
  readonly today: string;
}

export function HomeTripCard({ room, userName, today }: HomeTripCardProps) {
  const dayLabel = getHomeTripDayLabel(
    room.displayStartDate,
    room.displayEndDate,
    today,
  );
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
  const memberNames = getMemberNames(room);
  const shownMembers = memberNames.slice(0, 4);
  const remainingMembers = Math.max(0, room.memberCount - shownMembers.length);

  return (
    <section aria-labelledby="home-trip-heading">
      <Link
        to={`/trips/${encodeURIComponent(room.id)}`}
        className="group flex min-w-0 flex-col gap-4 rounded-3xl border border-primary-border-weak bg-card p-5 text-foreground! no-underline! shadow-sm transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-primary-border hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-lg leading-snug font-bold [overflow-wrap:anywhere]">
              안녕하세요, {userName} 👋
            </p>
            <h2
              id="home-trip-heading"
              className="mt-3 min-w-0 text-lg leading-snug font-bold [overflow-wrap:anywhere]"
            >
              {room.title}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-foreground-muted [overflow-wrap:anywhere]">
              {formatHomeTripPeriod(room.displayStartDate, room.displayEndDate)}
            </p>
          </div>
          <Badge
            variant={dayLabel === "여행 중" ? "success" : dayLabel ? "info" : "neutral"}
            className="mt-9 h-7 px-3 text-sm"
          >
            {dayLabel ?? "일정 미정"}
          </Badge>
        </div>

        <div className="min-w-0">
          <div className="mb-2 flex min-w-0 items-center justify-between gap-3 text-sm font-medium">
            <span className="min-w-0 text-foreground-muted [overflow-wrap:anywhere]">
              여행안 의견 참여율
            </span>
            <span className="shrink-0 text-foreground">
              {participationStatus}
            </span>
          </div>
          {participationPercent === undefined ? (
            <div
              className="h-2 rounded-full bg-muted"
              aria-label={
                hasNoCandidate ? "등록된 여행안 없음" : "의견 참여 인원 집계 전"
              }
            />
          ) : (
            <div
              role="progressbar"
              aria-label="여행안 의견 참여율"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={participationPercent}
              className="h-2 overflow-hidden rounded-full bg-muted"
            >
              <div
                className="h-full rounded-full bg-primary transition-[width]"
                style={{ width: `${participationPercent}%` }}
              />
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
          <ul className="flex min-w-0 items-center" aria-label={`여행 참여자 ${room.memberCount}명`}>
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
                <span className="sr-only">
                  그 외 {memberNames.slice(shownMembers.length).join(", ")}
                </span>
              </li>
            )}
          </ul>
          <p className="flex min-w-0 items-center gap-1.5 text-sm text-foreground-muted [overflow-wrap:anywhere]">
            <UsersRound className="size-4 shrink-0" aria-hidden="true" />
            총 {room.memberCount}명 · 여행안 {room.candidateCount}개
          </p>
        </div>
      </Link>
    </section>
  );
}

interface QuickAction {
  readonly label: string;
  readonly description: string;
  readonly icon: LucideIcon;
  readonly to?: string;
}

export function HomeQuickActions({ room }: { readonly room: TripRoomViewModel }) {
  const tripRoot = `/trips/${encodeURIComponent(room.id)}`;
  const planDestination = room.isConfirmed
    ? `${tripRoot}/itinerary`
    : `${tripRoot}/plans`;
  const actions: ReadonlyArray<QuickAction> = [
    {
      label: "일정",
      description: "여행 일정 열기",
      icon: CalendarDays,
      to: `${tripRoot}/itinerary`,
    },
    {
      label: "숙소",
      description: "숙소 정보 열기",
      icon: BedDouble,
      to: planDestination,
    },
    {
      label: "이동",
      description: "이동 정보 열기",
      icon: CarFront,
      to: planDestination,
    },
    {
      label: "지도",
      description: "지도 기능 준비 중",
      icon: MapPinned,
    },
  ];

  return (
    <section aria-labelledby="home-quick-actions-heading" className="min-w-0">
      <h2
        id="home-quick-actions-heading"
        className="text-[17px] leading-snug font-bold text-foreground"
      >
        계획 바로가기
      </h2>
      <ul className="mt-3 grid grid-cols-4 gap-2" aria-label="여행 계획 바로가기">
        {actions.map(({ label, description, icon: Icon, to }) => (
          <li key={label} className="min-w-0">
            {to ? (
              <Link
                to={to}
                aria-label={description}
                className="flex min-h-20 min-w-0 flex-col items-center justify-center gap-2 rounded-2xl bg-primary-muted px-1.5 py-3 text-sm font-semibold text-foreground! no-underline! transition-colors hover:bg-primary-border-weak focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <Icon className="size-6 text-primary" aria-hidden="true" />
                <span>{label}</span>
              </Link>
            ) : (
              <span
                aria-disabled="true"
                title={description}
                className="flex min-h-20 min-w-0 flex-col items-center justify-center gap-2 rounded-2xl bg-muted px-1.5 py-3 text-sm font-semibold text-foreground-subtle"
              >
                <Icon className="size-6" aria-hidden="true" />
                <span>{label}</span>
                <span className="sr-only">준비 중</span>
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
