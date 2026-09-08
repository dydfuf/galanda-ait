import { Link } from "react-router-dom";
import {
  CalendarDays,
  UsersRound,
} from "lucide-react";

import type { TripOverviewDto } from "@/contracts/trip-overview.ts";
import {
  classifyTrip,
  selectFeaturedTrip,
  type TripLifecycle,
} from "@/core/calculations/featured-trip.ts";

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

interface HomeTripCardProps {
  readonly trip: TripOverviewDto;
  readonly lifecycle: TripLifecycle;
  readonly today: string;
}

export function HomeTripCard({ trip, lifecycle, today }: HomeTripCardProps) {
  const { label: statusLabel } = getHomeTripDayLabel(trip, today);
  return (
    <section aria-labelledby="home-trip-heading" className="min-w-0 pt-8">
      <p className="text-sm leading-relaxed text-muted-foreground">
        {trip.isConfirmed
          ? lifecycle === "ONGOING_CONFIRMED" ? "지금 함께하는 여행" : "다가오는 여행"
          : "지금 준비 중인 여행"}
      </p>
      <h2
        id="home-trip-heading"
        className="mt-3 max-w-[8ch] text-[48px] font-bold leading-[1.15] tracking-tight break-keep text-foreground [overflow-wrap:anywhere]"
      >
        <Link
          to={`/trips/${encodeURIComponent(trip.id)}`}
          className="rounded-sm no-underline! focus-visible:outline-2 focus-visible:outline-ring"
        >
          {trip.title}
        </Link>
      </h2>
      <div className="mt-6 flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 text-base leading-relaxed text-muted-foreground">
        <p className="flex min-w-0 items-start gap-2">
          <CalendarDays className="mt-0.5 size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
          <span className="min-w-0 [overflow-wrap:anywhere]">
            {formatHomeTripPeriod(trip.confirmedPeriod?.startDate, trip.confirmedPeriod?.endDate)}
          </span>
        </p>
        <p className="flex items-center gap-2">
          <UsersRound className="size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
          <span>참여 {trip.memberCount}명</span>
        </p>
      </div>
      {trip.isConfirmed && (
        <p className="mt-3 text-sm font-medium text-primary">{statusLabel}</p>
      )}
      {trip.hasUnattributedOpinions && (
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          일부 기존 의견의 참여자를 확인할 수 없어요
        </p>
      )}
    </section>
  );
}
