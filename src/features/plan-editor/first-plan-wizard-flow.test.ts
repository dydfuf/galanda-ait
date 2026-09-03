import { describe, expect, it } from "vitest";
import {
  getNextWizardCursor,
  getPreviousWizardCursor,
  getWizardQuestionSequence,
  getWizardSubStepProgress,
  isFirstPlanWizardQuestion,
  isFirstPlanWizardSection,
  mapValidationErrorToCursor,
  normalizeWizardCursor,
  parseWizardCursor,
  serializeWizardCursor,
  type FirstPlanWizardCursor,
} from "./first-plan-wizard-flow.ts";
import type { PlanEditorFormData } from "./hooks/usePlanEditorState.ts";

const createMockFormData = (overrides: Partial<PlanEditorFormData> = {}): PlanEditorFormData => ({
  title: "도쿄 3박 4일",
  proposalReason: "여유로운 여행",
  baseHeadcount: 2,
  routes: [
    { city: "도쿄", arrivalDate: "2026-10-01", departureDate: "2026-10-04" },
  ],
  accommodations: [
    {
      id: "acc-1",
      city: "도쿄",
      period: "2026-10-01 ~ 2026-10-04",
      nights: 3,
      hotelName: "신주쿠 호텔",
      isSearching: false,
      bookingStatus: "AVAILABLE",
    },
  ],
  transports: [
    {
      id: "tr-1",
      fromCity: "인천",
      toCity: "도쿄",
      mode: "항공",
      hasTransfer: false,
      durationText: "2시간 30분",
      bookingStatus: "AVAILABLE",
    },
    {
      id: "tr-2",
      fromCity: "도쿄",
      toCity: "인천",
      mode: "항공",
      hasTransfer: false,
      durationText: "2시간 30분",
      bookingStatus: "AVAILABLE",
    },
  ],
  ...overrides,
});

describe("Type Guards", () => {
  it("validates FirstPlanWizardSection values", () => {
    expect(isFirstPlanWizardSection("basic")).toBe(true);
    expect(isFirstPlanWizardSection("route")).toBe(true);
    expect(isFirstPlanWizardSection("accommodation")).toBe(true);
    expect(isFirstPlanWizardSection("transport")).toBe(true);
    expect(isFirstPlanWizardSection("review")).toBe(true);
    expect(isFirstPlanWizardSection("invalid")).toBe(false);
    expect(isFirstPlanWizardSection(null)).toBe(false);
    expect(isFirstPlanWizardSection(123)).toBe(false);
  });

  it("validates FirstPlanWizardQuestion values", () => {
    expect(isFirstPlanWizardQuestion("title")).toBe(true);
    expect(isFirstPlanWizardQuestion("proposal-reason")).toBe(true);
    expect(isFirstPlanWizardQuestion("headcount")).toBe(true);
    expect(isFirstPlanWizardQuestion("city")).toBe(true);
    expect(isFirstPlanWizardQuestion("arrival-date")).toBe(true);
    expect(isFirstPlanWizardQuestion("departure-date")).toBe(true);
    expect(isFirstPlanWizardQuestion("add-city")).toBe(true);
    expect(isFirstPlanWizardQuestion("status")).toBe(true);
    expect(isFirstPlanWizardQuestion("hotel-name")).toBe(true);
    expect(isFirstPlanWizardQuestion("endpoints")).toBe(true);
    expect(isFirstPlanWizardQuestion("mode")).toBe(true);
    expect(isFirstPlanWizardQuestion("duration")).toBe(true);
    expect(isFirstPlanWizardQuestion("unknown")).toBe(false);
    expect(isFirstPlanWizardQuestion(undefined)).toBe(false);
  });
});

describe("parseWizardCursor", () => {
  it("parses review route /plans/new", () => {
    const cursor = parseWizardCursor(new URLSearchParams(), "/trips/t1/plans/new");
    expect(cursor).toEqual({ section: "review", question: "title" });
  });

  it("parses basic section with question parameter", () => {
    const cursor = parseWizardCursor(
      new URLSearchParams("question=headcount"),
      "/trips/t1/plans/new/basic"
    );
    expect(cursor).toEqual({ section: "basic", question: "headcount" });
  });

  it("parses route section with question and index parameters", () => {
    const cursor = parseWizardCursor(
      new URLSearchParams("question=arrival-date&index=1"),
      "/trips/t1/plans/new/route"
    );
    expect(cursor).toEqual({ section: "route", question: "arrival-date", index: 1 });
  });

  it("parses accommodation section with returnToReview flag", () => {
    const cursor = parseWizardCursor(
      new URLSearchParams("question=hotel-name&index=2&returnToReview=true"),
      "/trips/t1/plans/new/accommodation"
    );
    expect(cursor).toEqual({
      section: "accommodation",
      question: "hotel-name",
      index: 2,
      returnToReview: true,
    });
  });

  it("parses transport section with duration question and index", () => {
    const cursor = parseWizardCursor(
      new URLSearchParams("question=duration&index=3"),
      "/trips/t1/plans/new/transport"
    );
    expect(cursor).toEqual({
      section: "transport",
      question: "duration",
      index: 3,
    });
  });

  it("falls back to default question and index: 0 on missing query params", () => {
    const cursor = parseWizardCursor(new URLSearchParams(), "/trips/t1/plans/new/route");
    expect(cursor).toEqual({ section: "route", question: "city", index: 0 });
  });

  it("falls back to basic section on invalid path", () => {
    const cursor = parseWizardCursor(new URLSearchParams(), "/trips/t1/plans/unknown");
    expect(cursor).toEqual({ section: "basic", question: "title" });
  });
});

