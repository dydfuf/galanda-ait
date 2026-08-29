import { describe, expect, it } from "vitest";

import {
  GLOBAL_NAV_ITEMS,
  resolveGlobalNavKey,
} from "./global-nav.ts";

describe("resolveGlobalNavKey (RAON-249 route contract)", () => {
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

  it("/home 및 하위는 HOME", () => {
    expect(resolveGlobalNavKey("/home")).toBe("HOME");
    expect(resolveGlobalNavKey("/home/")).toBe("HOME");
    expect(resolveGlobalNavKey("/home/anything")).toBe("HOME");
  });

  it("/explore 및 하위는 EXPLORE", () => {
    expect(resolveGlobalNavKey("/explore")).toBe("EXPLORE");
    expect(resolveGlobalNavKey("/explore/xyz")).toBe("EXPLORE");
  });

  it("/me 및 하위는 ME", () => {
    expect(resolveGlobalNavKey("/me")).toBe("ME");
    expect(resolveGlobalNavKey("/me/settings")).toBe("ME");
  });

  it("모든 /trips/** 는 TRIPS로 active", () => {
    expect(resolveGlobalNavKey("/trips")).toBe("TRIPS");
    expect(resolveGlobalNavKey("/trips/new")).toBe("TRIPS");
    expect(resolveGlobalNavKey("/trips/trip-1")).toBe("TRIPS");
    expect(resolveGlobalNavKey("/trips/trip-1/plans")).toBe("TRIPS");
    expect(resolveGlobalNavKey("/trips/trip-1/itinerary")).toBe("TRIPS");
    expect(resolveGlobalNavKey("/trips/trip-1/plans/new")).toBe("TRIPS");
    expect(resolveGlobalNavKey("/trips/trip-1/plans/plan-1")).toBe("TRIPS");
    expect(resolveGlobalNavKey("/trips/trip-1/plans/plan-1/edit")).toBe("TRIPS");
    expect(resolveGlobalNavKey("/trips/trip-1/plans/compare")).toBe("TRIPS");
    expect(resolveGlobalNavKey("/trips/trip-1/itinerary/edit")).toBe("TRIPS");
  });

  it("쿼리/해시가 붙어도 pathname 기준으로 해석한다", () => {
    expect(resolveGlobalNavKey("/explore?cursor=abc")).toBe("EXPLORE");
    expect(resolveGlobalNavKey("/trips#top")).toBe("TRIPS");
  });

  it("Global 목적지가 아닌 경로는 undefined (shell을 그리지 않음)", () => {
    expect(resolveGlobalNavKey("/login")).toBeUndefined();
    expect(resolveGlobalNavKey("/invites/token-1")).toBeUndefined();
    expect(resolveGlobalNavKey("/")).toBeUndefined();
    // prefix 오탐 방지: /trips-archive는 /trips가 아니다.
    expect(resolveGlobalNavKey("/trips-archive")).toBeUndefined();
    expect(resolveGlobalNavKey("/homepage")).toBeUndefined();
  });
});
