import { describe, expect, it } from "vitest";
import type { TripOverviewDto } from "../../contracts/trip-overview.ts";
import {
  classifyTrip,
  selectFeaturedTrip,
} from "./featured-trip.ts";

function createTrip(partial: Partial<TripOverviewDto> & { id: string }): TripOverviewDto {
  return {
    id: partial.id,
    title: partial.title ?? `Trip ${partial.id}`,
    destination: partial.destination ?? "Jeju",
    revision: partial.revision ?? 1,
    isConfirmed: partial.isConfirmed ?? false,
    confirmedPeriod: partial.confirmedPeriod ?? null,
    memberCount: partial.memberCount ?? 2,
    memberNames: partial.memberNames ?? ["Alice", "Bob"],
    candidateCount: partial.candidateCount ?? 0,
    opinionParticipantCount: partial.opinionParticipantCount ?? 0,
    hasUnattributedOpinions: partial.hasUnattributedOpinions ?? false,
    createdAt: partial.createdAt ?? "2026-08-01T00:00:00.000Z",
    updatedAt: partial.updatedAt ?? "2026-08-01T00:00:00.000Z",
    eligibleActionIds: partial.eligibleActionIds ?? [],
  };
}

function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [items.slice()];
  const result: T[][] = [];
  for (let i = 0; i < items.length; i++) {
    const current = items[i];
    const rest = items.slice(0, i).concat(items.slice(i + 1));
    for (const p of permutations(rest)) {
      result.push([current, ...p]);
    }
  }
  return result;
}

describe("classifyTrip", () => {
  const today = "2026-09-01";

  it("classifies confirmed ongoing when today is between start and end", () => {
    const trip = createTrip({
      id: "1",
      isConfirmed: true,
      confirmedPeriod: { startDate: "2026-08-30", endDate: "2026-09-05" },
    });
    expect(classifyTrip(trip, today)).toBe("ONGOING_CONFIRMED");
  });

  it("classifies confirmed ongoing on start and end date boundary", () => {
    const startSame = createTrip({
      id: "1",
      isConfirmed: true,
      confirmedPeriod: { startDate: "2026-09-01", endDate: "2026-09-05" },
    });
    expect(classifyTrip(startSame, today)).toBe("ONGOING_CONFIRMED");

    const endSame = createTrip({
      id: "2",
      isConfirmed: true,
      confirmedPeriod: { startDate: "2026-08-25", endDate: "2026-09-01" },
    });
    expect(classifyTrip(endSame, today)).toBe("ONGOING_CONFIRMED");
  });

  it("classifies confirmed upcoming when start is after today", () => {
    const trip = createTrip({
      id: "1",
      isConfirmed: true,
      confirmedPeriod: { startDate: "2026-09-02", endDate: "2026-09-10" },
    });
    expect(classifyTrip(trip, today)).toBe("UPCOMING_CONFIRMED");
  });

  it("classifies confirmed past when end is before today", () => {
    const trip = createTrip({
      id: "1",
      isConfirmed: true,
      confirmedPeriod: { startDate: "2026-08-01", endDate: "2026-08-31" },
    });
    expect(classifyTrip(trip, today)).toBe("PAST");
  });

  it("classifies confirmed date unknown when confirmedPeriod is null", () => {
    const trip = createTrip({
      id: "1",
      isConfirmed: true,
      confirmedPeriod: null,
    });
    expect(classifyTrip(trip, today)).toBe("CONFIRMED_DATE_UNKNOWN");
  });

  it("classifies unconfirmed planning when candidateCount > 0", () => {
    const trip = createTrip({
      id: "1",
      isConfirmed: false,
      candidateCount: 2,
    });
    expect(classifyTrip(trip, today)).toBe("PLANNING");
  });

  it("classifies unconfirmed date TBD when candidateCount == 0", () => {
    const trip = createTrip({
      id: "1",
      isConfirmed: false,
      candidateCount: 0,
    });
    expect(classifyTrip(trip, today)).toBe("DATE_TBD");
  });

  it("throws error for malformed or reversed date range", () => {
    const reversed = createTrip({
      id: "1",
      isConfirmed: true,
      confirmedPeriod: { startDate: "2026-09-10", endDate: "2026-09-01" },
    });
    expect(() => classifyTrip(reversed, today)).toThrow("Invalid confirmedPeriod");
  });
});