describe("serializeWizardCursor", () => {
  it("serializes review cursor to path without search params", () => {
    const result = serializeWizardCursor({ section: "review", question: "title" }, "trip-123");
    expect(result).toEqual({ pathname: "/trips/trip-123/plans/new", search: "" });
  });

  it("serializes basic info cursor with question", () => {
    const result = serializeWizardCursor(
      { section: "basic", question: "proposal-reason" },
      "trip-123"
    );
    expect(result).toEqual({
      pathname: "/trips/trip-123/plans/new/basic",
      search: "?question=proposal-reason",
    });
  });

  it("serializes route cursor with index", () => {
    const result = serializeWizardCursor(
      { section: "route", question: "departure-date", index: 1 },
      "trip-123"
    );
    expect(result).toEqual({
      pathname: "/trips/trip-123/plans/new/route",
      search: "?question=departure-date&index=1",
    });
  });

  it("serializes cursor with returnToReview flag", () => {
    const result = serializeWizardCursor(
      { section: "accommodation", question: "hotel-name", index: 0, returnToReview: true },
      "trip-123"
    );
    expect(result).toEqual({
      pathname: "/trips/trip-123/plans/new/accommodation",
      search: "?question=hotel-name&index=0&returnToReview=true",
    });
  });
});

describe("normalizeWizardCursor", () => {
  const formData = createMockFormData({
    routes: [
      { city: "도쿄", arrivalDate: "2026-10-01", departureDate: "2026-10-03" },
      { city: "오사카", arrivalDate: "2026-10-03", departureDate: "2026-10-06" },
    ],
    accommodations: [
      {
        id: "acc-1",
        city: "도쿄",
        period: "2026-10-01 ~ 2026-10-03",
        nights: 2,
        hotelName: "도쿄 호텔",
        isSearching: false,
        bookingStatus: "AVAILABLE",
      },
      {
        id: "acc-2",
        city: "오사카",
        period: "2026-10-03 ~ 2026-10-06",
        nights: 3,
        hotelName: "",
        isSearching: true,
        bookingStatus: "NOT_CHECKED",
      },
    ],
    transports: [
      {
        id: "tr-1",
        fromCity: "인천",
        toCity: "도쿄",
        mode: "항공",
        hasTransfer: false,
        durationText: "2시간",
        bookingStatus: "AVAILABLE",
      },
      {
        id: "tr-2",
        fromCity: "도쿄",
        toCity: "오사카",
        mode: "",
        hasTransfer: false,
        durationText: "",
        bookingStatus: "NOT_CHECKED",
      },
      {
        id: "tr-3",
        fromCity: "오사카",
        toCity: "인천",
        mode: "항공",
        hasTransfer: false,
        durationText: "2시간",
        bookingStatus: "AVAILABLE",
      },
    ],
  });

  it("normalizes unknown section to basic title", () => {
    const cursor = normalizeWizardCursor({ section: "invalid" as any }, formData);
    expect(cursor).toEqual({ section: "basic", question: "title" });
  });

  it("normalizes invalid question for section to section default", () => {
    const cursor = normalizeWizardCursor(
      { section: "route", question: "title" as any, index: 0 },
      formData
    );
    expect(cursor).toEqual({ section: "route", question: "city", index: 0 });
  });

  it("clamps negative index to 0", () => {
    const cursor = normalizeWizardCursor(
      { section: "route", question: "arrival-date", index: -5 },
      formData
    );
    expect(cursor.index).toBe(0);
  });

  it("clamps oversized route index to routes.length - 1", () => {
    const cursor = normalizeWizardCursor(
      { section: "route", question: "city", index: 99 },
      formData
    );
    expect(cursor.index).toBe(1);
  });

  it("clamps oversized transport index to routes.length (N + 1 legs)", () => {
    const cursor = normalizeWizardCursor(
      { section: "transport", question: "endpoints", index: 99 },
      formData
    );
    expect(cursor.index).toBe(2);
  });

  it("redirects accommodation/transport to route city when routes array is empty", () => {
    const emptyForm = createMockFormData({ routes: [] });
    const cursor = normalizeWizardCursor(
      { section: "accommodation", question: "status", index: 0 },
      emptyForm
    );
    expect(cursor).toEqual({ section: "route", question: "city", index: 0 });
  });

  it("clamps hotel-name to status when accommodation is isSearching: true", () => {
    const cursor = normalizeWizardCursor(
      { section: "accommodation", question: "hotel-name", index: 1 },
      formData
    );
    expect(cursor).toEqual({ section: "accommodation", question: "status", index: 1 });
  });

  it("clamps hotel-name to status when accommodation array is empty (defaults to searching)", () => {
    const emptyAccForm = createMockFormData({ accommodations: [] });
    const cursor = normalizeWizardCursor(
      { section: "accommodation", question: "hotel-name", index: 0 },
      emptyAccForm
    );
    expect(cursor).toEqual({ section: "accommodation", question: "status", index: 0 });
  });

  it("clamps mode/duration to status when transport is bookingStatus: NOT_CHECKED", () => {
    const cursor = normalizeWizardCursor(
      { section: "transport", question: "duration", index: 1 },
      formData
    );
    expect(cursor).toEqual({ section: "transport", question: "status", index: 1 });
  });

  it("preserves returnToReview flag during normalization", () => {
    const cursor = normalizeWizardCursor(
      { section: "basic", question: "title", returnToReview: true },
      formData
    );
    expect(cursor.returnToReview).toBe(true);
  });
});

