import { describe, expect, it } from "vitest";
import { getPlanPublishValidationErrors, type TripPlan } from "../room.ts";

const completePlan: Pick<
  TripPlan,
  "title" | "baseHeadcount" | "routes" | "accommodations" | "transports"
> = {
  title: "서울 여행",
  baseHeadcount: 2,
  routes: [{ city: "서울", arrivalDate: "2026-09-01", departureDate: "2026-09-03" }],
  accommodations: [{
    id: "stay-1",
    city: "서울",
    period: "2026-09-01 ~ 2026-09-03",
    nights: 2,
    hotelName: "",
    isSearching: true,
    bookingStatus: "NOT_CHECKED",
  }],
  transports: [
    {
      id: "outbound",
      fromCity: "부산",
      toCity: "서울",
      mode: "",
      hasTransfer: false,
      durationText: "",
      bookingStatus: "NOT_CHECKED",
    },
    {
      id: "return",
      fromCity: "서울",
      toCity: "부산",
      mode: "",
      hasTransfer: false,
      durationText: "",
      bookingStatus: "NOT_CHECKED",
    },
  ],
};

describe("여행안 공개 검증", () => {
  it("제목만 있는 여행안은 공개하지 못한다", () => {
    expect(getPlanPublishValidationErrors({ title: "제목만", baseHeadcount: 2 }))
      .toContain("최소 1개 이상의 방문 도시를 추가해주세요.");
  });

  it("숙소·출국·귀국 구간이 실제 입력 또는 찾는 중이면 가격 없이도 공개할 수 있다", () => {
    expect(getPlanPublishValidationErrors(completePlan)).toEqual([]);
  });

  it("역전된 가격 범위는 거부한다", () => {
    const invalid = {
      ...completePlan,
      accommodations: completePlan.accommodations?.map((stay) => ({
        ...stay,
        priceRange: { min: 200_000, max: 100_000 },
      })),
    };

    expect(getPlanPublishValidationErrors(invalid)).toContain(
      "가격 범위는 0원 이상이며 최소 금액이 최대 금액보다 클 수 없습니다."
    );
  });

  it("찾는 중 숙소에 예시 호텔명을 실제 값처럼 공개하지 않는다", () => {
    const invalid = {
      ...completePlan,
      accommodations: completePlan.accommodations?.map((stay) => ({
          ...stay,
          hotelName: "숙소 찾는 중",
          isSearching: true,
      })),
    };

    expect(getPlanPublishValidationErrors(invalid)).toContain(
      "각 방문 도시의 숙소 또는 숙소 찾는 중 상태를 추가해주세요."
    );
  });
});
