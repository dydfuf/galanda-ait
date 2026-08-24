import { describe, expect, it } from "vitest";
import { PlanIdSchema, RevisionSchema } from "../ids.ts";
import type { TripPlan } from "../room.ts";
import { buildConfirmedItinerarySnapshot } from "../confirmed-itinerary.ts";

describe("buildConfirmedItinerarySnapshot", () => {
  it("다도시 여행안을 날짜가 명시된 독립 snapshot으로 복사한다", () => {
    const routes = [
      { city: "도쿄", arrivalDate: "2026-10-01", departureDate: "2026-10-03" },
      { city: "교토", arrivalDate: "2026-10-04", departureDate: "2026-10-06" },
    ];
    const accommodations = [
      { id: "a", city: "도쿄", period: "2박", nights: 2, hotelName: "A", bookingStatus: "AVAILABLE" as const },
      { id: "b", city: "교토", period: "2박", nights: 2, hotelName: "B", bookingStatus: "AVAILABLE" as const },
    ];
    const plan: TripPlan = {
      id: PlanIdSchema.make("plan-1"),
      title: "다도시",
      status: "VOTING",
      revision: RevisionSchema.make(2),
      baseHeadcount: 2,
      routes,
      accommodations,
      transports: [
        { id: "out", fromCity: "서울", toCity: "도쿄", mode: "항공", hasTransfer: false, durationText: "", bookingStatus: "AVAILABLE" },
        { id: "between", fromCity: "도쿄", toCity: "교토", mode: "열차", hasTransfer: false, durationText: "", bookingStatus: "AVAILABLE" },
        { id: "back", fromCity: "교토", toCity: "서울", mode: "항공", hasTransfer: false, durationText: "", bookingStatus: "AVAILABLE" },
      ],
      places: [],
      voteCount: 0,
    };

    const snapshot = buildConfirmedItinerarySnapshot(plan, "일본")!;
    routes[0] = { ...routes[0]!, city: "변경됨" };
    accommodations[0] = { ...accommodations[0]!, hotelName: "변경됨" };

    expect(snapshot.routes[0]?.city).toBe("도쿄");
    expect(snapshot.items.map(({ date }) => date)).toEqual([
      "2026-10-01",
      "2026-10-01",
      "2026-10-04",
      "2026-10-04",
      "2026-10-06",
    ]);
    expect(snapshot.items[1]?.type === "STAY" && snapshot.items[1].accommodation.hotelName).toBe("A");
  });
});