describe("getNextWizardCursor", () => {
  const singleRouteForm = createMockFormData();

  it("advances through basic info questions sequentially", () => {
    expect(getNextWizardCursor({ section: "basic", question: "title" }, singleRouteForm))
      .toEqual({ section: "basic", question: "proposal-reason" });
    expect(getNextWizardCursor({ section: "basic", question: "proposal-reason" }, singleRouteForm))
      .toEqual({ section: "basic", question: "headcount" });
    expect(getNextWizardCursor({ section: "basic", question: "headcount" }, singleRouteForm))
      .toEqual({ section: "route", question: "city", index: 0 });
  });

  it("advances through route questions for single stop", () => {
    expect(getNextWizardCursor({ section: "route", question: "city", index: 0 }, singleRouteForm))
      .toEqual({ section: "route", question: "arrival-date", index: 0 });
    expect(getNextWizardCursor({ section: "route", question: "arrival-date", index: 0 }, singleRouteForm))
      .toEqual({ section: "route", question: "departure-date", index: 0 });
    expect(getNextWizardCursor({ section: "route", question: "departure-date", index: 0 }, singleRouteForm))
      .toEqual({ section: "route", question: "add-city", index: 0 });
    expect(getNextWizardCursor({ section: "route", question: "add-city", index: 0 }, singleRouteForm))
      .toEqual({ section: "accommodation", question: "status", index: 0 });
  });

  it("advances from add-city to next city when multiple routes exist", () => {
    const multiRouteForm = createMockFormData({
      routes: [
        { city: "도쿄", arrivalDate: "2026-10-01", departureDate: "2026-10-03" },
        { city: "오사카", arrivalDate: "2026-10-03", departureDate: "2026-10-06" },
      ],
    });
    expect(getNextWizardCursor({ section: "route", question: "add-city", index: 0 }, multiRouteForm))
      .toEqual({ section: "route", question: "city", index: 1 });
  });

  it("handles accommodation decided vs searching transitions", () => {
    const decidedStayForm = createMockFormData({
      accommodations: [
        {
          id: "acc-1",
          city: "도쿄",
          period: "2026-10-01 ~ 2026-10-04",
          nights: 3,
          hotelName: "신주쿠 호텔",
          isSearching: false,
          bookingStatus: "AVAILABLE",
        },
      ],
    });
    expect(getNextWizardCursor({ section: "accommodation", question: "status", index: 0 }, decidedStayForm))
      .toEqual({ section: "accommodation", question: "hotel-name", index: 0 });
    expect(getNextWizardCursor({ section: "accommodation", question: "hotel-name", index: 0 }, decidedStayForm))
      .toEqual({ section: "transport", question: "endpoints", index: 0 });

    const searchingStayForm = createMockFormData({
      accommodations: [
        {
          id: "acc-1",
          city: "도쿄",
          period: "2026-10-01 ~ 2026-10-04",
          nights: 3,
          hotelName: "",
          isSearching: true,
          bookingStatus: "NOT_CHECKED",
        },
      ],
    });
    // Skips hotel-name when searching
    expect(getNextWizardCursor({ section: "accommodation", question: "status", index: 0 }, searchingStayForm))
      .toEqual({ section: "transport", question: "endpoints", index: 0 });

    const unpopulatedStayForm = createMockFormData({
      accommodations: [],
    });
    // Defaults to isSearching: true, skipping hotel-name when unpopulated
    expect(getNextWizardCursor({ section: "accommodation", question: "status", index: 0 }, unpopulatedStayForm))
      .toEqual({ section: "transport", question: "endpoints", index: 0 });
  });

  it("handles transport decided vs unchecked transitions", () => {
    const decidedTrForm = createMockFormData({
      transports: [
        {
          id: "tr-1",
          fromCity: "인천",
          toCity: "도쿄",
          mode: "항공",
          hasTransfer: false,
          durationText: "2시간",
          bookingStatus: "AVAILABLE",
        },
        {
          id: "tr-2",
          fromCity: "도쿄",
          toCity: "인천",
          mode: "항공",
          hasTransfer: false,
          durationText: "2시간",
          bookingStatus: "AVAILABLE",
        },
      ],
    });
    expect(getNextWizardCursor({ section: "transport", question: "endpoints", index: 0 }, decidedTrForm))
      .toEqual({ section: "transport", question: "status", index: 0 });
    expect(getNextWizardCursor({ section: "transport", question: "status", index: 0 }, decidedTrForm))
      .toEqual({ section: "transport", question: "mode", index: 0 });
    expect(getNextWizardCursor({ section: "transport", question: "mode", index: 0 }, decidedTrForm))
      .toEqual({ section: "transport", question: "duration", index: 0 });
    expect(getNextWizardCursor({ section: "transport", question: "duration", index: 0 }, decidedTrForm))
      .toEqual({ section: "transport", question: "endpoints", index: 1 });
    expect(getNextWizardCursor({ section: "transport", question: "duration", index: 1 }, decidedTrForm))
      .toEqual({ section: "review", question: "title" });

    const uncheckedTrForm = createMockFormData({
      transports: [
        {
          id: "tr-1",
          fromCity: "인천",
          toCity: "도쿄",
          mode: "",
          hasTransfer: false,
          durationText: "",
          bookingStatus: "NOT_CHECKED",
        },
        {
          id: "tr-2",
          fromCity: "도쿄",
          toCity: "인천",
          mode: "",
          hasTransfer: false,
          durationText: "",
          bookingStatus: "NOT_CHECKED",
        },
      ],
    });
    // Skips mode and duration when NOT_CHECKED
    expect(getNextWizardCursor({ section: "transport", question: "status", index: 0 }, uncheckedTrForm))
      .toEqual({ section: "transport", question: "endpoints", index: 1 });
    expect(getNextWizardCursor({ section: "transport", question: "status", index: 1 }, uncheckedTrForm))
      .toEqual({ section: "review", question: "title" });
  });

  it("returns directly to review in returnToReview mode", () => {
    expect(getNextWizardCursor({ section: "basic", question: "title", returnToReview: true }, singleRouteForm))
      .toEqual({ section: "review", question: "title" });
    expect(getNextWizardCursor({ section: "route", question: "departure-date", index: 0, returnToReview: true }, singleRouteForm))
      .toEqual({ section: "review", question: "title" });
    expect(getNextWizardCursor({ section: "accommodation", question: "hotel-name", index: 0, returnToReview: true }, singleRouteForm))
      .toEqual({ section: "review", question: "title" });
    expect(getNextWizardCursor({ section: "transport", question: "duration", index: 0, returnToReview: true }, singleRouteForm))
      .toEqual({ section: "review", question: "title" });
  });
});

