import { describe, expect, it } from "vitest";
import { syncAccommodationNights } from "../usePlanEditorState.ts";

describe("syncAccommodationNights", () => {
  it("편집한 도시 날짜에서 숙소 박수를 다시 계산한다", () => {
    const accommodations = syncAccommodationNights(
      [{ city: "도쿄", arrivalDate: "2026-12-10", departureDate: "2026-12-13" }],
      [{ id: "stay-1", city: "여행지", period: "전체 일정", nights: 0, hotelName: "찾는 중", bookingStatus: "NEED_CHECK" }]
    );

    expect(accommodations[0]).toMatchObject({
      city: "도쿄",
      period: "2026-12-10 ~ 2026-12-13",
      nights: 3,
    });
  });

  it("같은 도시의 두 번째 숙소는 배열 index가 아닌 해당 도시 route를 사용한다", () => {
    const accommodations = syncAccommodationNights(
      [
        { city: "도쿄", arrivalDate: "2026-12-10", departureDate: "2026-12-13" },
        { city: "하코네", arrivalDate: "2026-12-13", departureDate: "2026-12-15" },
      ],
      [
        { id: "stay-1", city: "도쿄", period: "전체 일정", nights: 0, hotelName: "A", bookingStatus: "NEED_CHECK" },
        { id: "stay-2", city: "도쿄", period: "전체 일정", nights: 0, hotelName: "B", bookingStatus: "NEED_CHECK" },
      ]
    );

    expect(accommodations.map((stay) => stay.nights)).toEqual([3, 3]);
  });

  it("같은 도시를 다시 방문하면 해당 index의 방문 구간 박수를 사용한다", () => {
    const accommodations = syncAccommodationNights(
      [
        { city: "도쿄", arrivalDate: "2026-12-10", departureDate: "2026-12-13" },
        { city: "하코네", arrivalDate: "2026-12-13", departureDate: "2026-12-15" },
        { city: "도쿄", arrivalDate: "2026-12-15", departureDate: "2026-12-17" },
      ],
      [
        { id: "stay-1", city: "도쿄", period: "첫 방문", nights: 0, hotelName: "A", bookingStatus: "NEED_CHECK" },
        { id: "stay-2", city: "하코네", period: "중간 방문", nights: 0, hotelName: "B", bookingStatus: "NEED_CHECK" },
        { id: "stay-3", city: "도쿄", period: "재방문", nights: 0, hotelName: "C", bookingStatus: "NEED_CHECK" },
      ]
    );

    expect(accommodations.map((stay) => stay.nights)).toEqual([3, 2, 2]);
  });
});
