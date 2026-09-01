import { describe, expect, it } from "vitest";

import {
  GLOBAL_NAV_ITEMS,
  resolveGlobalNavKey,
} from "./global-nav.ts";

describe("resolveGlobalNavKey (RAON-249 route contract / Issue #96)", () => {
  it("logical order로 4개 목적지를 노출한다", () => {
    expect(GLOBAL_NAV_ITEMS.map((i) => i.key)).toEqual([
      "HOME",
      "EXPLORE",
      "TRIPS",
      "ME",
    ]);
    expect(GLOBAL_NAV_ITEMS.map((i) => i.path)).toEqual([
      "/home",
      "/explore",
      "/trips",
      "/me",
    ]);
  });

  it("Global shell이 표시되는 exact path만 올바른 destination key를 반환한다", () => {
    expect(resolveGlobalNavKey("/home")).toBe("HOME");
    expect(resolveGlobalNavKey("/home/")).toBe("HOME");
    expect(resolveGlobalNavKey("/explore?cursor=abc")).toBe("EXPLORE");
    expect(resolveGlobalNavKey("/trips#top")).toBe("TRIPS");
    expect(resolveGlobalNavKey("/me")).toBe("ME");
    expect(resolveGlobalNavKey("/me/saved")).toBe("ME");
    expect(resolveGlobalNavKey("/me/saved/")).toBe("ME");
  });

  it("Trip Room, focused/standalone 화면, 존재하지 않는 하위 경로는 undefined", () => {
    expect(resolveGlobalNavKey("/trips/trip-1")).toBeUndefined();
    expect(resolveGlobalNavKey("/trips/trip-1/plans")).toBeUndefined();
    expect(resolveGlobalNavKey("/trips/trip-1/itinerary")).toBeUndefined();
    expect(resolveGlobalNavKey("/trips/new")).toBeUndefined();
    expect(resolveGlobalNavKey("/trips/trip-1/setup/companions")).toBeUndefined();
    expect(resolveGlobalNavKey("/trips/trip-1/plans/new")).toBeUndefined();
    expect(resolveGlobalNavKey("/trips/trip-1/plans/plan-1")).toBeUndefined();
    expect(resolveGlobalNavKey("/trips/trip-1/plans/plan-1/edit")).toBeUndefined();
    expect(resolveGlobalNavKey("/trips/trip-1/plans/compare")).toBeUndefined();
    expect(resolveGlobalNavKey("/trips/trip-1/itinerary/edit")).toBeUndefined();
    expect(resolveGlobalNavKey("/explore/listing-1")).toBeUndefined();
    expect(resolveGlobalNavKey("/home/anything")).toBeUndefined();
    expect(resolveGlobalNavKey("/me/settings")).toBeUndefined();
    expect(resolveGlobalNavKey("/login")).toBeUndefined();
    expect(resolveGlobalNavKey("/invites/token-1")).toBeUndefined();
    expect(resolveGlobalNavKey("/")).toBeUndefined();
    expect(resolveGlobalNavKey("/trips-archive")).toBeUndefined();
    expect(resolveGlobalNavKey("/homepage")).toBeUndefined();
  });
});