describe("getPreviousWizardCursor", () => {
  const multiStopForm = createMockFormData({
    routes: [
      { city: "도쿄", arrivalDate: "2026-10-01", departureDate: "2026-10-03" },
      { city: "오사카", arrivalDate: "2026-10-03", departureDate: "2026-10-06" },
    ],
    accommodations: [
      {
        id: "acc-1",
        city: "도쿄",
        period: "2026-10-01 ~ 2026-10-03",
        nights: 2,
        hotelName: "도쿄 호텔",
        isSearching: false,
        bookingStatus: "AVAILABLE",
      },
      {
        id: "acc-2",
        city: "오사카",
        period: "2026-10-03 ~ 2026-10-06",
        nights: 3,
        hotelName: "",
        isSearching: true,
        bookingStatus: "NOT_CHECKED",
      },
    ],
    transports: [
      {
        id: "tr-1",
        fromCity: "인천",
        toCity: "도쿄",
        mode: "항공",
        hasTransfer: false,
        durationText: "2시간",
        bookingStatus: "AVAILABLE",
      },
      {
        id: "tr-2",
        fromCity: "도쿄",
        toCity: "오사카",
        mode: "",
        hasTransfer: false,
        durationText: "",
        bookingStatus: "NOT_CHECKED",
      },
      {
        id: "tr-3",
        fromCity: "오사카",
        toCity: "인천",
        mode: "항공",
        hasTransfer: false,
        durationText: "2시간",
        bookingStatus: "AVAILABLE",
      },
    ],
  });

  it("steps backward within basic info", () => {
    expect(getPreviousWizardCursor({ section: "basic", question: "headcount" }, multiStopForm))
      .toEqual({ section: "basic", question: "proposal-reason" });
    expect(getPreviousWizardCursor({ section: "basic", question: "proposal-reason" }, multiStopForm))
      .toEqual({ section: "basic", question: "title" });
    expect(getPreviousWizardCursor({ section: "basic", question: "title" }, multiStopForm))
      .toEqual({ section: "basic", question: "title" });
  });

  it("steps backward from first route stop to basic headcount", () => {
    expect(getPreviousWizardCursor({ section: "route", question: "city", index: 0 }, multiStopForm))
      .toEqual({ section: "basic", question: "headcount" });
  });

  it("steps backward within route stops", () => {
    expect(getPreviousWizardCursor({ section: "route", question: "add-city", index: 0 }, multiStopForm))
      .toEqual({ section: "route", question: "departure-date", index: 0 });
    expect(getPreviousWizardCursor({ section: "route", question: "departure-date", index: 0 }, multiStopForm))
      .toEqual({ section: "route", question: "arrival-date", index: 0 });
    expect(getPreviousWizardCursor({ section: "route", question: "arrival-date", index: 0 }, multiStopForm))
      .toEqual({ section: "route", question: "city", index: 0 });
    expect(getPreviousWizardCursor({ section: "route", question: "city", index: 1 }, multiStopForm))
      .toEqual({ section: "route", question: "add-city", index: 0 });
  });

  it("steps backward from accommodation to last route add-city", () => {
    expect(getPreviousWizardCursor({ section: "accommodation", question: "status", index: 0 }, multiStopForm))
      .toEqual({ section: "route", question: "add-city", index: 1 });
  });

  it("steps backward from accommodation(1) to accommodation(0)", () => {
    expect(getPreviousWizardCursor({ section: "accommodation", question: "status", index: 1 }, multiStopForm))
      .toEqual({ section: "accommodation", question: "hotel-name", index: 0 });
  });

  it("steps backward from transport(0) to last accommodation stop (considering searching status)", () => {
    expect(getPreviousWizardCursor({ section: "transport", question: "endpoints", index: 0 }, multiStopForm))
      .toEqual({ section: "accommodation", question: "status", index: 1 });
  });

  it("steps backward from transport(0) to accommodation status when accommodations array is empty", () => {
    const noAccForm = createMockFormData({
      routes: [{ city: "제주", arrivalDate: "2026-10-01", departureDate: "2026-10-04" }],
      accommodations: [],
    });
    expect(getPreviousWizardCursor({ section: "transport", question: "endpoints", index: 0 }, noAccForm))
      .toEqual({ section: "accommodation", question: "status", index: 0 });
  });

  it("steps backward from transport(2) to transport(1) (considering unchecked status)", () => {
    expect(getPreviousWizardCursor({ section: "transport", question: "endpoints", index: 2 }, multiStopForm))
      .toEqual({ section: "transport", question: "status", index: 1 });
  });

  it("steps backward from review to last transport leg", () => {
    expect(getPreviousWizardCursor({ section: "review", question: "title" }, multiStopForm))
      .toEqual({ section: "transport", question: "duration", index: 2 });
  });

  it("returns directly to review in returnToReview mode on back", () => {
    expect(getPreviousWizardCursor({ section: "route", question: "city", index: 0, returnToReview: true }, multiStopForm))
      .toEqual({ section: "review", question: "title" });
  });
});

