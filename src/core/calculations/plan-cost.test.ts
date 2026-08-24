import { describe, expect, it } from "vitest";
import type { AccommodationSnapshot, TransportSnapshot } from "../domain/room.ts";
import { calculatePlanCost, formatCostRangeText } from "./plan-cost.ts";

describe("여행안 가격 계산", () => {
  it("확정가·범위·미정 항목을 구분해 그룹 총액과 1인 금액을 계산한다", () => {
    const accommodations: AccommodationSnapshot[] = [
      {
        id: "stay-exact",
        city: "서울",
        period: "2026-09-01 ~ 2026-09-03",
        nights: 2,
        hotelName: "호텔",
        bookingStatus: "AVAILABLE",
        priceRange: { min: 200_000, max: 200_000 },
      },
      {
        id: "stay-unknown",
        city: "부산",
        period: "2026-09-03 ~ 2026-09-05",
        nights: 2,
        hotelName: "",
        isSearching: true,
        bookingStatus: "NOT_CHECKED",
      },
    ];
    const transports: TransportSnapshot[] = [{
      id: "transport-range",
      fromCity: "서울",
      toCity: "부산",
      mode: "KTX",
      hasTransfer: false,
      durationText: "2시간 30분",
      bookingStatus: "NEED_CHECK",
      priceRange: { min: 100_000, max: 140_000 },
    }];

    expect(calculatePlanCost(accommodations, transports, 4)).toEqual({
      minTotal: 300_000,
      maxTotal: 340_000,
      hasCost: true,
      isRange: true,
      unpricedCount: 1,
      baseHeadcount: 4,
      minPerPerson: 75_000,
      maxPerPerson: 85_000,
    });
    expect(formatCostRangeText(300_000, 340_000, 1)).toBe(
      "30만원 ~ 34만원 (가격 미정 1건 별도)"
    );
  });

  it("입력된 0원은 가격 미정과 다르게 알려진 가격으로 유지한다", () => {
    const freeTransport: TransportSnapshot = {
      id: "walk",
      fromCity: "서울",
      toCity: "서울",
      mode: "도보",
      hasTransfer: false,
      durationText: "10분",
      bookingStatus: "AVAILABLE",
      priceRange: { min: 0, max: 0 },
    };

    expect(calculatePlanCost(undefined, [freeTransport], 2)).toMatchObject({
      hasCost: true,
      minTotal: 0,
      maxTotal: 0,
      unpricedCount: 0,
    });
    expect(calculatePlanCost(undefined, [{ ...freeTransport, priceRange: undefined }], 2)).toMatchObject({
      hasCost: false,
      unpricedCount: 1,
    });
    expect(formatCostRangeText(0, 0)).toBe("0원");
  });
});
