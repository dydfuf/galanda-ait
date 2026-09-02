import { describe, expect, it } from "vitest";
import { getLoginPath, getSessionRedirect, safeReturnTo } from "./auth.ts";
import type { UserSession } from "@/core/domain/room.ts";

const session = (accountType: UserSession["accountType"]): UserSession => ({
  participantId: "participant-1" as UserSession["participantId"],
  participantIds: ["participant-1" as UserSession["participantId"]],
  accountType,
  name: "여행자",
  isAuthenticated: true,
});

describe("safeReturnTo", () => {
  it("keeps internal paths and rejects external redirects", () => {
    expect(safeReturnTo("/trips")).toBe("/trips");
    expect(safeReturnTo("/trips/trip-1/plans")).toBe("/trips/trip-1/plans");
    expect(safeReturnTo("/trips/trip-1/plans?source=invite")).toBe("/trips/trip-1/plans?source=invite");
    expect(safeReturnTo("/trips/trip-1/itinerary#day-2")).toBe("/trips/trip-1/itinerary#day-2");
    expect(safeReturnTo("/invites/token?from=login")).toBe("/invites/token?from=login");

    // Malicious or invalid redirect candidates
    expect(safeReturnTo("https://evil.example")).toBe("/trips");
    expect(safeReturnTo("//evil.example")).toBe("/trips");
    expect(safeReturnTo("\\\\evil.example")).toBe("/trips");
    expect(safeReturnTo("/\\evil.example")).toBe("/trips");
    expect(safeReturnTo("javascript:alert(1)")).toBe("/trips");
    expect(safeReturnTo("")).toBe("/trips");
    expect(safeReturnTo(null)).toBe("/trips");
  });
});

describe("getLoginPath", () => {
  it("preserves the internal destination and marks account upgrades", () => {
    expect(getLoginPath("/trips/room-1?tab=plans#members")).toBe(
      "/login?returnTo=%2Ftrips%2Froom-1%3Ftab%3Dplans%23members"
    );
    expect(getLoginPath("/trips/new", true)).toBe(
      "/login?returnTo=%2Ftrips%2Fnew&reason=upgrade"
    );
  });
});

describe("getSessionRedirect", () => {
  it("redirects only missing sessions and guests on registered routes", () => {
    expect(getSessionRedirect(null, "/trips")).toBe("/login?returnTo=%2Ftrips");
    expect(getSessionRedirect(session("GUEST"), "/trips")).toBeNull();
    expect(getSessionRedirect(session("GUEST"), "/trips/new", true)).toBe(
      "/login?returnTo=%2Ftrips%2Fnew&reason=upgrade"
    );
    expect(getSessionRedirect(session("REGISTERED"), "/trips/new", true)).toBeNull();
  });
});
