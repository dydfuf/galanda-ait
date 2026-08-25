import { describe, expect, it } from "vitest";
import { PlanIdSchema } from "../domain/ids.ts";
import type { TripPlan } from "../domain/room.ts";
import { calculatePlanDifference } from "./plan-diff.ts";

const makePlan = (overrides: Partial<TripPlan> = {}): TripPlan => ({
  id: PlanIdSchema.make("plan-origin"),
  title: "원본 여행안",
  status: "DRAFT",
  places: [],
  voteCount: 0,
  baseHeadcount: 4,
  routes: [
    { city: "서울", arrivalDate: "2026-09-01", departureDate: "2026-09-03" },
    { city: "부산", arrivalDate: "2026-09-03", departureDate: "2026-09-05" },
  ],
  accommodations: [
    {
      id: "stay-seoul",
      city: "서울",
      period: "2026-09-01 ~ 2026-09-03",
      nights: 2,
      hotelName: "서울호텔",
      bookingStatus: "AVAILABLE",
      priceRange: { min: 100_000, max: 100_000 },
    },
    {
      id: "stay-busan",
      city: "부산",
      period: "2026-09-03 ~ 2026-09-05",
      nights: 2,
      hotelName: "부산호텔",
      bookingStatus: "AVAILABLE",
      priceRange: { min: 120_000, max: 120_000 },
    },
  ],
  transports: [
    {
      id: "trans-1",
      fromCity: "인천",
      toCity: "서울",
      mode: "버스",
      hasTransfer: false,
      durationText: "1시간",
      bookingStatus: "AVAILABLE",
      priceRange: { min: 20_000, max: 20_000 },
    },
    {
      id: "trans-2",
      fromCity: "서울",
      toCity: "부산",
      mode: "KTX",
      hasTransfer: false,
      durationText: "2시간",
      bookingStatus: "AVAILABLE",
      priceRange: { min: 50_000, max: 70_000 },
    },
    {
      id: "trans-3",
      fromCity: "부산",
      toCity: "인천",
      mode: "항공",
      hasTransfer: false,
      durationText: "1시간",
      bookingStatus: "AVAILABLE",
      priceRange: { min: 80_000, max: 80_000 },
    },
  ],
  ...overrides,
});

