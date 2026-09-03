import { describe, expect, it } from "vitest";
import {
  getNextWizardCursor,
  getPreviousWizardCursor,
  mapValidationErrorToCursor,
  normalizeWizardCursor,
  parseWizardCursor,
  serializeWizardCursor,
  type FirstPlanWizardCursor,
  type FirstPlanWizardSection,
  type FirstPlanWizardQuestion,
} from "./first-plan-wizard-flow.ts";
import {
  parsePlanEditorDraft,
  savePlanEditorDraft,
  syncAccommodationNights,
  type PlanEditorFormData,
  type StoredPlanEditorDraft,
} from "./hooks/usePlanEditorState.ts";
import { getPlanPublishValidationErrors } from "../../core/domain/room.ts";

const createHarnessFormData = (overrides: Partial<PlanEditorFormData> = {}): PlanEditorFormData => ({
  title: "도쿄-오사카 일주일",
  proposalReason: "여유로운 힐링",
  baseHeadcount: 2,
  routes: [
    { city: "도쿄", arrivalDate: "2026-10-01", departureDate: "2026-10-04" },
    { city: "오사카", arrivalDate: "2026-10-04", departureDate: "2026-10-07" },
  ],
  accommodations: [
    {
      id: "acc-1",
      city: "도쿄",
      period: "2026-10-01 ~ 2026-10-04",
      nights: 3,
      hotelName: "도쿄 타워 호텔",
      isSearching: false,
      bookingStatus: "AVAILABLE",
    },
    {
      id: "acc-2",
      city: "오사카",
      period: "2026-10-04 ~ 2026-10-07",
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
      durationText: "2시간 30분",
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
  ...overrides,
});

describe("CHALLENGE 1: Exhaustive Roundtrip Serialization & Parsing", () => {
  const testTripIds = ["trip-1", "trip_uuid-98765-abcd", "T100"];

  it("preserves all cursor fields across serialize -> parse roundtrip for all sections and questions", () => {
    const validCombinations: Array<{
      section: FirstPlanWizardSection;
      question: FirstPlanWizardQuestion;
      index?: number;
      returnToReview?: boolean;
    }> = [
      // basic
      { section: "basic", question: "title" },
      { section: "basic", question: "proposal-reason" },
      { section: "basic", question: "headcount" },
      { section: "basic", question: "title", returnToReview: true },
      { section: "basic", question: "proposal-reason", returnToReview: true },
      { section: "basic", question: "headcount", returnToReview: true },

      // route
      { section: "route", question: "city", index: 0 },
      { section: "route", question: "arrival-date", index: 0 },
      { section: "route", question: "departure-date", index: 0 },
      { section: "route", question: "add-city", index: 0 },
      { section: "route", question: "city", index: 5, returnToReview: true },
      { section: "route", question: "arrival-date", index: 10, returnToReview: true },
      { section: "route", question: "departure-date", index: 42 },

      // accommodation
      { section: "accommodation", question: "status", index: 0 },
      { section: "accommodation", question: "hotel-name", index: 0 },
      { section: "accommodation", question: "status", index: 3, returnToReview: true },
      { section: "accommodation", question: "hotel-name", index: 7, returnToReview: true },

      // transport
      { section: "transport", question: "endpoints", index: 0 },
      { section: "transport", question: "status", index: 0 },
      { section: "transport", question: "mode", index: 0 },
      { section: "transport", question: "duration", index: 0 },
      { section: "transport", question: "endpoints", index: 4, returnToReview: true },
      { section: "transport", question: "duration", index: 8, returnToReview: true },

      // review
      { section: "review", question: "title" },
    ];

    for (const tripId of testTripIds) {
      for (const inputCursor of validCombinations) {
        const { pathname, search } = serializeWizardCursor(inputCursor, tripId);
        const searchParams = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
        const parsed = parseWizardCursor(searchParams, pathname);

        const expected: FirstPlanWizardCursor = inputCursor.section === "review"
          ? { section: "review", question: "title" }
          : {
              section: inputCursor.section,
              question: inputCursor.question,
              ...(inputCursor.index !== undefined ? { index: inputCursor.index } : {}),
              ...(inputCursor.returnToReview ? { returnToReview: true } : {}),
            };

        expect(parsed).toEqual(expected);
      }
    }
  });
});

describe("CHALLENGE 2: Adversarial & Path Parsing Analysis", () => {
  it("documents parseWizardCursor behavior on arbitrary pathnames", () => {
    // Empty path or root path defaults to basic
    expect(parseWizardCursor(new URLSearchParams(), "")).toEqual({ section: "basic", question: "title" });
    expect(parseWizardCursor(new URLSearchParams(), "/")).toEqual({ section: "basic", question: "title" });

    // Path ending with /plans/new becomes review
    expect(parseWizardCursor(new URLSearchParams(), "/trips/t1/plans/new")).toEqual({
      section: "review",
      question: "title",
    });
    // Path ending with /plans/new/ (trailing slash) also resolves to review
    expect(parseWizardCursor(new URLSearchParams(), "/trips/t1/plans/new/")).toEqual({
      section: "review",
      question: "title",
    });

    // Valid section paths
    expect(parseWizardCursor(new URLSearchParams(), "/trips/t1/plans/new/route")).toEqual({
      section: "route",
      question: "city",
      index: 0,
    });
  });

  it("handles adversarial searchParams (SQL injection, negative index, floats, NaN, huge numbers)", () => {
    // Malicious or corrupted questions
    const badQuestions = ["' OR '1'='1", "<script>alert(1)</script>", "DROP TABLE plans;", "null", "undefined", ""];
    for (const badQ of badQuestions) {
      const cursor = parseWizardCursor(new URLSearchParams(`question=${encodeURIComponent(badQ)}`), "/trips/t1/plans/new/route");
      expect(cursor.question).toBe("city"); // Falls back to default route question
    }

    // Negative / malformed indices
    expect(parseWizardCursor(new URLSearchParams("index=-1"), "/trips/t1/plans/new/route").index).toBe(0);
    expect(parseWizardCursor(new URLSearchParams("index=-999999"), "/trips/t1/plans/new/route").index).toBe(0);
    expect(parseWizardCursor(new URLSearchParams("index=abc"), "/trips/t1/plans/new/route").index).toBe(0);
    expect(parseWizardCursor(new URLSearchParams("index=1.5"), "/trips/t1/plans/new/route").index).toBe(0);
    expect(parseWizardCursor(new URLSearchParams("index=0005"), "/trips/t1/plans/new/route").index).toBe(5);

    // Boolean returnToReview variations
    expect(parseWizardCursor(new URLSearchParams("returnToReview=false"), "/trips/t1/plans/new/basic").returnToReview).toBeUndefined();
    expect(parseWizardCursor(new URLSearchParams("returnToReview=0"), "/trips/t1/plans/new/basic").returnToReview).toBeUndefined();
    expect(parseWizardCursor(new URLSearchParams("returnToReview=true"), "/trips/t1/plans/new/basic").returnToReview).toBe(true);
  });

  it("normalizes extreme, negative, and invalid cursor indices and sections", () => {
    const formData = createHarnessFormData();

    // Out of bounds clamping
    expect(normalizeWizardCursor({ section: "route", question: "city", index: -100 }, formData).index).toBe(0);
    expect(normalizeWizardCursor({ section: "route", question: "city", index: 999999 }, formData).index).toBe(1);
    expect(normalizeWizardCursor({ section: "transport", question: "endpoints", index: 999999 }, formData).index).toBe(2);

    // Empty object
    expect(normalizeWizardCursor({}, formData)).toEqual({ section: "basic", question: "title" });

    // Undefined section / question
    expect(normalizeWizardCursor({ section: undefined, question: undefined }, formData)).toEqual({
      section: "basic",
      question: "title",
    });

    // NaN / Infinity indices
    expect(normalizeWizardCursor({ section: "route", question: "city", index: NaN }, formData).index).toBe(0);
  });
});

describe("CHALLENGE 3: Unusual & Stress State Transitions", () => {
  it("handles empty routes array gracefully during transitions", () => {
    const emptyForm = createHarnessFormData({ routes: [], accommodations: [], transports: [] });

    // Normalizing accommodation / transport on empty form redirects to route city 0
    expect(normalizeWizardCursor({ section: "accommodation", question: "status", index: 0 }, emptyForm))
      .toEqual({ section: "route", question: "city", index: 0 });
    expect(normalizeWizardCursor({ section: "transport", question: "endpoints", index: 0 }, emptyForm))
      .toEqual({ section: "route", question: "city", index: 0 });

    // Step next from headcount on empty form goes to route city 0
    const fromHeadcount = getNextWizardCursor({ section: "basic", question: "headcount" }, emptyForm);
    expect(fromHeadcount).toEqual({ section: "route", question: "city", index: 0 });

    // Step prev from route city 0 goes to headcount
    const backToHeadcount = getPreviousWizardCursor({ section: "route", question: "city", index: 0 }, emptyForm);
    expect(backToHeadcount).toEqual({ section: "basic", question: "headcount" });
  });

  it("handles repeated city names without deduplication or collision (Tokyo -> Osaka -> Tokyo -> Fukuoka -> Tokyo)", () => {
    const repeatedCityForm = createHarnessFormData({
      routes: [
        { city: "도쿄", arrivalDate: "2026-10-01", departureDate: "2026-10-03" },
        { city: "오사카", arrivalDate: "2026-10-03", departureDate: "2026-10-05" },
        { city: "도쿄", arrivalDate: "2026-10-05", departureDate: "2026-10-07" },
        { city: "후쿠오카", arrivalDate: "2026-10-07", departureDate: "2026-10-09" },
        { city: "도쿄", arrivalDate: "2026-10-09", departureDate: "2026-10-11" },
      ],
      accommodations: [
        { id: "a1", city: "도쿄", period: "2026-10-01 ~ 2026-10-03", nights: 2, hotelName: "도쿄 호텔 1", isSearching: false, bookingStatus: "AVAILABLE" },
        { id: "a2", city: "오사카", period: "2026-10-03 ~ 2026-10-05", nights: 2, hotelName: "", isSearching: true, bookingStatus: "NOT_CHECKED" },
        { id: "a3", city: "도쿄", period: "2026-10-05 ~ 2026-10-07", nights: 2, hotelName: "도쿄 호텔 2", isSearching: false, bookingStatus: "AVAILABLE" },
        { id: "a4", city: "후쿠오카", period: "2026-10-07 ~ 2026-10-09", nights: 2, hotelName: "", isSearching: true, bookingStatus: "NOT_CHECKED" },
        { id: "a5", city: "도쿄", period: "2026-10-09 ~ 2026-10-11", nights: 2, hotelName: "도쿄 호텔 3", isSearching: false, bookingStatus: "AVAILABLE" },
      ],
      transports: [
        { id: "t1", fromCity: "인천", toCity: "도쿄", mode: "항공", hasTransfer: false, durationText: "2시간", bookingStatus: "AVAILABLE" },
        { id: "t2", fromCity: "도쿄", toCity: "오사카", mode: "", hasTransfer: false, durationText: "", bookingStatus: "NOT_CHECKED" },
        { id: "t3", fromCity: "오사카", toCity: "도쿄", mode: "신칸센", hasTransfer: false, durationText: "2시간 30분", bookingStatus: "AVAILABLE" },
        { id: "t4", fromCity: "도쿄", toCity: "후쿠오카", mode: "", hasTransfer: false, durationText: "", bookingStatus: "NOT_CHECKED" },
        { id: "t5", fromCity: "후쿠오카", toCity: "도쿄", mode: "", hasTransfer: false, durationText: "", bookingStatus: "NOT_CHECKED" },
        { id: "t6", fromCity: "도쿄", toCity: "인천", mode: "항공", hasTransfer: false, durationText: "2시간", bookingStatus: "AVAILABLE" },
      ],
    });

    // Verify syncAccommodationNights correctly maintains per-stop dates and nights for repeated cities
    const syncedAccs = syncAccommodationNights(repeatedCityForm.routes, repeatedCityForm.accommodations);
    expect(syncedAccs.length).toBe(5);
    expect(syncedAccs[0]?.nights).toBe(2);
    expect(syncedAccs[2]?.nights).toBe(2);
    expect(syncedAccs[4]?.nights).toBe(2);

    // Verify 5 distinct accommodation stops can be navigated sequentially
    let curr: FirstPlanWizardCursor = { section: "accommodation", question: "status", index: 0 };
    // Stop 0: decided -> hotel-name
    curr = getNextWizardCursor(curr, repeatedCityForm);
    expect(curr).toEqual({ section: "accommodation", question: "hotel-name", index: 0 });
    // Stop 0 -> Stop 1 (searching) -> skips hotel-name -> Stop 2
    curr = getNextWizardCursor(curr, repeatedCityForm);
    expect(curr).toEqual({ section: "accommodation", question: "status", index: 1 });
    curr = getNextWizardCursor(curr, repeatedCityForm);
    expect(curr).toEqual({ section: "accommodation", question: "status", index: 2 });
    // Stop 2: decided -> hotel-name -> Stop 3 (searching)
    curr = getNextWizardCursor(curr, repeatedCityForm);
    expect(curr).toEqual({ section: "accommodation", question: "hotel-name", index: 2 });
    curr = getNextWizardCursor(curr, repeatedCityForm);
    expect(curr).toEqual({ section: "accommodation", question: "status", index: 3 });
    // Stop 3 -> Stop 4 (decided) -> hotel-name -> Transport endpoints 0
    curr = getNextWizardCursor(curr, repeatedCityForm);
    expect(curr).toEqual({ section: "accommodation", question: "status", index: 4 });
    curr = getNextWizardCursor(curr, repeatedCityForm);
    expect(curr).toEqual({ section: "accommodation", question: "hotel-name", index: 4 });
    curr = getNextWizardCursor(curr, repeatedCityForm);
    expect(curr).toEqual({ section: "transport", question: "endpoints", index: 0 });
  });

  it("handles multi-leg date gaps seamlessly without blocking progression", () => {
    const multiGapForm = createHarnessFormData({
      routes: [
        { city: "파리", arrivalDate: "2026-10-01", departureDate: "2026-10-04" },
        { city: "로마", arrivalDate: "2026-10-10", departureDate: "2026-10-15" }, // 6-day gap
        { city: "바르셀로나", arrivalDate: "2026-11-01", departureDate: "2026-11-05" }, // 17-day gap
      ],
      accommodations: [
        { id: "a1", city: "파리", period: "2026-10-01 ~ 2026-10-04", nights: 3, hotelName: "파리 숙소", isSearching: false, bookingStatus: "AVAILABLE" },
        { id: "a2", city: "로마", period: "2026-10-10 ~ 2026-10-15", nights: 5, hotelName: "로마 숙소", isSearching: false, bookingStatus: "AVAILABLE" },
        { id: "a3", city: "바르셀로나", period: "2026-11-01 ~ 2026-11-05", nights: 4, hotelName: "바르셀로나 숙소", isSearching: false, bookingStatus: "AVAILABLE" },
      ],
      transports: [
        { id: "t1", fromCity: "인천", toCity: "파리", mode: "항공", hasTransfer: false, durationText: "12시간", bookingStatus: "AVAILABLE" },
        { id: "t2", fromCity: "파리", toCity: "로마", mode: "항공", hasTransfer: false, durationText: "2시간", bookingStatus: "AVAILABLE" },
        { id: "t3", fromCity: "로마", toCity: "바르셀로나", mode: "항공", hasTransfer: false, durationText: "2시간", bookingStatus: "AVAILABLE" },
        { id: "t4", fromCity: "바르셀로나", toCity: "인천", mode: "항공", hasTransfer: false, durationText: "12시간", bookingStatus: "AVAILABLE" },
      ],
    });

    const validationErrors = getPlanPublishValidationErrors(multiGapForm);
    expect(validationErrors).toEqual([]); // Date gaps are 100% valid in domain rules!

    // Verify transitions forward through all 3 stops
    let cursor: FirstPlanWizardCursor = { section: "route", question: "city", index: 0 };
    for (let i = 0; i < 3; i += 1) {
      expect(cursor).toEqual({ section: "route", question: "city", index: i });
      cursor = getNextWizardCursor(cursor, multiGapForm);
      expect(cursor).toEqual({ section: "route", question: "arrival-date", index: i });
      cursor = getNextWizardCursor(cursor, multiGapForm);
      expect(cursor).toEqual({ section: "route", question: "departure-date", index: i });
      cursor = getNextWizardCursor(cursor, multiGapForm);
      expect(cursor).toEqual({ section: "route", question: "add-city", index: i });
      cursor = getNextWizardCursor(cursor, multiGapForm);
    }
    expect(cursor).toEqual({ section: "accommodation", question: "status", index: 0 });
  });

  it("verifies strict bi-directional state traversal symmetry across entire wizard flow", () => {
    const complexForm = createHarnessFormData();

    // Walk forward from start to review and collect all visited states
    const forwardHistory: FirstPlanWizardCursor[] = [];
    let current: FirstPlanWizardCursor = { section: "basic", question: "title" };

    while (current.section !== "review") {
      forwardHistory.push(current);
      current = getNextWizardCursor(current, complexForm);
    }
    forwardHistory.push(current); // review/title

    expect(forwardHistory.length).toBeGreaterThan(10);

    // Step backward from review and verify each step
    let backwardCursor: FirstPlanWizardCursor = { section: "review", question: "title" };
    for (let i = forwardHistory.length - 1; i >= 0; i -= 1) {
      expect(backwardCursor).toEqual(forwardHistory[i]);
      if (i > 0) {
        backwardCursor = getPreviousWizardCursor(backwardCursor, complexForm);
      }
    }
    expect(backwardCursor).toEqual({ section: "basic", question: "title" });
  });
});

describe("CHALLENGE 4: mapValidationErrorToCursor Coverage", () => {
  const form = createHarnessFormData();

  it("correctly maps every domain error variation to the earliest corrective cursor", () => {
    // Basic title
    expect(mapValidationErrorToCursor("여행안 제목을 입력해주세요.", form))
      .toEqual({ section: "basic", question: "title" });

    // Headcount
    expect(mapValidationErrorToCursor("기준 인원수는 1명 이상이어야 합니다.", form))
      .toEqual({ section: "basic", question: "headcount" });

    // Zero routes
    expect(mapValidationErrorToCursor("최소 1개 이상의 방문 도시를 추가해주세요.", createHarnessFormData({ routes: [] })))
      .toEqual({ section: "route", question: "city", index: 0 });

    // Incomplete route fields
    const missingCityForm = createHarnessFormData({
      routes: [{ city: "", arrivalDate: "2026-10-01", departureDate: "2026-10-04" }],
    });
    expect(mapValidationErrorToCursor("도시의 도착일과 출발일을 입력해주세요.", missingCityForm))
      .toEqual({ section: "route", question: "city", index: 0 });

    const missingArrivalForm = createHarnessFormData({
      routes: [{ city: "도쿄", arrivalDate: "", departureDate: "2026-10-04" }],
    });
    expect(mapValidationErrorToCursor("도쿄의 도착일과 출발일을 입력해주세요.", missingArrivalForm))
      .toEqual({ section: "route", question: "arrival-date", index: 0 });

    const missingDepartureForm = createHarnessFormData({
      routes: [{ city: "도쿄", arrivalDate: "2026-10-01", departureDate: "" }],
    });
    expect(mapValidationErrorToCursor("도쿄의 도착일과 출발일을 입력해주세요.", missingDepartureForm))
      .toEqual({ section: "route", question: "departure-date", index: 0 });

    // Overlapping dates
    const overlapForm = createHarnessFormData({
      routes: [
        { city: "도쿄", arrivalDate: "2026-10-01", departureDate: "2026-10-06" },
        { city: "오사카", arrivalDate: "2026-10-04", departureDate: "2026-10-08" },
      ],
    });
    expect(mapValidationErrorToCursor("도시 체류 일정은 서로 겹칠 수 없습니다.", overlapForm))
      .toEqual({ section: "route", question: "arrival-date", index: 1 });

    // Missing accommodation hotelName
    const missingHotelForm = createHarnessFormData({
      accommodations: [
        { id: "a1", city: "도쿄", period: "2026-10-01 ~ 2026-10-04", nights: 3, hotelName: "", isSearching: false, bookingStatus: "AVAILABLE" },
      ],
    });
    expect(mapValidationErrorToCursor("각 방문 도시의 숙소 또는 숙소 찾는 중 상태를 추가해주세요.", missingHotelForm))
      .toEqual({ section: "accommodation", question: "hotel-name", index: 0 });

    // Transport count error
    expect(mapValidationErrorToCursor("출국·도시 간 이동·귀국 교통을 3개 추가해주세요.", createHarnessFormData({ transports: [] })))
      .toEqual({ section: "transport", question: "endpoints", index: 0 });

    // Transport incomplete mode / duration
    const missingTrModeForm = createHarnessFormData({
      transports: [
        { id: "t1", fromCity: "인천", toCity: "도쿄", mode: "", hasTransfer: false, durationText: "2시간", bookingStatus: "AVAILABLE" },
      ],
    });
    expect(mapValidationErrorToCursor("교통 구간의 출발지·도착지와 확인 상태를 입력해주세요.", missingTrModeForm))
      .toEqual({ section: "transport", question: "mode", index: 0 });

    const missingTrDurationForm = createHarnessFormData({
      transports: [
        { id: "t1", fromCity: "인천", toCity: "도쿄", mode: "항공", hasTransfer: false, durationText: "", bookingStatus: "AVAILABLE" },
      ],
    });
    expect(mapValidationErrorToCursor("교통 구간의 출발지·도착지와 확인 상태를 입력해주세요.", missingTrDurationForm))
      .toEqual({ section: "transport", question: "duration", index: 0 });

    // Unknown error fallback
    expect(mapValidationErrorToCursor("예상치 못한 서버 에러", form))
      .toEqual({ section: "basic", question: "title" });
  });
});

describe("CHALLENGE 5: StoredPlanEditorDraft & Compatibility Stress", () => {
  it("rejects malicious or corrupted stored drafts without throwing", () => {
    const corruptedPayloads = [
      null,
      "",
      "{",
      JSON.stringify({ ownerId: 123 }), // non-string ownerId
      JSON.stringify({ ownerId: "u1", title: 456 }), // non-string title
      JSON.stringify({ ownerId: "u1", title: "t", proposalReason: "", baseHeadcount: 0 }), // headcount < 1
      JSON.stringify({ ownerId: "u1", title: "t", proposalReason: "", baseHeadcount: 2, routes: "not-array" }),
      JSON.stringify({
        ownerId: "u1",
        title: "t",
        proposalReason: "",
        baseHeadcount: 2,
        routes: [],
        accommodations: [],
        transports: [],
        updatedAt: "2026-09-02T00:00:00Z",
        wizardCursor: { section: "hacked", question: "injection" }, // invalid section
      }),
      JSON.stringify({
        ownerId: "u1",
        title: "t",
        proposalReason: "",
        baseHeadcount: 2,
        routes: [],
        accommodations: [],
        transports: [],
        updatedAt: "2026-09-02T00:00:00Z",
        wizardCursor: { section: "basic", question: "title", index: -5 }, // negative index
      }),
    ];

    for (const payload of corruptedPayloads) {
      expect(parsePlanEditorDraft(payload)).toBeUndefined();
    }
  });

  it("handles storage write exceptions gracefully", () => {
    const failingStorage = {
      setItem: () => {
        throw new DOMException("QuotaExceededError");
      },
    };
    const validDraft: StoredPlanEditorDraft = {
      ownerId: "u1",
      title: "제주",
      proposalReason: "",
      baseHeadcount: 2,
      routes: [],
      accommodations: [],
      transports: [],
      updatedAt: "2026-09-02T00:00:00Z",
    };

    expect(savePlanEditorDraft(failingStorage, "test_key", validDraft)).toBe("ERROR");
  });
});
