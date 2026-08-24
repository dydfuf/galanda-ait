import { describe, expect, it } from "vitest";
import {
  ItineraryIdSchema,
  ParticipantIdSchema,
  PlanIdSchema,
  RevisionSchema,
  TripIdSchema,
} from "../../../core/domain/ids.ts";
import type { ConfirmedItineraryResponse } from "../../../contracts/itinerary.ts";
import {
  formatPeriodText,
  parseYMD,
  toItineraryViewModel,
} from "../itinerary-view-model.ts";

const itinerary: ConfirmedItineraryResponse = {
  id: ItineraryIdSchema.make("itinerary-1"),
  tripId: TripIdSchema.make("trip-1"),
  sourcePlanId: PlanIdSchema.make("plan-1"),
  sourcePlanRevision: RevisionSchema.make(3),
  currentRevision: RevisionSchema.make(1),
  createdBy: ParticipantIdSchema.make("host-1"),
  createdAt: "2026-08-24T00:00:00.000Z",
  snapshot: {
    planTitle: "도쿄와 하코네",
    destination: "일본",
    routes: [
      { city: "도쿄", arrivalDate: "2026-12-10", departureDate: "2026-12-13" },
      { city: "하코네", arrivalDate: "2026-12-13", departureDate: "2026-12-15" },
    ],
    items: [
      {
        type: "TRANSPORT",
        date: "2026-12-10",
        transport: {
          id: "flight-out",
          fromCity: "서울",
          toCity: "도쿄",
          mode: "항공",
          hasTransfer: false,
          durationText: "2시간",
          bookingStatus: "AVAILABLE",
        },
      },
      {
        type: "STAY",
        date: "2026-12-10",
        endDate: "2026-12-13",
        accommodation: {
          id: "stay-tokyo",
          city: "도쿄",
          period: "12.10 ~ 12.13",
          nights: 3,
          hotelName: "도쿄 호텔",
          bookingStatus: "AVAILABLE",
        },
      },
      {
        type: "TRANSPORT",
        date: "2026-12-13",
        transport: {
          id: "train",
          fromCity: "도쿄",
          toCity: "하코네",
          mode: "열차",
          hasTransfer: false,
          durationText: "1시간 30분",
          bookingStatus: "NEED_CHECK",
        },
      },
      {
        type: "STAY",
        date: "2026-12-13",
        endDate: "2026-12-15",
        accommodation: {
          id: "stay-hakone",
          city: "하코네",
          period: "12.13 ~ 12.15",
          nights: 2,
          hotelName: "하코네 료칸",
          bookingStatus: "FULL",
        },
      },
      {
        type: "TRANSPORT",
        date: "2026-12-15",
        transport: {
          id: "flight-back",
          fromCity: "하코네",
          toCity: "서울",
          mode: "항공",
          hasTransfer: true,
          durationText: "5시간",
          bookingStatus: "NOT_CHECKED",
        },
      },
    ],
  },
};

describe("itinerary view model", () => {
  it("날짜를 엄격히 해석하고 연도 경계를 표시한다", () => {
    expect(parseYMD("2026-12-10")).toEqual({ year: 2026, month: 12, day: 10 });
    expect(parseYMD("2026.12.10")).toBeNull();
    expect(parseYMD("2026-02-30")).toBeNull();
    expect(formatPeriodText("2026-12-30", "2027-01-05")).toBe(
      "2026.12.30 ~ 2027.1.5"
    );
  });

  it("snapshot 항목을 실제 달력 날짜별로 묶고 확인 필요 상태를 보존한다", () => {
    const viewModel = toItineraryViewModel(itinerary);

    expect(viewModel.periodText).toBe("12.10 ~ 12.15");
    expect(viewModel.nights).toBe(5);
    expect(viewModel.sections.map(({ dateStr }) => dateStr)).toEqual([
      "2026-12-10",
      "2026-12-13",
      "2026-12-15",
    ]);
    expect(viewModel.sections.map(({ items }) => items.length)).toEqual([2, 2, 1]);
    expect(viewModel.sections[1]?.dateHeader).toBe("12월 13일");
    expect(viewModel.needCheckCount).toBe(3);
    expect(viewModel.hasNeedCheckDanger).toBe(true);
  });
});