describe("mapValidationErrorToCursor", () => {
  const validForm = createMockFormData();

  it("maps title error to basic title", () => {
    const cursor = mapValidationErrorToCursor("여행안 제목을 입력해주세요.", validForm);
    expect(cursor).toEqual({ section: "basic", question: "title" });
  });

  it("maps headcount error to basic headcount", () => {
    const cursor = mapValidationErrorToCursor("기준 인원수는 1명 이상이어야 합니다.", validForm);
    expect(cursor).toEqual({ section: "basic", question: "headcount" });
  });

  it("maps 0 routes error to route city index 0", () => {
    const cursor = mapValidationErrorToCursor(
      "최소 1개 이상의 방문 도시를 추가해주세요.",
      createMockFormData({ routes: [] })
    );
    expect(cursor).toEqual({ section: "route", question: "city", index: 0 });
  });

  it("maps missing arrival/departure date error to exact incomplete route stop", () => {
    const formWithIncompleteRoute = createMockFormData({
      routes: [
        { city: "도쿄", arrivalDate: "2026-10-01", departureDate: "2026-10-04" },
        { city: "오사카", arrivalDate: "2026-10-04", departureDate: "" },
      ],
    });
    const cursor = mapValidationErrorToCursor(
      "오사카의 도착일과 출발일을 입력해주세요.",
      formWithIncompleteRoute
    );
    expect(cursor).toEqual({ section: "route", question: "departure-date", index: 1 });
  });

  it("maps departure <= arrival error to departure-date", () => {
    const formWithInvalidOrder = createMockFormData({
      routes: [{ city: "도쿄", arrivalDate: "2026-10-04", departureDate: "2026-10-01" }],
    });
    const cursor = mapValidationErrorToCursor(
      "도쿄의 출발일은 도착일 이후여야 합니다.",
      formWithInvalidOrder
    );
    expect(cursor).toEqual({ section: "route", question: "departure-date", index: 0 });
  });

  it("maps overlapping routes error to arrival-date of the second route", () => {
    const formWithOverlap = createMockFormData({
      routes: [
        { city: "도쿄", arrivalDate: "2026-10-01", departureDate: "2026-10-05" },
        { city: "오사카", arrivalDate: "2026-10-03", departureDate: "2026-10-07" },
      ],
    });
    const cursor = mapValidationErrorToCursor(
      "도시 체류 일정은 서로 겹칠 수 없습니다.",
      formWithOverlap
    );
    expect(cursor).toEqual({ section: "route", question: "arrival-date", index: 1 });
  });

  it("maps accommodation error to hotel-name if not searching", () => {
    const formWithMissingHotel = createMockFormData({
      accommodations: [
        {
          id: "acc-1",
          city: "도쿄",
          period: "2026-10-01 ~ 2026-10-04",
          nights: 3,
          hotelName: "",
          isSearching: false,
          bookingStatus: "AVAILABLE",
        },
      ],
    });
    const cursor = mapValidationErrorToCursor(
      "각 방문 도시의 숙소 또는 숙소 찾는 중 상태를 추가해주세요.",
      formWithMissingHotel
    );
    expect(cursor).toEqual({ section: "accommodation", question: "hotel-name", index: 0 });
  });

  it("maps transport count error to endpoints index of missing leg", () => {
    const cursor = mapValidationErrorToCursor(
      "출국·도시 간 이동·귀국 교통을 2개 추가해주세요.",
      createMockFormData({ transports: [] })
    );
    expect(cursor).toEqual({ section: "transport", question: "endpoints", index: 0 });
  });

  it("maps incomplete transport error to transport mode or duration", () => {
    const formWithMissingMode = createMockFormData({
      transports: [
        {
          id: "tr-1",
          fromCity: "인천",
          toCity: "도쿄",
          mode: "",
          hasTransfer: false,
          durationText: "2시간",
          bookingStatus: "AVAILABLE",
        },
      ],
    });
    const cursor = mapValidationErrorToCursor(
      "교통 구간의 출발지·도착지와 확인 상태를 입력해주세요.",
      formWithMissingMode
    );
    expect(cursor).toEqual({ section: "transport", question: "mode", index: 0 });
  });

  it("falls back to basic title for unknown error", () => {
    const cursor = mapValidationErrorToCursor("알 수 없는 오류", validForm);
    expect(cursor).toEqual({ section: "basic", question: "title" });
  });
});

