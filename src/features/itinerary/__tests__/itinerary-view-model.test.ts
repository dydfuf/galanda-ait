import { describe, expect, it } from "vitest";
import {
  PlanIdSchema,
  RevisionSchema,
  TripIdSchema,
  UserIdSchema,
} from "../../../core/domain/ids.ts";
import type { TripRoom } from "../../../core/domain/room.ts";
import {
  formatDotDate,
  formatKoreanDate,
  formatPeriodText,
  parseYMD,
  toItineraryViewModel,
} from "../itinerary-view-model.ts";

const baseRoom: TripRoom = {
  id: TripIdSchema.make("trip-1"),
  title: "도쿄 + 하코네 여행",
  destination: "도쿄 + 하코네",
  revision: RevisionSchema.make(1),
  members: [
    { id: UserIdSchema.make("user-1"), name: "호스트", role: "HOST" },
    { id: UserIdSchema.make("user-2"), name: "멤버", role: "MEMBER" },
  ],
  plans: [
    {
      id: PlanIdSchema.make("plan-confirmed-1"),
      title: "도쿄 + 하코네 6박 7일",
      status: "CONFIRMED",
      authorId: UserIdSchema.make("user-1"),
      authorName: "호스트",
      baseHeadcount: 2,
      routes: [
        { city: "도쿄", arrivalDate: "2026-12-10", departureDate: "2026-12-13" },
        { city: "하코네", arrivalDate: "2026-12-13", departureDate: "2026-12-15" },
        { city: "도쿄", arrivalDate: "2026-12-15", departureDate: "2026-12-16" },
      ],
      accommodations: [
        {
          id: "acc-1",
          city: "도쿄",
          period: "12.10 ~ 12.13",
          nights: 3,
          hotelName: "호텔 그레이서리",
          bookingStatus: "AVAILABLE",
          priceRange: { min: 600000, max: 600000 },
          confirmedBy: "호스트",
          confirmedAt: "2026-12-01",
        },
        {
          id: "acc-2",
          city: "하코네",
          period: "12.13 ~ 12.15",
          nights: 2,
          hotelName: "하코네 료칸",
          bookingStatus: "NEED_CHECK",
          priceRange: { min: 800000, max: 900000 },
          confirmedBy: "호스트",
          confirmedAt: "2026-12-01",
        },
        {
          id: "acc-3",
          city: "도쿄",
          period: "12.15 ~ 12.16",
          nights: 1,
          hotelName: "신주쿠 워싱턴 호텔",
          bookingStatus: "AVAILABLE",
          priceRange: { min: 200000, max: 200000 },
          confirmedBy: "호스트",
          confirmedAt: "2026-12-01",
        },
      ],
      transports: [
        {
          id: "trans-1",
          fromCity: "도쿄",
          toCity: "하코네",
          mode: "로망스카",
          hasTransfer: false,
          durationText: "1시간 30분",
          bookingStatus: "NEED_CHECK",
          priceRange: { min: 50000, max: 50000 },
          confirmedBy: "호스트",
          confirmedAt: "2026-12-01",
        },
        {
          id: "trans-2",
          fromCity: "하코네",
          toCity: "도쿄",
          mode: "신칸센",
          hasTransfer: false,
          durationText: "40분",
          bookingStatus: "AVAILABLE",
          priceRange: { min: 70000, max: 70000 },
          confirmedBy: "호스트",
          confirmedAt: "2026-12-01",
        },
      ],
      places: [],
      voteCount: 2,
    },
  ],
  confirmedPlanId: PlanIdSchema.make("plan-confirmed-1"),
};

describe("itinerary-view-model date helper functions", () => {
  it("parseYMD correctly parses various date formats", () => {
    expect(parseYMD("2026-12-10")).toEqual({ year: 2026, month: 12, day: 10 });
    expect(parseYMD("2026.09.01")).toEqual({ year: 2026, month: 9, day: 1 });
    expect(parseYMD("2026/01/05")).toEqual({ year: 2026, month: 1, day: 5 });
    expect(parseYMD(undefined)).toBeNull();
    expect(parseYMD("invalid-date")).toBeNull();
  });

  it("formatKoreanDate and formatDotDate format properly", () => {
    expect(formatKoreanDate({ year: 2026, month: 12, day: 10 })).toBe("12월 10일");
    expect(formatDotDate({ year: 2026, month: 12, day: 10 })).toBe("12.10");
    expect(formatDotDate({ year: 2026, month: 12, day: 10 }, true)).toBe("2026.12.10");
  });

  it("formatPeriodText formats same year and cross-year periods", () => {
    expect(formatPeriodText("2026-12-10", "2026-12-16")).toBe("12.10 ~ 12.16");
    expect(formatPeriodText("2026-12-30", "2027-01-05")).toBe("2026.12.30 ~ 2027.1.5");
    expect(formatPeriodText(undefined, undefined)).toBe("일정 미정");
  });
});