describe("calculatePlanDifference (RAON-159)", () => {
  it("도시 체류가 추가되면 routeChanges에 추가 문구를 남긴다", () => {
    const origin = makePlan();
    const result = calculatePlanDifference(origin, {
      routes: [
        ...origin.routes!,
        { city: "제주", arrivalDate: "2026-09-05", departureDate: "2026-09-07" },
      ],
    });
    expect(result.routeChanges).toContain("제주 2박 추가");
    expect(result.hasChanges).toBe(true);
    expect(result.summaryText).toContain("제주 2박 추가");
  });

  it("같은 도시의 숙박 일수가 늘어나면 +N박으로 표시한다", () => {
    const origin = makePlan();
    const result = calculatePlanDifference(origin, {
      routes: [
        { city: "서울", arrivalDate: "2026-09-01", departureDate: "2026-09-04" }, // 3박 (원본 2박)
        { city: "부산", arrivalDate: "2026-09-04", departureDate: "2026-09-06" }, // 2박 유지
      ],
    });
    expect(result.routeChanges).toContain("서울 +1박");
  });

  it("같은 도시의 숙박 일수가 줄면 -N박으로 표시한다", () => {
    const origin = makePlan();
    const result = calculatePlanDifference(origin, {
      routes: [
        { city: "서울", arrivalDate: "2026-09-01", departureDate: "2026-09-02" }, // 1박
        { city: "부산", arrivalDate: "2026-09-02", departureDate: "2026-09-05" }, // 3박 (증가)
      ],
    });
    expect(result.routeChanges).toContain("서울 -1박");
    expect(result.routeChanges).toContain("부산 +1박");
  });

  it("원본에 있던 도시가 빠지면 제외 문구를 남긴다", () => {
    const origin = makePlan();
    const result = calculatePlanDifference(origin, {
      routes: [{ city: "서울", arrivalDate: "2026-09-01", departureDate: "2026-09-03" }],
    });
    expect(result.routeChanges).toContain("부산 제외");
    expect(result.hasChanges).toBe(true);
  });

  it("숙소가 추가/삭제되면 isAccommodationChanged가 true이고 route 변경 없을 때 summary에 '숙소 변경'이 포함된다", () => {
    const origin = makePlan();
    const added = calculatePlanDifference(origin, {
      routes: origin.routes,
      accommodations: [
        ...origin.accommodations!,
        {
          id: "stay-jeju",
          city: "제주",
          period: "2026-09-05 ~ 2026-09-07",
          nights: 2,
          hotelName: "제주호텔",
          bookingStatus: "AVAILABLE",
          priceRange: { min: 90_000, max: 90_000 },
        },
      ],
      transports: origin.transports,
    });
    expect(added.isAccommodationChanged).toBe(true);
    expect(added.routeChanges).toHaveLength(0);
    expect(added.summaryText).toContain("숙소 변경");

    const removed = calculatePlanDifference(origin, {
      routes: origin.routes,
      accommodations: [origin.accommodations![0]!],
      transports: origin.transports,
    });
    expect(removed.isAccommodationChanged).toBe(true);
  });

  it("숙소 호텔명이나 가격 범위가 바뀌면 숙소 변경으로 감지한다", () => {
    const origin = makePlan();
    const changedName = calculatePlanDifference(origin, {
      routes: origin.routes,
      accommodations: origin.accommodations!.map((a, i) => (i === 0 ? { ...a, hotelName: "다른호텔" } : a)),
      transports: origin.transports,
    });
    expect(changedName.isAccommodationChanged).toBe(true);

    const changedPrice = calculatePlanDifference(origin, {
      routes: origin.routes,
      accommodations: origin.accommodations!.map((a, i) => (i === 0 ? { ...a, priceRange: { min: 200_000, max: 250_000 } } : a)),
      transports: origin.transports,
    });
    expect(changedPrice.isAccommodationChanged).toBe(true);
  });

  it("교통이 추가/삭제되면 isTransportChanged가 true이고 route/숙소 변경 없을 때 summary에 '교통편 변경'이 포함된다", () => {
    const origin = makePlan();
    const added = calculatePlanDifference(origin, {
      routes: origin.routes,
      accommodations: origin.accommodations,
      transports: [...origin.transports!, origin.transports![0]!],
    });
    expect(added.isTransportChanged).toBe(true);
    expect(added.summaryText).toContain("교통편 변경");
  });

  it("교통 수단이나 환승·가격이 바뀌면 교통 변경으로 감지한다", () => {
    const origin = makePlan();
    const modeChanged = calculatePlanDifference(origin, {
      routes: origin.routes,
      accommodations: origin.accommodations,
      transports: origin.transports!.map((t, i) => (i === 1 ? { ...t, mode: "버스" } : t)),
    });
    expect(modeChanged.isTransportChanged).toBe(true);

    const transferChanged = calculatePlanDifference(origin, {
      routes: origin.routes,
      accommodations: origin.accommodations,
      transports: origin.transports!.map((t, i) => (i === 0 ? { ...t, hasTransfer: true } : t)),
    });
    expect(transferChanged.isTransportChanged).toBe(true);
  });

  it("제목이 바뀌면 summary에 '제목 변경'이 포함된다", () => {
    const origin = makePlan();
    const result = calculatePlanDifference(origin, {
      title: "새로운 제목",
      routes: origin.routes,
      accommodations: origin.accommodations,
      transports: origin.transports,
    });
    expect(result.summaryText).toContain("제목 변경");
    expect(result.hasChanges).toBe(true);
  });

  it("비용 차이가 없으면 costDifferenceText는 undefined이다", () => {
    const origin = makePlan();
    const result = calculatePlanDifference(origin, {
      title: origin.title,
      routes: origin.routes,
      accommodations: origin.accommodations,
      transports: origin.transports,
    });
    expect(result.costDifferenceText).toBeUndefined();
    expect(result.hasChanges).toBe(false);
  });

  it("그룹 총액이 동일하게 증가하면 단일 금액 차이 문구를 만든다", () => {
    const origin = makePlan();
    // 원본 총액: 100k+120k+20k+50k+80k = 370k min / 390k max (50~70 차이)
    // 현재: 서울호텔 150k로 변경 (+50k 고정) => min 420k / max 440k => diff +50k 동일
    const result = calculatePlanDifference(origin, {
      routes: origin.routes,
      accommodations: origin.accommodations!.map((a, i) => (i === 0 ? { ...a, priceRange: { min: 150_000, max: 150_000 } } : a)),
      transports: origin.transports,
    });
    expect(result.costDifferenceText).toBe("그룹 총액 +5만원");
    expect(result.summaryText).toContain("그룹 총액");
  });

  it("비용 범위가 다르게 증가하면 min~max 차이 문구를 만든다", () => {
    const origin = makePlan();
    // KTX 가격 범위를 50~70 -> 60~100으로 바꾸면 min +10k, max +30k
    const result = calculatePlanDifference(origin, {
      routes: origin.routes,
      accommodations: origin.accommodations,
      transports: origin.transports!.map((t, i) => (i === 1 ? { ...t, priceRange: { min: 60_000, max: 100_000 } } : t)),
    });
    expect(result.costDifferenceText).toContain("그룹 총액");
    expect(result.costDifferenceText).toContain("~");
  });

  it("가격이 감소하면 음수 부호를 포함한다", () => {
    const origin = makePlan();
    const result = calculatePlanDifference(origin, {
      routes: origin.routes,
      accommodations: origin.accommodations!.map((a, i) => (i === 0 ? { ...a, priceRange: { min: 50_000, max: 50_000 } } : a)),
      transports: origin.transports,
    });
    expect(result.costDifferenceText).toMatch(/그룹 총액 -/);
  });

  it("원본 또는 현재 가격 정보가 없으면 costDifferenceText를 만들지 않는다", () => {
    const origin = makePlan({
      accommodations: [
        { id: "stay-x", city: "서울", period: "2026-09-01 ~ 2026-09-03", nights: 2, hotelName: "", isSearching: true, bookingStatus: "NOT_CHECKED" },
      ],
      transports: [],
    });
    const result = calculatePlanDifference(origin, {
      routes: origin.routes,
      accommodations: origin.accommodations,
      transports: [],
    });
    expect(result.costDifferenceText).toBeUndefined();
  });

  it("변경이 전혀 없으면 hasChanges는 false이고 summary는 고정 문구이다", () => {
    const origin = makePlan();
    const result = calculatePlanDifference(origin, {
      title: origin.title,
      routes: origin.routes,
      accommodations: origin.accommodations,
      transports: origin.transports,
      baseHeadcount: origin.baseHeadcount,
    });
    expect(result.hasChanges).toBe(false);
    expect(result.routeChanges).toHaveLength(0);
    expect(result.isAccommodationChanged).toBe(false);
    expect(result.isTransportChanged).toBe(false);
    expect(result.costDifferenceText).toBeUndefined();
    expect(result.summaryText).toBe("원본 여행안과 동일한 구성");
  });

  it("빈 입력(모든 필드 미제공)도 원본과 동일하면 변경 없음으로 처리한다", () => {
    const origin = makePlan({
      routes: [],
      accommodations: [],
      transports: [],
    });
    const resultWithEmpty = calculatePlanDifference(origin, {
      title: origin.title,
      routes: [],
      accommodations: [],
      transports: [],
    });
    // 원본 routes/accommodations/transports가 빈 배열이면 current undefined는 []로 간주되어 동일
    expect(resultWithEmpty.hasChanges).toBe(false);
    expect(resultWithEmpty.summaryText).toBe("원본 여행안과 동일한 구성");
  });

  it("날짜 관련 변경은 routeChanges로 반영되고 summaryText는 안정적으로 join된다", () => {
    const origin = makePlan();
    const result = calculatePlanDifference(origin, {
      title: "새 제목",
      routes: [
        { city: "서울", arrivalDate: "2026-09-01", departureDate: "2026-09-04" },
        { city: "부산", arrivalDate: "2026-09-04", departureDate: "2026-09-05" },
      ],
      accommodations: origin.accommodations,
      transports: origin.transports,
    });
    // routeChanges가 있으면 숙소/교통 변경 문구는 summary에 추가되지 않음 (우선순위)
    expect(result.routeChanges.length).toBeGreaterThan(0);
    expect(result.summaryText).not.toContain("숙소 변경");
    expect(result.summaryText).toContain("제목 변경");
    expect(result.summaryText.split(" · ")).toEqual(expect.arrayContaining([...result.routeChanges]));
  });
});