describe("End-to-End State Machine Scenarios", () => {
  it("supports repeated city visits without deduplication or collision", () => {
    const repeatedCityForm = createMockFormData({
      routes: [
        { city: "도쿄", arrivalDate: "2026-10-01", departureDate: "2026-10-03" },
        { city: "하코네", arrivalDate: "2026-10-03", departureDate: "2026-10-05" },
        { city: "도쿄", arrivalDate: "2026-10-05", departureDate: "2026-10-07" },
      ],
      accommodations: [
        { id: "a1", city: "도쿄", period: "2026-10-01 ~ 2026-10-03", nights: 2, hotelName: "도쿄 호텔 1", isSearching: false, bookingStatus: "AVAILABLE" },
        { id: "a2", city: "하코네", period: "2026-10-03 ~ 2026-10-05", nights: 2, hotelName: "료칸", isSearching: false, bookingStatus: "AVAILABLE" },
        { id: "a3", city: "도쿄", period: "2026-10-05 ~ 2026-10-07", nights: 2, hotelName: "도쿄 호텔 2", isSearching: false, bookingStatus: "AVAILABLE" },
      ],
      transports: [
        { id: "t1", fromCity: "인천", toCity: "도쿄", mode: "항공", hasTransfer: false, durationText: "2시간", bookingStatus: "AVAILABLE" },
        { id: "t2", fromCity: "도쿄", toCity: "하코네", mode: "열차", hasTransfer: false, durationText: "1시간", bookingStatus: "AVAILABLE" },
        { id: "t3", fromCity: "하코네", toCity: "도쿄", mode: "열차", hasTransfer: false, durationText: "1시간", bookingStatus: "AVAILABLE" },
        { id: "t4", fromCity: "도쿄", toCity: "인천", mode: "항공", hasTransfer: false, durationText: "2시간", bookingStatus: "AVAILABLE" },
      ],
    });

    let cursor: FirstPlanWizardCursor = { section: "basic", question: "title" };
    // Step through basic
    cursor = getNextWizardCursor(cursor, repeatedCityForm);
    cursor = getNextWizardCursor(cursor, repeatedCityForm);
    cursor = getNextWizardCursor(cursor, repeatedCityForm);
    expect(cursor).toEqual({ section: "route", question: "city", index: 0 });

    // Step through route stop 0
    cursor = getNextWizardCursor(cursor, repeatedCityForm);
    cursor = getNextWizardCursor(cursor, repeatedCityForm);
    cursor = getNextWizardCursor(cursor, repeatedCityForm);
    expect(cursor).toEqual({ section: "route", question: "add-city", index: 0 });

    // Step to route stop 1
    cursor = getNextWizardCursor(cursor, repeatedCityForm);
    expect(cursor).toEqual({ section: "route", question: "city", index: 1 });
    cursor = getNextWizardCursor(cursor, repeatedCityForm);
    cursor = getNextWizardCursor(cursor, repeatedCityForm);
    cursor = getNextWizardCursor(cursor, repeatedCityForm);
    expect(cursor).toEqual({ section: "route", question: "add-city", index: 1 });

    // Step to route stop 2 (same city name Tokyo again)
    cursor = getNextWizardCursor(cursor, repeatedCityForm);
    expect(cursor).toEqual({ section: "route", question: "city", index: 2 });
    cursor = getNextWizardCursor(cursor, repeatedCityForm);
    cursor = getNextWizardCursor(cursor, repeatedCityForm);
    cursor = getNextWizardCursor(cursor, repeatedCityForm);
    expect(cursor).toEqual({ section: "route", question: "add-city", index: 2 });

    // Step to accommodations
    cursor = getNextWizardCursor(cursor, repeatedCityForm);
    expect(cursor).toEqual({ section: "accommodation", question: "status", index: 0 });
    cursor = getNextWizardCursor(cursor, repeatedCityForm);
    expect(cursor).toEqual({ section: "accommodation", question: "hotel-name", index: 0 });
    cursor = getNextWizardCursor(cursor, repeatedCityForm);
    expect(cursor).toEqual({ section: "accommodation", question: "status", index: 1 });
    cursor = getNextWizardCursor(cursor, repeatedCityForm);
    expect(cursor).toEqual({ section: "accommodation", question: "hotel-name", index: 1 });
    cursor = getNextWizardCursor(cursor, repeatedCityForm);
    expect(cursor).toEqual({ section: "accommodation", question: "status", index: 2 });
    cursor = getNextWizardCursor(cursor, repeatedCityForm);
    expect(cursor).toEqual({ section: "accommodation", question: "hotel-name", index: 2 });

    // Step to transports (4 legs)
    cursor = getNextWizardCursor(cursor, repeatedCityForm);
    expect(cursor).toEqual({ section: "transport", question: "endpoints", index: 0 });
    for (let i = 0; i < 4; i += 1) {
      expect(cursor).toEqual({ section: "transport", question: "endpoints", index: i });
      cursor = getNextWizardCursor(cursor, repeatedCityForm);
      expect(cursor).toEqual({ section: "transport", question: "status", index: i });
      cursor = getNextWizardCursor(cursor, repeatedCityForm);
      expect(cursor).toEqual({ section: "transport", question: "mode", index: i });
      cursor = getNextWizardCursor(cursor, repeatedCityForm);
      expect(cursor).toEqual({ section: "transport", question: "duration", index: i });
      cursor = getNextWizardCursor(cursor, repeatedCityForm);
    }

    // Finally reaches review
    expect(cursor).toEqual({ section: "review", question: "title" });
  });

  it("supports date gaps between route stops without errors", () => {
    const dateGapForm = createMockFormData({
      routes: [
        { city: "도쿄", arrivalDate: "2026-10-01", departureDate: "2026-10-04" },
        { city: "오사카", arrivalDate: "2026-10-07", departureDate: "2026-10-10" },
      ],
    });

    // Normalizing and stepping through date gap route works cleanly
    const cursor = normalizeWizardCursor(
      { section: "route", question: "arrival-date", index: 1 },
      dateGapForm
    );
    expect(cursor).toEqual({ section: "route", question: "arrival-date", index: 1 });

    const nextCursor = getNextWizardCursor(cursor, dateGapForm);
    expect(nextCursor).toEqual({ section: "route", question: "departure-date", index: 1 });
  });

  describe("getWizardSubStepProgress", () => {
    it("기본 1개 도시(숙소 탐색 기본값) 기준 12개 질문에서 순서에 맞는 current/total을 반환한다", () => {
      const initialForm: PlanEditorFormData = {
        title: "",
        proposalReason: "",
        baseHeadcount: 2,
        routes: [{ city: "", arrivalDate: "", departureDate: "" }],
        accommodations: [],
        transports: [],
      };

      // 1. basic title -> 1/12
      expect(getWizardSubStepProgress({ section: "basic", question: "title" }, initialForm)).toEqual({
        current: 1,
        total: 12,
      });

      // 2. basic proposal-reason -> 2/12
      expect(getWizardSubStepProgress({ section: "basic", question: "proposal-reason" }, initialForm)).toEqual({
        current: 2,
        total: 12,
      });

      // 3. basic headcount -> 3/12
      expect(getWizardSubStepProgress({ section: "basic", question: "headcount" }, initialForm)).toEqual({
        current: 3,
        total: 12,
      });

      // 4. route city -> 4/12
      expect(getWizardSubStepProgress({ section: "route", question: "city", index: 0 }, initialForm)).toEqual({
        current: 4,
        total: 12,
      });

      // 5. route arrival-date -> 5/12
      expect(getWizardSubStepProgress({ section: "route", question: "arrival-date", index: 0 }, initialForm)).toEqual({
        current: 5,
        total: 12,
      });

      // 6. route departure-date -> 6/12
      expect(getWizardSubStepProgress({ section: "route", question: "departure-date", index: 0 }, initialForm)).toEqual({
        current: 6,
        total: 12,
      });

      // 7. route add-city -> 7/12
      expect(getWizardSubStepProgress({ section: "route", question: "add-city", index: 0 }, initialForm)).toEqual({
        current: 7,
        total: 12,
      });

      // 8. accommodation status -> 8/12
      expect(getWizardSubStepProgress({ section: "accommodation", question: "status", index: 0 }, initialForm)).toEqual({
        current: 8,
        total: 12,
      });

      // 9. transport endpoints (0) -> 9/12 (hotel-name 건너뜀)
      expect(getWizardSubStepProgress({ section: "transport", question: "endpoints", index: 0 }, initialForm)).toEqual({
        current: 9,
        total: 12,
      });

      // 10. transport status (0) -> 10/12
      expect(getWizardSubStepProgress({ section: "transport", question: "status", index: 0 }, initialForm)).toEqual({
        current: 10,
        total: 12,
      });

      // 11. transport endpoints (1 - 귀환) -> 11/12
      expect(getWizardSubStepProgress({ section: "transport", question: "endpoints", index: 1 }, initialForm)).toEqual({
        current: 11,
        total: 12,
      });

      // 12. transport status (1 - 귀환 상태) -> 12/12
      expect(getWizardSubStepProgress({ section: "transport", question: "status", index: 1 }, initialForm)).toEqual({
        current: 12,
        total: 12,
      });
    });

    it("숙소를 확정(isSearching=false)한 경우 hotel-name 단계가 추가되어 13개로 계산된다", () => {
      const hotelDecidedForm: PlanEditorFormData = {
        title: "도쿄 여행",
        proposalReason: "",
        baseHeadcount: 2,
        routes: [{ city: "도쿄", arrivalDate: "2026-10-01", departureDate: "2026-10-03" }],
        accommodations: [
          {
            id: "acc-1",
            city: "도쿄",
            period: "2026-10-01 ~ 2026-10-03",
            nights: 2,
            hotelName: "그랜드 호텔",
            isSearching: false,
            bookingStatus: "AVAILABLE",
          },
        ],
        transports: [],
      };

      // accommodation hotel-name -> 9/13
      expect(
        getWizardSubStepProgress({ section: "accommodation", question: "hotel-name", index: 0 }, hotelDecidedForm),
      ).toEqual({
        current: 9,
        total: 13,
      });

      // transport endpoints (0) -> 10/13
      expect(
        getWizardSubStepProgress({ section: "transport", question: "endpoints", index: 0 }, hotelDecidedForm),
      ).toEqual({
        current: 10,
        total: 13,
      });
    });

    it("교통편 예약 확정 시 mode/duration 단계가 추가되어 17개(숙소 포함)로 확장된다", () => {
      const decidedTransportForm: PlanEditorFormData = {
        title: "",
        proposalReason: "",
        baseHeadcount: 2,
        routes: [{ city: "도쿄", arrivalDate: "2026-05-01", departureDate: "2026-05-03" }],
        accommodations: [
          {
            id: "acc-1",
            city: "도쿄",
            period: "2026-05-01 ~ 2026-05-03",
            nights: 2,
            hotelName: "호텔",
            isSearching: false,
            bookingStatus: "AVAILABLE",
          },
        ],
        transports: [
          {
            id: "tr-0",
            fromCity: "서울",
            toCity: "도쿄",
            mode: "비행기",
            hasTransfer: false,
            durationText: "2시간",
            bookingStatus: "AVAILABLE",
          },
          {
            id: "tr-1",
            fromCity: "도쿄",
            toCity: "서울",
            mode: "비행기",
            hasTransfer: false,
            durationText: "2시간",
            bookingStatus: "AVAILABLE",
          },
        ],
      };

      expect(getWizardQuestionSequence(decidedTransportForm)).toHaveLength(17);
      expect(
        getWizardSubStepProgress({ section: "transport", question: "duration", index: 0 }, decidedTransportForm),
      ).toEqual({
        current: 13,
        total: 17,
      });
    });

    it("review 화면이거나 returnToReview인 경우 subStepProgress는 undefined를 반환한다", () => {
      const form: PlanEditorFormData = {
        title: "제주 여행",
        proposalReason: "",
        baseHeadcount: 2,
        routes: [{ city: "제주", arrivalDate: "2026-06-01", departureDate: "2026-06-03" }],
        accommodations: [],
        transports: [],
      };

      expect(getWizardSubStepProgress({ section: "review", question: "title" }, form)).toBeUndefined();
      expect(
        getWizardSubStepProgress(
          { section: "route", question: "city", index: 0, returnToReview: true },
          form,
        ),
      ).toBeUndefined();
    });
  });
});