describe("toItineraryViewModel (RAON-167)", () => {
  it("확정되지 않은 방에서는 empty state view model을 반환한다", () => {
    const unconfirmedRoom: TripRoom = {
      ...baseRoom,
      confirmedPlanId: undefined,
    };
    const vm = toItineraryViewModel(unconfirmedRoom);

    expect(vm.isConfirmed).toBe(false);
    expect(vm.confirmedPlanId).toBeUndefined();
    expect(vm.sections).toHaveLength(0);
    expect(vm.needCheckCount).toBe(0);
  });

  it("7일 이상 일정에서 날짜별 section과 ListRow item을 올바르게 구성한다", () => {
    const vm = toItineraryViewModel(baseRoom);

    expect(vm.isConfirmed).toBe(true);
    expect(vm.confirmedPlanTitle).toBe("도쿄 + 하코네 6박 7일");
    expect(vm.periodText).toBe("12.10 ~ 12.16");
    expect(vm.nights).toBe(6);
    expect(vm.days).toBe(7);

    expect(vm.sections).toHaveLength(5);

    expect(vm.sections[0]?.dateHeader).toBe("12월 10일 · 도쿄");
    expect(vm.sections[0]?.items[0]?.type).toBe("STAY");
    expect(vm.sections[0]?.items[0]?.statusLabel).toBe("예약 완료");
    expect(vm.sections[0]?.items[0]?.subText).toBe("3박 · 예약 완료");

    expect(vm.sections[1]?.dateHeader).toBe("12월 13일 · 하코네");
    expect(vm.sections[1]?.items[0]?.type).toBe("STAY");
    expect(vm.sections[1]?.items[0]?.statusLabel).toBe("확인 필요");
    expect(vm.sections[1]?.items[0]?.subText).toBe("2박 · 확인 필요");

    expect(vm.sections[2]?.dateHeader).toBe("12월 15일 · 도쿄");
    expect(vm.sections[2]?.items[0]?.type).toBe("STAY");
    expect(vm.sections[2]?.items[0]?.statusLabel).toBe("예약 완료");

    expect(vm.sections[3]?.dateHeader).toBe("이동");
    expect(vm.sections[3]?.items[0]?.type).toBe("TRANSPORT");
    expect(vm.sections[3]?.items[0]?.statusLabel).toBe("확인 필요");
    expect(vm.sections[3]?.dateStr).toBeUndefined();

    expect(vm.sections[4]?.dateHeader).toBe("이동");
    expect(vm.sections[4]?.items[0]?.type).toBe("TRANSPORT");
    expect(vm.sections[4]?.items[0]?.statusLabel).toBe("예매 가능");
  });

  it("명시적 날짜가 없는 교통편에는 날짜를 추론하지 않는다", () => {
    const roomWithInboundOutbound: TripRoom = {
      ...baseRoom,
      plans: [
        {
          ...baseRoom.plans[0],
          transports: [
            {
              id: "trans-inbound",
              fromCity: "서울",
              toCity: "도쿄",
              mode: "비행기",
              hasTransfer: false,
              durationText: "2시간 30분",
              bookingStatus: "AVAILABLE",
            },
            {
              id: "trans-inter",
              fromCity: "도쿄",
              toCity: "하코네",
              mode: "로망스카",
              hasTransfer: false,
              durationText: "1시간 30분",
              bookingStatus: "NEED_CHECK",
            },
            {
              id: "trans-outbound",
              fromCity: "하코네",
              toCity: "서울",
              mode: "비행기",
              hasTransfer: false,
              durationText: "3시간",
              bookingStatus: "AVAILABLE",
            },
          ],
          accommodations: [
            {
              id: "acc-1",
              city: "도쿄",
              period: "12.10 ~ 12.13",
              nights: 3,
              hotelName: "호텔 그레이서리",
              bookingStatus: "AVAILABLE",
            },
            {
              id: "acc-2",
              city: "하코네",
              period: "12.13 ~ 12.15",
              nights: 2,
              hotelName: "하코네 료칸",
              bookingStatus: "AVAILABLE",
            },
          ],
        },
      ],
    };

    const vm = toItineraryViewModel(roomWithInboundOutbound);
    expect(vm.sections).toHaveLength(5);

    const transports = vm.sections.filter((section) => section.items[0]?.type === "TRANSPORT");
    expect(transports.map((section) => section.dateHeader)).toEqual(["이동", "이동", "이동"]);
    expect(transports.map((section) => section.dateStr)).toEqual([undefined, undefined, undefined]);
    expect((transports[0]?.items[0] as { routeTitle: string })?.routeTitle).toBe("서울 → 도쿄");
    expect((transports[2]?.items[0] as { routeTitle: string })?.routeTitle).toBe("하코네 → 서울");
  });

  it("교통편만 있는 경우 존재하지 않는 날짜를 생성하지 않는다", () => {
    const transportsOnlyRoom: TripRoom = {
      ...baseRoom,
      plans: [
        {
          ...baseRoom.plans[0],
          accommodations: [],
          transports: [
            {
              id: "trans-1",
              fromCity: "서울",
              toCity: "부산",
              mode: "KTX",
              hasTransfer: false,
              durationText: "2시간 30분",
              bookingStatus: "AVAILABLE",
            },
            {
              id: "trans-2",
              fromCity: "부산",
              toCity: "서울",
              mode: "KTX",
              hasTransfer: false,
              durationText: "2시간 30분",
              bookingStatus: "AVAILABLE",
            },
          ],
        },
      ],
    };

    const vm = toItineraryViewModel(transportsOnlyRoom);
    expect(vm.sections).toHaveLength(2);
    expect(vm.sections[0]?.dateHeader).toBe("이동");
    expect(vm.sections[1]?.dateHeader).toBe("이동");
    expect(vm.sections.every((section) => section.dateStr === undefined)).toBe(true);
  });

  it("3일 일정 (2박 3일, 숙소 연속 및 이동 혼합)을 올바르게 처리한다", () => {
    const threeDaysRoom: TripRoom = {
      ...baseRoom,
      plans: [
        {
          ...baseRoom.plans[0],
          title: "제주 2박 3일 힐링",
          routes: [
            { city: "제주시", arrivalDate: "2026-08-10", departureDate: "2026-08-11" },
            { city: "서귀포", arrivalDate: "2026-08-11", departureDate: "2026-08-12" },
          ],
          accommodations: [
            {
              id: "acc-jeju-1",
              city: "제주시",
              period: "08.10 ~ 08.11",
              nights: 1,
              hotelName: "메종 글래드 제주",
              bookingStatus: "AVAILABLE",
            },
            {
              id: "acc-jeju-2",
              city: "서귀포",
              period: "08.11 ~ 08.12",
              nights: 1,
              hotelName: "해비치 호텔",
              bookingStatus: "AVAILABLE",
            },
          ],
          transports: [
            {
              id: "trans-jeju-1",
              fromCity: "제주시",
              toCity: "서귀포",
              mode: "렌터카",
              hasTransfer: false,
              durationText: "50분",
              bookingStatus: "AVAILABLE",
            },
          ],
        },
      ],
    };

    const vm = toItineraryViewModel(threeDaysRoom);
    expect(vm.periodText).toBe("8.10 ~ 8.12");
    expect(vm.sections).toHaveLength(3);
    expect(vm.sections[0]?.dateHeader).toBe("8월 10일 · 제주시");
    expect(vm.sections[1]?.dateHeader).toBe("8월 11일 · 서귀포");
    expect(vm.sections[2]?.dateHeader).toBe("이동");
  });

  it("확인 필요 예약 항목(2건)을 정확히 집계한다", () => {
    const vm = toItineraryViewModel(baseRoom);

    expect(vm.needCheckCount).toBe(2);
    expect(vm.hasNeedCheckDanger).toBe(false); // NEED_CHECK only, no FULL
    expect(vm.needCheckItems).toHaveLength(2);
    expect(vm.needCheckItems[0]?.message).toContain("하코네 숙소(하코네 료칸)");
    expect(vm.needCheckItems[1]?.message).toContain("도쿄 → 하코네");
  });

  it("만실(FULL) 상태의 항목이 있으면 hasNeedCheckDanger가 true가 된다", () => {
    const roomWithFull: TripRoom = {
      ...baseRoom,
      plans: [
        {
          ...baseRoom.plans[0],
          accommodations: [
            {
              ...baseRoom.plans[0].accommodations![0],
              bookingStatus: "FULL",
            },
          ],
          transports: [],
        },
      ],
    };

    const vm = toItineraryViewModel(roomWithFull);
    expect(vm.needCheckCount).toBe(1);
    expect(vm.hasNeedCheckDanger).toBe(true);
    expect(vm.needCheckItems[0]?.statusColor).toBe("red");
    expect(vm.needCheckItems[0]?.statusLabel).toBe("만실");
  });

  it("NOT_CHECKED 또는 isSearching 숙소/교통을 '확인 전'으로 집계한다", () => {
    const roomWithSearching: TripRoom = {
      ...baseRoom,
      plans: [
        {
          ...baseRoom.plans[0],
          accommodations: [
            {
              ...baseRoom.plans[0].accommodations![0],
              bookingStatus: "NOT_CHECKED",
              isSearching: true,
            },
          ],
          transports: [
            {
              ...baseRoom.plans[0].transports![0],
              bookingStatus: "NOT_CHECKED",
            },
          ],
        },
      ],
    };

    const vm = toItineraryViewModel(roomWithSearching);
    expect(vm.needCheckCount).toBe(2);
    expect(vm.needCheckItems[0]?.status).toBe("SEARCHING");
    expect(vm.needCheckItems[0]?.statusLabel).toBe("확인 전");
    expect(vm.needCheckItems[0]?.statusColor).toBe("elephant");
    expect(vm.needCheckItems[1]?.status).toBe("SEARCHING");
    expect(vm.needCheckItems[1]?.statusLabel).toBe("확인 전");
  });

  it("확인 필요 항목이 0건일 때 needCheckCount가 0이 된다", () => {
    const allAvailableRoom: TripRoom = {
      ...baseRoom,
      plans: [
        {
          ...baseRoom.plans[0],
          accommodations: [
            {
              ...baseRoom.plans[0].accommodations![0],
              bookingStatus: "AVAILABLE",
            },
          ],
          transports: [
            {
              ...baseRoom.plans[0].transports![1],
              bookingStatus: "AVAILABLE",
            },
          ],
        },
      ],
    };

    const vm = toItineraryViewModel(allAvailableRoom);
    expect(vm.needCheckCount).toBe(0);
    expect(vm.hasNeedCheckDanger).toBe(false);
    expect(vm.needCheckItems).toHaveLength(0);
  });

  it("1일 일정 (당일치기 또는 1박 2일)에서도 날짜 헤더를 정상 계산한다", () => {
    const singleDayRoom: TripRoom = {
      ...baseRoom,
      plans: [
        {
          ...baseRoom.plans[0],
          routes: [{ city: "강릉", arrivalDate: "2026-05-01", departureDate: "2026-05-02" }],
          accommodations: [
            {
              id: "acc-single",
              city: "강릉",
              period: "05.01 ~ 05.02",
              nights: 1,
              hotelName: "씨마크 호텔",
              bookingStatus: "AVAILABLE",
            },
          ],
          transports: [],
        },
      ],
    };

    const vm = toItineraryViewModel(singleDayRoom);
    expect(vm.periodText).toBe("5.1 ~ 5.2");
    expect(vm.sections).toHaveLength(1);
    expect(vm.sections[0]?.dateHeader).toBe("5월 1일 · 강릉");
  });

  it("경로 날짜가 없는 경우 Day나 날짜를 임의 생성하지 않는다", () => {
    const noDateRoom: TripRoom = {
      ...baseRoom,
      plans: [
        {
          ...baseRoom.plans[0],
          routes: undefined,
        },
      ],
    };

    const vm = toItineraryViewModel(noDateRoom);
    expect(vm.periodText).toBe("일정 미정");
    expect(vm.nights).toBe(0);
    expect(vm.days).toBe(0);
    expect(vm.route).toEqual([]);
    expect(vm.sections.every((section) => section.dateStr === undefined)).toBe(true);
    expect(vm.sections.map((section) => section.dateHeader)).toEqual([
      "도쿄",
      "하코네",
      "도쿄",
      "이동",
      "이동",
    ]);
  });

  it("routes가 없고 places만 있어도 route를 만들지 않는다", () => {
    const placesOnlyRoom: TripRoom = {
      ...baseRoom,
      plans: [
        {
          ...baseRoom.plans[0],
          routes: undefined,
          places: [
            { id: "p1", name: "오사카 도톤보리", category: "명소", address: "오사카" },
            { id: "p2", name: "교토 청수사", category: "명소", address: "교토" },
          ],
          accommodations: [],
          transports: [],
        },
      ],
    };

    const vm = toItineraryViewModel(placesOnlyRoom);
    expect(vm.route).toEqual([]);
    expect(vm.nights).toBe(0);
    expect(vm.days).toBe(0);
  });
});
