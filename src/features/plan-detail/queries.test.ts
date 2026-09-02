import { describe, expect, it } from "vitest";
import { TRIP_ROOM_FRESHNESS } from "./queries.ts";

describe("Trip Room freshness", () => {
  it("uses the collaboration refresh contract", () => {
    expect(TRIP_ROOM_FRESHNESS).toEqual({
      staleTime: 10_000,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    });
  });
});
