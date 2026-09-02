import { Link } from "react-router-dom";
import {
  CalendarDays,
  Columns2,
  FileText,
  UsersRound,
} from "lucide-react";

import { Badge } from "@/components/ui/badge.tsx";
import { buttonVariants } from "@/components/ui/button.tsx";
import type { TripOverviewDto } from "@/contracts/trip-overview.ts";
import {
  classifyTrip,
  selectFeaturedTrip,
  type TripLifecycle,
} from "@/core/calculations/featured-trip.ts";
import { cn } from "@/lib/utils.ts";

export { selectFeaturedTrip };

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

export const getTravelDateRangeDayLabel = (
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

export const getHomeTripDayLabel = (
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
    return { label: "확정 · 날짜 확인 필요", variant: "warning" };
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

interface HomeTripCardProps {
  readonly trip: TripOverviewDto;
  readonly lifecycle: TripLifecycle;
  readonly today: string;
}

export function HomeTripCard({ trip, lifecycle, today }: HomeTripCardProps) {
  const { label: statusLabel, variant: badgeVariant } = getHomeTripDayLabel(trip, today);
  const memberNames = getMemberNames(trip);
  const shownMembers = memberNames.slice(0, 4);
  const remainingMembers = Math.max(0, trip.memberCount - shownMembers.length);

  const tripRoot = `/trips/${encodeURIComponent(trip.id)}`;

  return (
    <section aria-labelledby="home-trip-heading">
      <div className="flex min-w-0 flex-col gap-4 rounded-3xl border border-primary-border-weak bg-card p-5 text-foreground shadow-sm">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <h2
              id="home-trip-heading"
              className="min-w-0 text-lg leading-snug font-bold [overflow-wrap:anywhere]"
            >
              <Link
                to={tripRoot}
                className="text-foreground! no-underline! hover:underline"
              >
                {trip.title}
              </Link>
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-foreground-muted [overflow-wrap:anywhere]">
              {formatHomeTripPeriod(
                trip.confirmedPeriod?.startDate,
                trip.confirmedPeriod?.endDate
              )}
            </p>
          </div>
          <Badge
            variant={badgeVariant}
            className="h-7 shrink-0 px-3 text-sm"
          >
            {statusLabel}
          </Badge>
        </div>

        {/* Factual numbers */}
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-y border-border py-3 text-sm text-foreground-muted">
          {lifecycle === "PLANNING" ? (
            <div className="flex flex-col gap-1">
              <span className="font-semibold text-foreground">
                {trip.hasUnattributedOpinions
                  ? "일부 기존 의견의 참여자를 확인할 수 없어요"
                  : `의견 참여 ${trip.opinionParticipantCount}/${trip.memberCount}명`}
              </span>
              <span className="text-xs text-foreground-muted">
                후보 여행안 {trip.candidateCount}개
              </span>
            </div>
          ) : lifecycle === "DATE_TBD" ? (
            <div className="flex flex-col gap-1">
              <span className="font-semibold text-foreground">
                여행안이 아직 없어요
              </span>
              <span className="text-xs text-foreground-muted">
                첫 여행안을 만들어 계획을 시작해보세요
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 font-medium text-foreground">
              <CalendarDays className="size-4 text-primary" aria-hidden="true" />
              <span>확정된 여행 일정</span>
            </div>
          )}

          <div className="flex items-center gap-1.5 text-xs text-foreground-muted">
            <UsersRound className="size-4 shrink-0" aria-hidden="true" />
            <span>참여 {trip.memberCount}명</span>
          </div>
        </div>

        {/* Members and Actions */}
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
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
                  index > 0 && "-ml-2"
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

          <div className="flex items-center gap-2">
            {lifecycle === "ONGOING_CONFIRMED" || lifecycle === "UPCOMING_CONFIRMED" ? (
              <>
                <Link
                  to={`${tripRoot}/plans`}
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "no-underline!")}
                >
                  <FileText className="size-4" aria-hidden="true" />
                  계획 보기
                </Link>
                <Link
                  to={`${tripRoot}/itinerary`}
                  className={cn(buttonVariants({ variant: "default", size: "sm" }), "no-underline!")}
                >
                  <CalendarDays className="size-4" aria-hidden="true" />
                  일정 보기
                </Link>
              </>
            ) : lifecycle === "CONFIRMED_DATE_UNKNOWN" ? (
              <Link
                to={`${tripRoot}/itinerary`}
                className={cn(buttonVariants({ variant: "default", size: "sm" }), "no-underline!")}
              >
                <CalendarDays className="size-4" aria-hidden="true" />
                일정 보기
              </Link>
            ) : lifecycle === "PLANNING" ? (
              <>
                {trip.candidateCount >= 2 && trip.eligibleActionIds.includes("COMPARE_PLANS") && (
                  <Link
                    to={`${tripRoot}/plans/compare`}
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }), "no-underline!")}
                  >
                    <Columns2 className="size-4" aria-hidden="true" />
                    여행안 비교
                  </Link>
                )}
                <Link
                  to={`${tripRoot}/plans`}
                  className={cn(buttonVariants({ variant: "default", size: "sm" }), "no-underline!")}
                >
                  <FileText className="size-4" aria-hidden="true" />
                  계획 보기
                </Link>
              </>
            ) : (
              <Link
                to={`${tripRoot}/plans`}
                className={cn(buttonVariants({ variant: "default", size: "sm" }), "no-underline!")}
              >
                <FileText className="size-4" aria-hidden="true" />
                {trip.eligibleActionIds.includes("EDIT_PLAN_BASIC")
                  ? "계획 시작하기"
                  : "계획 보기"}
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
