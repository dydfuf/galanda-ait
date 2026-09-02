import type { TripOverviewDto } from "../../contracts/trip-overview.ts";

export type TripLifecycle =
  | "ONGOING_CONFIRMED"
  | "UPCOMING_CONFIRMED"
  | "CONFIRMED_DATE_UNKNOWN"
  | "PLANNING"
  | "DATE_TBD"
  | "PAST";

const DATE_REGEX = /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})$/;

export function isValidDateOnly(date: string): boolean {
  const match = DATE_REGEX.exec(date);
  if (!match || !match.groups) return false;
  const year = Number(match.groups.year);
  const month = Number(match.groups.month);
  const day = Number(match.groups.day);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= daysInMonth;
}

export function classifyTrip(
  trip: TripOverviewDto,
  today: string,
): TripLifecycle {
  if (!isValidDateOnly(today)) {
    throw new Error(`Invalid today date format: "${today}". Expected YYYY-MM-DD.`);
  }

  if (trip.isConfirmed) {
    if (!trip.confirmedPeriod) {
      return "CONFIRMED_DATE_UNKNOWN";
    }

    const { startDate, endDate } = trip.confirmedPeriod;
    if (
      !isValidDateOnly(startDate) ||
      !isValidDateOnly(endDate) ||
      startDate > endDate
    ) {
      throw new Error(
        `Invalid confirmedPeriod in trip ${trip.id}: startDate="${startDate}", endDate="${endDate}".`
      );
    }

    if (endDate < today) {
      return "PAST";
    }
    if (startDate > today) {
      return "UPCOMING_CONFIRMED";
    }
    return "ONGOING_CONFIRMED";
  }

  if (trip.candidateCount > 0) {
    return "PLANNING";
  }

  return "DATE_TBD";
}

const LIFECYCLE_PRIORITY: Record<Exclude<TripLifecycle, "PAST">, number> = {
  ONGOING_CONFIRMED: 1,
  UPCOMING_CONFIRMED: 2,
  CONFIRMED_DATE_UNKNOWN: 3,
  PLANNING: 4,
  DATE_TBD: 5,
};

function compareString(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function compareSameLifecycle(
  a: TripOverviewDto,
  b: TripOverviewDto,
  lifecycle: Exclude<TripLifecycle, "PAST">,
): number {
  if (lifecycle === "ONGOING_CONFIRMED") {
    const endCmp = compareString(
      a.confirmedPeriod?.endDate ?? "",
      b.confirmedPeriod?.endDate ?? ""
    );
    if (endCmp !== 0) return endCmp;

    const startCmp = compareString(
      a.confirmedPeriod?.startDate ?? "",
      b.confirmedPeriod?.startDate ?? ""
    );
    if (startCmp !== 0) return startCmp;
  } else if (lifecycle === "UPCOMING_CONFIRMED") {
    const startCmp = compareString(
      a.confirmedPeriod?.startDate ?? "",
      b.confirmedPeriod?.startDate ?? ""
    );
    if (startCmp !== 0) return startCmp;

    const endCmp = compareString(
      a.confirmedPeriod?.endDate ?? "",
      b.confirmedPeriod?.endDate ?? ""
    );
    if (endCmp !== 0) return endCmp;
  }

  // updatedAt DESC
  const updatedCmp = compareString(b.updatedAt, a.updatedAt);
  if (updatedCmp !== 0) return updatedCmp;

  // createdAt DESC
  const createdCmp = compareString(b.createdAt, a.createdAt);
  if (createdCmp !== 0) return createdCmp;

  // id ASC (deterministic tie-break)
  return compareString(a.id, b.id);
}

export function compareFeaturedTrip(
  itemA: { trip: TripOverviewDto; lifecycle: TripLifecycle },
  itemB: { trip: TripOverviewDto; lifecycle: TripLifecycle },
): number {
  if (itemA.lifecycle === "PAST" && itemB.lifecycle === "PAST") {
    return compareString(itemA.trip.id, itemB.trip.id);
  }
  if (itemA.lifecycle === "PAST") return 1;
  if (itemB.lifecycle === "PAST") return -1;

  const priorityA = LIFECYCLE_PRIORITY[itemA.lifecycle];
  const priorityB = LIFECYCLE_PRIORITY[itemB.lifecycle];
  if (priorityA !== priorityB) {
    return priorityA - priorityB;
  }

  return compareSameLifecycle(itemA.trip, itemB.trip, itemA.lifecycle);
}

export type FeaturedTripSelection = {
  featured: TripOverviewDto | null;
  lifecycle: TripLifecycle | null;
  hasAnyTrips: boolean;
  hasOnlyPastTrips: boolean;
};

export function selectFeaturedTrip(
  trips: readonly TripOverviewDto[],
  today: string,
): FeaturedTripSelection {
  if (trips.length === 0) {
    return {
      featured: null,
      lifecycle: null,
      hasAnyTrips: false,
      hasOnlyPastTrips: false,
    };
  }

  const classified = trips.map((trip) => ({
    trip,
    lifecycle: classifyTrip(trip, today),
  }));

  const active = classified
    .filter(
      (item): item is { trip: TripOverviewDto; lifecycle: Exclude<TripLifecycle, "PAST"> } =>
        item.lifecycle !== "PAST"
    )
    .slice()
    .sort(compareFeaturedTrip);

  const hasOnlyPastTrips = classified.every(({ lifecycle }) => lifecycle === "PAST");

  return {
    featured: active[0]?.trip ?? null,
    lifecycle: active[0]?.lifecycle ?? null,
    hasAnyTrips: true,
    hasOnlyPastTrips,
  };
}