describe("selectFeaturedTrip", () => {
  const today = "2026-09-01";

  it("returns null when no trips exist", () => {
    const result = selectFeaturedTrip([], today);
    expect(result).toEqual({
      featured: null,
      lifecycle: null,
      hasAnyTrips: false,
      hasOnlyPastTrips: false,
    });
  });

  it("returns hasOnlyPastTrips when all trips are past", () => {
    const pastTrip1 = createTrip({
      id: "p1",
      isConfirmed: true,
      confirmedPeriod: { startDate: "2026-07-01", endDate: "2026-07-10" },
    });
    const pastTrip2 = createTrip({
      id: "p2",
      isConfirmed: true,
      confirmedPeriod: { startDate: "2026-08-01", endDate: "2026-08-10" },
    });
    const result = selectFeaturedTrip([pastTrip1, pastTrip2], today);
    expect(result.featured).toBeNull();
    expect(result.hasOnlyPastTrips).toBe(true);
    expect(result.hasAnyTrips).toBe(true);
  });

  it("prioritizes ONGOING over UPCOMING over CONFIRMED_DATE_UNKNOWN over PLANNING over DATE_TBD", () => {
    const ongoing = createTrip({
      id: "ongoing-1",
      isConfirmed: true,
      confirmedPeriod: { startDate: "2026-08-28", endDate: "2026-09-03" },
    });
    const upcoming = createTrip({
      id: "upcoming-1",
      isConfirmed: true,
      confirmedPeriod: { startDate: "2026-09-05", endDate: "2026-09-10" },
    });
    const confirmedNoDate = createTrip({
      id: "confirmed-no-date",
      isConfirmed: true,
      confirmedPeriod: null,
    });
    const planning = createTrip({
      id: "planning-1",
      isConfirmed: false,
      candidateCount: 1,
    });
    const dateTbd = createTrip({
      id: "date-tbd-1",
      isConfirmed: false,
      candidateCount: 0,
    });

    expect(selectFeaturedTrip([upcoming, ongoing], today).featured?.id).toBe("ongoing-1");
    expect(selectFeaturedTrip([confirmedNoDate, upcoming], today).featured?.id).toBe("upcoming-1");
    expect(selectFeaturedTrip([planning, confirmedNoDate], today).featured?.id).toBe("confirmed-no-date");
    expect(selectFeaturedTrip([dateTbd, planning], today).featured?.id).toBe("planning-1");
  });

  it("picks earliest ending ongoing trip", () => {
    const ongoingEndsSooner = createTrip({
      id: "ends-sep-3",
      isConfirmed: true,
      confirmedPeriod: { startDate: "2026-08-20", endDate: "2026-09-03" },
    });
    const ongoingEndsLater = createTrip({
      id: "ends-sep-10",
      isConfirmed: true,
      confirmedPeriod: { startDate: "2026-08-20", endDate: "2026-09-10" },
    });
    expect(selectFeaturedTrip([ongoingEndsLater, ongoingEndsSooner], today).featured?.id).toBe("ends-sep-3");
  });

  it("picks earliest starting upcoming trip", () => {
    const startsSooner = createTrip({
      id: "starts-sep-05",
      isConfirmed: true,
      confirmedPeriod: { startDate: "2026-09-05", endDate: "2026-09-10" },
    });
    const startsLater = createTrip({
      id: "starts-sep-20",
      isConfirmed: true,
      confirmedPeriod: { startDate: "2026-09-20", endDate: "2026-09-25" },
    });
    expect(selectFeaturedTrip([startsLater, startsSooner], today).featured?.id).toBe("starts-sep-05");
  });

  it("breaks ties with updatedAt DESC, then createdAt DESC, then id ASC", () => {
    const tripA = createTrip({
      id: "trip-a",
      isConfirmed: false,
      candidateCount: 1,
      updatedAt: "2026-08-10T12:00:00Z",
      createdAt: "2026-08-01T00:00:00Z",
    });
    const tripB = createTrip({
      id: "trip-b",
      isConfirmed: false,
      candidateCount: 1,
      updatedAt: "2026-08-10T15:00:00Z",
      createdAt: "2026-08-01T00:00:00Z",
    });
    expect(selectFeaturedTrip([tripA, tripB], today).featured?.id).toBe("trip-b");

    const tripC = createTrip({
      id: "trip-c",
      isConfirmed: false,
      candidateCount: 1,
      updatedAt: "2026-08-10T15:00:00Z",
      createdAt: "2026-08-02T00:00:00Z",
    });
    expect(selectFeaturedTrip([tripB, tripC], today).featured?.id).toBe("trip-c");

    const tripD = createTrip({
      id: "trip-d",
      isConfirmed: false,
      candidateCount: 1,
      updatedAt: "2026-08-10T15:00:00Z",
      createdAt: "2026-08-02T00:00:00Z",
    });
    expect(selectFeaturedTrip([tripD, tripC], today).featured?.id).toBe("trip-c");
  });

  it("produces identical selection across all input permutations (total order invariant)", () => {
    const ongoing = createTrip({
      id: "ongoing-1",
      isConfirmed: true,
      confirmedPeriod: { startDate: "2026-08-28", endDate: "2026-09-03" },
    });
    const upcoming1 = createTrip({
      id: "upcoming-1",
      isConfirmed: true,
      confirmedPeriod: { startDate: "2026-09-05", endDate: "2026-09-10" },
    });
    const upcoming2 = createTrip({
      id: "upcoming-2",
      isConfirmed: true,
      confirmedPeriod: { startDate: "2026-09-12", endDate: "2026-09-15" },
    });
    const planning = createTrip({
      id: "planning-1",
      isConfirmed: false,
      candidateCount: 3,
    });
    const past = createTrip({
      id: "past-1",
      isConfirmed: true,
      confirmedPeriod: { startDate: "2026-07-01", endDate: "2026-07-05" },
    });

    const fixtures = [ongoing, upcoming1, upcoming2, planning, past];
    const expectedFeaturedId = "ongoing-1";

    for (const p of permutations(fixtures)) {
      expect(selectFeaturedTrip(p, today).featured?.id).toBe(expectedFeaturedId);
    }
  });

  it("strictly validates calendar dates (leap year, month days, month range)", () => {
    // 2026 is not a leap year -> Feb 29 is invalid
    const invalidLeap = createTrip({
      id: "trip-invalid-leap",
      isConfirmed: true,
      confirmedPeriod: { startDate: "2026-02-29", endDate: "2026-03-02" },
    });
    expect(() => selectFeaturedTrip([invalidLeap], today)).toThrow("Invalid confirmedPeriod");

    // 2028 is a leap year -> Feb 29 is valid
    const validLeap = createTrip({
      id: "trip-valid-leap",
      isConfirmed: true,
      confirmedPeriod: { startDate: "2028-02-29", endDate: "2028-03-02" },
    });
    expect(classifyTrip(validLeap, "2028-01-01")).toBe("UPCOMING_CONFIRMED");

    // April 31 is invalid
    const invalidApril = createTrip({
      id: "trip-invalid-april",
      isConfirmed: true,
      confirmedPeriod: { startDate: "2026-04-01", endDate: "2026-04-31" },
    });
    expect(() => selectFeaturedTrip([invalidApril], today)).toThrow("Invalid confirmedPeriod");
  });
});
