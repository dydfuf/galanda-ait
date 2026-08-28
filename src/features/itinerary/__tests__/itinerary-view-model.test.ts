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
    expect(viewModel.sections.map(({ items }) => items.length)).toEqual([
      2, 2, 1,
    ]);
    expect(viewModel.sections[1]?.dateHeader).toBe("12월 13일");
    expect(
      viewModel.sections.flatMap(({ items }) => items.map(({ id }) => id)),
    ).toEqual([
      "flight-out",
      "stay-tokyo",
      "train",
      "stay-hakone",
      "flight-back",
    ]);
    expect(viewModel.sections[0]?.items[0]).toMatchObject({
      id: "flight-out",
      statusLabel: "예매 가능",
      statusTone: "success",
      priceText: "가격 미정",
    });
    expect(viewModel.needCheckCount).toBe(3);
    expect(viewModel.hasNeedCheckDanger).toBe(true);
    expect(
      viewModel.needCheckItems.map(({ statusTone }) => statusTone),
    ).toEqual(["warning", "danger", "neutral"]);
  });

  it("source 순서와 identity를 유지하고 누락된 값만 명시적인 미정 문구로 표현한다", () => {
    const sourceItems = [
      itinerary.snapshot.items[2]!,
      itinerary.snapshot.items[0]!,
      itinerary.snapshot.items[3]!,
      itinerary.snapshot.items[1]!,
      itinerary.snapshot.items[4]!,
    ];
    const reordered: ConfirmedItineraryResponse = {
      ...itinerary,
      snapshot: {
        ...itinerary.snapshot,
        planTitle: "",
        destination: "",
        routes: [
          {
            ...itinerary.snapshot.routes[0]!,
            city: "",
          },
          itinerary.snapshot.routes[1]!,
        ],
        items: sourceItems.map((item) => {
          if (item.type === "STAY" && item.accommodation.id === "stay-hakone") {
            return {
              ...item,
              memo: "긴 메모 ".repeat(80),
              accommodation: {
                ...item.accommodation,
                city: "",
                hotelName: "",
                period: "",
              },
            };
          }
          if (
            item.type === "TRANSPORT" &&
            item.transport.id === "flight-back"
          ) {
            return {
              ...item,
              transport: {
                ...item.transport,
                fromCity: "",
                toCity: "",
                mode: "",
                durationText: "",
              },
            };
          }
          return item;
        }),
      },
    };

    const viewModel = toItineraryViewModel(reordered);
    const projectedItems = viewModel.sections.flatMap(({ items }) => items);

    expect(viewModel.sections.map(({ dateStr }) => dateStr)).toEqual([
      "2026-12-13",
      "2026-12-10",
      "2026-12-13",
      "2026-12-10",
      "2026-12-15",
    ]);
    expect(projectedItems.map(({ id }) => id)).toEqual([
      "train",
      "flight-out",
      "stay-hakone",
      "stay-tokyo",
      "flight-back",
    ]);
    expect(new Set(viewModel.sections.map(({ id }) => id)).size).toBe(5);
    expect(viewModel.confirmedPlanTitle).toBe("확정 여행안 제목 미정");
    expect(viewModel.destination).toBe("여행지 미정");
    expect(viewModel.route[0]?.city).toBe("도시 미정");
    expect(projectedItems[2]).toMatchObject({
      id: "stay-hakone",
      city: "도시 미정",
      hotelName: "숙소 이름 미정",
      period: "숙박 기간 미정",
      priceText: "가격 미정",
      memo: "긴 메모 ".repeat(80),
    });
    expect(projectedItems[4]).toMatchObject({
      id: "flight-back",
      fromCity: "출발지 미정",
      toCity: "도착지 미정",
      routeTitle: "출발지 미정 → 도착지 미정",
      mode: "이동 수단 미정",
      durationText: "소요 시간 미정",
      priceText: "가격 미정",
    });
  });
});
