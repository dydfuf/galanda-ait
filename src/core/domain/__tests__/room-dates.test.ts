import { describe, expect, it } from "vitest";
import { Schema } from "effect";
import {
  CityStaySchema,
  TravelDateSchema,
  getPlanDateRange,
  getRouteValidationError,
  getStayNightCount,
  isPastTravelDate,
  toLocalTravelDate,
} from "../room.ts";

describe("여행안 날짜 모델", () => {
  it("유효한 날짜만 TravelDate로 허용한다", () => {
    expect(Schema.is(TravelDateSchema)("2026-12-10")).toBe(true);
    expect(Schema.is(TravelDateSchema)("2026-99-99")).toBe(false);
    expect(Schema.is(TravelDateSchema)("12/10/2026")).toBe(false);
  });

  it("CityStay 날짜에서 여행 범위와 박수를 파생한다", () => {
    const routes = [
      { city: "도쿄", arrivalDate: "2026-12-10", departureDate: "2026-12-13" },
      { city: "하코네", arrivalDate: "2026-12-13", departureDate: "2026-12-15" },
    ];
    expect(routes.every(Schema.is(CityStaySchema))).toBe(true);
    expect(getPlanDateRange({ routes })).toEqual({ startDate: "2026-12-10", endDate: "2026-12-15" });
    expect(getStayNightCount(routes[0])).toBe(3);
    expect(getStayNightCount({ city: "미정", arrivalDate: "", departureDate: "" })).toBe(0);
  });

  it("역전·동일 날짜와 겹침은 거부하고 중간 공백은 허용한다", () => {
    expect(getRouteValidationError([{ city: "도쿄", arrivalDate: "2026-12-10", departureDate: "2026-12-10" }])).toContain("이후");
    expect(getRouteValidationError([
      { city: "도쿄", arrivalDate: "2026-12-10", departureDate: "2026-12-13" },
      { city: "하코네", arrivalDate: "2026-12-12", departureDate: "2026-12-15" },
    ])).toContain("겹칠");
    expect(getRouteValidationError([
      { city: "도쿄", arrivalDate: "2026-12-10", departureDate: "2026-12-13" },
      { city: "하코네", arrivalDate: "2026-12-15", departureDate: "2026-12-17" },
    ])).toBeUndefined();
  });

  it("한 방의 두 여행안과 복제본이 각자 날짜를 유지한다", () => {
    const planA = { routes: [{ city: "도쿄", arrivalDate: "2026-12-10", departureDate: "2026-12-15" }] };
    const planB = { routes: [{ city: "요코하마", arrivalDate: "2026-12-12", departureDate: "2026-12-17" }] };
    const clone = { ...planA, routes: planA.routes.map((stay) => ({ ...stay })) };
    const editedClone = { ...clone, routes: clone.routes.map((stay) => ({ ...stay, arrivalDate: "2026-12-11" })) };

    expect(getPlanDateRange(planA)).toEqual({ startDate: "2026-12-10", endDate: "2026-12-15" });
    expect(getPlanDateRange(planB)).toEqual({ startDate: "2026-12-12", endDate: "2026-12-17" });
    expect(getPlanDateRange(clone)).toEqual(getPlanDateRange(planA));
    expect(getPlanDateRange(editedClone)?.startDate).toBe("2026-12-11");
    expect(getPlanDateRange(planA)?.startDate).toBe("2026-12-10");
  });

  it("종료일은 시각이나 timezone 파싱 없이 다음 캘린더 날짜부터 과거다", () => {
    expect(isPastTravelDate("2026-08-24", "2026-08-24")).toBe(false);
    expect(isPastTravelDate("2026-08-24", "2026-08-25")).toBe(true);
    expect(isPastTravelDate(undefined, "2026-08-25")).toBe(false);
    expect(isPastTravelDate("invalid", "2026-08-25")).toBe(false);
    expect(toLocalTravelDate(new Date(2026, 7, 24, 23, 59))).toBe("2026-08-24");
  });
});
