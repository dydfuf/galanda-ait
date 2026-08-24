import { describe, expect, it } from "vitest";
import { getTripRoomSection, getTripRoomSectionPath } from "./trip-room-navigation.ts";

describe("Trip Room mode navigation", () => {
  it("derives the mode from the URL and builds safe section paths", () => {
    expect(getTripRoomSection("/trips/trip-1/plans")).toBe("plans");
    expect(getTripRoomSection("/trips/trip-1/itinerary")).toBe("itinerary");
    expect(getTripRoomSectionPath("trip-1", "itinerary")).toBe("/trips/trip-1/itinerary");
    expect(getTripRoomSectionPath("trip-1", "unknown")).toBe("/trips/trip-1/plans");
  });
});
