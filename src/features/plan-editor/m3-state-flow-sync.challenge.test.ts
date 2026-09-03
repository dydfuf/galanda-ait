// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  FIRST_PLAN_WIZARD_QUESTIONS,
  FIRST_PLAN_WIZARD_SECTIONS,
  getNextWizardCursor,
  getPreviousWizardCursor,
  mapValidationErrorToCursor,
  normalizeWizardCursor,
  parseWizardCursor,
  type FirstPlanWizardCursor,
  type FirstPlanWizardQuestion,
} from "./first-plan-wizard-flow.ts";
import {
  getPlanEditorDraftKey,
  parsePlanEditorDraft,
  savePlanEditorDraft,
  syncAccommodationNights,
  usePlanEditorState,
  type PlanEditorFormData,
  type StoredPlanEditorDraft,
} from "./hooks/usePlanEditorState.ts";
import {
  getPlanPublishValidationErrors,
  type AccommodationSnapshot,
  type CityStay,
  type TripRoom,
} from "../../core/domain/room.ts";
import {
  ParticipantIdSchema,
  RevisionSchema,
  TripIdSchema,
} from "../../core/domain/ids.ts";

const createMockRoom = (overrides: Partial<TripRoom> = {}): TripRoom => ({
  id: TripIdSchema.make("room-m3-challenge"),
  title: "도쿄-오사카 챌린지 여행",
  destination: "일본",
  revision: RevisionSchema.make(1),
  members: [
    {
      id: ParticipantIdSchema.make("user-m3-alpha"),
      name: "알파",
      role: "HOST",
    },
    {
      id: ParticipantIdSchema.make("user-m3-beta"),
      name: "베타",
      role: "MEMBER",
    },
  ],
  plans: [],
  ...overrides,
});

const createSampleMultiStopFormData = (
  overrides: Partial<PlanEditorFormData> = {}
): PlanEditorFormData => ({
  title: "일본 골든루트 7박 8일",
  proposalReason: "도시와 힐링을 모두 즐기는 코스",
  baseHeadcount: 2,
  routes: [
    { city: "도쿄", arrivalDate: "2026-10-01", departureDate: "2026-10-04" },
    { city: "교토", arrivalDate: "2026-10-04", departureDate: "2026-10-06" },
    { city: "오사카", arrivalDate: "2026-10-06", departureDate: "2026-10-08" },
  ],
  accommodations: [
    {
      id: "acc-1",
      city: "도쿄",
      period: "2026-10-01 ~ 2026-10-04",
      nights: 3,
      hotelName: "도쿄 그랜드 호텔",
      isSearching: false,
      bookingStatus: "AVAILABLE",
    },
    {
      id: "acc-2",
      city: "교토",
      period: "2026-10-04 ~ 2026-10-06",
      nights: 2,
      hotelName: "",
      isSearching: true,
      bookingStatus: "NOT_CHECKED",
    },
    {
      id: "acc-3",
      city: "오사카",
      period: "2026-10-06 ~ 2026-10-08",
      nights: 2,
      hotelName: "난바 호텔",
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
      toCity: "교토",
      mode: "신칸센",
      hasTransfer: false,
      durationText: "2시간 15분",
      bookingStatus: "AVAILABLE",
    },
    {
      id: "tr-3",
      fromCity: "교토",
      toCity: "오사카",
      mode: "",
      hasTransfer: false,
      durationText: "",
      bookingStatus: "NOT_CHECKED",
    },
    {
      id: "tr-4",
      fromCity: "오사카",
      toCity: "인천",
      mode: "항공",
      hasTransfer: false,
      durationText: "1시간 50분",
      bookingStatus: "AVAILABLE",
    },
  ],
  ...overrides,
});

describe("M3.2 ADVERSARIAL CHALLENGE SUITE: State Management, Array Sync & Flow Navigation", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. ROUTE MUTATION & ACCOMMODATION / TRANSPORT SYNCHRONIZATION
  // =========================================================================
  describe("Dimension 1: Route Stop Mutations & Cross-Array Synchronization", () => {
    it("Dynamic addition of stops mid-flow updates route count and preserves previous accommodation data", () => {
      const room = createMockRoom();
      const { result } = renderHook(() =>
        usePlanEditorState(room, undefined, undefined, "user-m3-alpha")
      );

      // 1. Add first stop (도쿄)
      act(() => {
        result.current.handleAddCity("도쿄");
      });
      act(() => {
        result.current.handleUpdateCity(0, {
          arrivalDate: "2026-10-01",
          departureDate: "2026-10-04",
        });
      });
      expect(result.current.routes).toHaveLength(1);
      expect(result.current.totalTripNights).toBe(3);

      // 2. Add accommodation for 도쿄
      act(() => {
        result.current.handleAddAccommodation({
          id: "acc-tokyo",
          city: "도쿄",
          period: "2026-10-01 ~ 2026-10-04",
          nights: 3,
          hotelName: "도쿄 타워 호텔",
          isSearching: false,
          bookingStatus: "AVAILABLE",
        });
      });
      expect(result.current.accommodations).toHaveLength(1);
      expect(result.current.accommodations[0].hotelName).toBe("도쿄 타워 호텔");

      // 3. User goes back and adds a second stop (교토)
      act(() => {
        result.current.handleAddCity("교토");
      });
      act(() => {
        result.current.handleUpdateCity(1, {
          arrivalDate: "2026-10-04",
          departureDate: "2026-10-07",
        });
      });
      expect(result.current.routes).toHaveLength(2);
      expect(result.current.totalTripNights).toBe(6);

      // Verify accommodation for 도쿄 is preserved untouched
      expect(result.current.accommodations[0].city).toBe("도쿄");
      expect(result.current.accommodations[0].nights).toBe(3);
      expect(result.current.accommodations[0].hotelName).toBe("도쿄 타워 호텔");
      expect(result.current.accommodations[0].isSearching).toBe(false);
    });

    it("Repeated visits to the same city (Tokyo -> Kyoto -> Tokyo) synchronize nights accurately without cross-talk", () => {
      const routes: ReadonlyArray<CityStay> = [
        { city: "도쿄", arrivalDate: "2026-10-01", departureDate: "2026-10-03" }, // 2 nights
        { city: "교토", arrivalDate: "2026-10-04", departureDate: "2026-10-06" }, // 2 nights (1-day gap)
        { city: "도쿄", arrivalDate: "2026-10-06", departureDate: "2026-10-09" }, // 3 nights (revisit)
      ];

      const initialAccommodations: ReadonlyArray<AccommodationSnapshot> = [
        {
          id: "acc-1",
          city: "도쿄",
          period: "2026-10-01 ~ 2026-10-03",
          nights: 2,
          hotelName: "신주쿠 호텔",
          isSearching: false,
          bookingStatus: "AVAILABLE",
        },
        {
          id: "acc-2",
          city: "교토",
          period: "2026-10-04 ~ 2026-10-06",
          nights: 2,
          hotelName: "",
          isSearching: true,
          bookingStatus: "NOT_CHECKED",
        },
        {
          id: "acc-3",
          city: "도쿄",
          period: "2026-10-06 ~ 2026-10-08", // stale period
          nights: 2, // stale nights
          hotelName: "긴자 럭셔리 호텔",
          isSearching: false,
          bookingStatus: "AVAILABLE",
        },
      ];

      const synced = syncAccommodationNights(routes, initialAccommodations);

      expect(synced).toHaveLength(3);
      // First Tokyo stay
      expect(synced[0].city).toBe("도쿄");
      expect(synced[0].period).toBe("2026-10-01 ~ 2026-10-03");
      expect(synced[0].nights).toBe(2);
      expect(synced[0].hotelName).toBe("신주쿠 호텔");

      // Kyoto stay
      expect(synced[1].city).toBe("교토");
      expect(synced[1].period).toBe("2026-10-04 ~ 2026-10-06");
      expect(synced[1].nights).toBe(2);
      expect(synced[1].isSearching).toBe(true);

      // Second Tokyo stay updated to 3 nights without altering hotelName
      expect(synced[2].city).toBe("도쿄");
      expect(synced[2].period).toBe("2026-10-06 ~ 2026-10-09");
      expect(synced[2].nights).toBe(3);
      expect(synced[2].hotelName).toBe("긴자 럭셔리 호텔");
    });

    it("Mid-flow deletion of route stops clamps cursor and prevents out-of-range indexing", () => {
      const form = createSampleMultiStopFormData(); // 3 routes (indices 0, 1, 2), 4 transports (indices 0, 1, 2, 3)

      // Cursor at route 2 (오사카)
      const routeCursor: FirstPlanWizardCursor = {
        section: "route",
        question: "city",
        index: 2,
      };

      // Form with route 2 deleted (now only 2 routes: 0, 1)
      const formAfterDelete: PlanEditorFormData = {
        ...form,
        routes: form.routes.slice(0, 2),
      };

      const normalizedRoute = normalizeWizardCursor(routeCursor, formAfterDelete);
      expect(normalizedRoute.section).toBe("route");
      expect(normalizedRoute.index).toBe(1); // clamped to maxRouteIndex (1)

      // Cursor at transport 3 (4th leg)
      const transportCursor: FirstPlanWizardCursor = {
        section: "transport",
        question: "duration",
        index: 3,
      };

      // With 2 routes, total transport legs is 3 (max index = 2)
      const normalizedTransport = normalizeWizardCursor(transportCursor, formAfterDelete);
      expect(normalizedTransport.section).toBe("transport");
      expect(normalizedTransport.index).toBe(2); // clamped to maxTransportIndex (2)
    });

    it("Deleting all route stops normalizes accommodation and transport sections back to route", () => {
      const emptyRouteForm: PlanEditorFormData = {
        ...createSampleMultiStopFormData(),
        routes: [],
      };

      const accCursor: FirstPlanWizardCursor = {
        section: "accommodation",
        question: "status",
        index: 0,
      };
      const normalizedAcc = normalizeWizardCursor(accCursor, emptyRouteForm);
      expect(normalizedAcc.section).toBe("route");
      expect(normalizedAcc.question).toBe("city");
      expect(normalizedAcc.index).toBe(0);

      const trCursor: FirstPlanWizardCursor = {
        section: "transport",
        question: "endpoints",
        index: 0,
      };
      const normalizedTr = normalizeWizardCursor(trCursor, emptyRouteForm);
      expect(normalizedTr.section).toBe("route");
      expect(normalizedTr.question).toBe("city");
      expect(normalizedTr.index).toBe(0);
    });

    it("Transport N+1 sequence step-by-step traversal for 3 routes matches exactly 4 transport legs", () => {
      const form = createSampleMultiStopFormData(); // 3 routes -> 4 legs

      let cursor: FirstPlanWizardCursor = {
        section: "transport",
        question: "endpoints",
        index: 0,
      };

      // Leg 0: 인천 -> 도쿄 (AVAILABLE)
      cursor = getNextWizardCursor(cursor, form);
      expect(cursor).toEqual({ section: "transport", question: "status", index: 0 });
      cursor = getNextWizardCursor(cursor, form);
      expect(cursor).toEqual({ section: "transport", question: "mode", index: 0 });
      cursor = getNextWizardCursor(cursor, form);
      expect(cursor).toEqual({ section: "transport", question: "duration", index: 0 });

      // Move to Leg 1: 도쿄 -> 교토 (AVAILABLE)
      cursor = getNextWizardCursor(cursor, form);
      expect(cursor).toEqual({ section: "transport", question: "endpoints", index: 1 });
      cursor = getNextWizardCursor(cursor, form);
      expect(cursor).toEqual({ section: "transport", question: "status", index: 1 });
      cursor = getNextWizardCursor(cursor, form);
      expect(cursor).toEqual({ section: "transport", question: "mode", index: 1 });
      cursor = getNextWizardCursor(cursor, form);
      expect(cursor).toEqual({ section: "transport", question: "duration", index: 1 });

      // Move to Leg 2: 교토 -> 오사카 (NOT_CHECKED)
      cursor = getNextWizardCursor(cursor, form);
      expect(cursor).toEqual({ section: "transport", question: "endpoints", index: 2 });
      cursor = getNextWizardCursor(cursor, form);
      expect(cursor).toEqual({ section: "transport", question: "status", index: 2 });
      // Because Leg 2 is NOT_CHECKED, getNextWizardCursor skips mode and duration and advances to Leg 3!
      cursor = getNextWizardCursor(cursor, form);
      expect(cursor).toEqual({ section: "transport", question: "endpoints", index: 3 });

      // Move to Leg 3: 오사카 -> 인천 (AVAILABLE, Last Leg)
      cursor = getNextWizardCursor(cursor, form);
      expect(cursor).toEqual({ section: "transport", question: "status", index: 3 });
      cursor = getNextWizardCursor(cursor, form);
      expect(cursor).toEqual({ section: "transport", question: "mode", index: 3 });
      cursor = getNextWizardCursor(cursor, form);
      expect(cursor).toEqual({ section: "transport", question: "duration", index: 3 });

      // Last leg duration -> advances to Review
      cursor = getNextWizardCursor(cursor, form);
      expect(cursor).toEqual({ section: "review", question: "title" });
    });

    it("Backward traversal through N+1 transport legs correctly handles skipped NOT_CHECKED legs", () => {
      const form = createSampleMultiStopFormData(); // Leg 2 is NOT_CHECKED

      // Start at Review
      let cursor: FirstPlanWizardCursor = { section: "review", question: "title" };

      // Previous from Review -> Leg 3 duration (because Leg 3 is AVAILABLE)
      cursor = getPreviousWizardCursor(cursor, form);
      expect(cursor).toEqual({ section: "transport", question: "duration", index: 3 });

      cursor = getPreviousWizardCursor(cursor, form);
      expect(cursor).toEqual({ section: "transport", question: "mode", index: 3 });

      cursor = getPreviousWizardCursor(cursor, form);
      expect(cursor).toEqual({ section: "transport", question: "status", index: 3 });

      cursor = getPreviousWizardCursor(cursor, form);
      expect(cursor).toEqual({ section: "transport", question: "endpoints", index: 3 });

      // Previous from Leg 3 endpoints -> Leg 2 status (because Leg 2 was NOT_CHECKED, skipping mode/duration)
      cursor = getPreviousWizardCursor(cursor, form);
      expect(cursor).toEqual({ section: "transport", question: "status", index: 2 });

      cursor = getPreviousWizardCursor(cursor, form);
      expect(cursor).toEqual({ section: "transport", question: "endpoints", index: 2 });

      // Previous from Leg 2 endpoints -> Leg 1 duration (because Leg 1 was AVAILABLE)
      cursor = getPreviousWizardCursor(cursor, form);
      expect(cursor).toEqual({ section: "transport", question: "duration", index: 1 });
    });
  });

  // =========================================================================
  // 2. OUT-OF-BOUNDS URL CURSOR NAVIGATION & NORMALIZATION
  // =========================================================================
  describe("Dimension 2: Adversarial URL Cursors & Boundary Normalization", () => {
    const form = createSampleMultiStopFormData(); // routes: 3 (max idx 2), transports: 4 (max idx 3)

    it("Clamps out-of-bounds indices for all question types without throwing", () => {
      const extremeIndices = [-999999, -1, 0, 1, 2, 3, 4, 10, 999999];

      for (const idx of extremeIndices) {
        // Route questions
        const normRoute = normalizeWizardCursor(
          { section: "route", question: "city", index: idx },
          form
        );
        expect(normRoute.index).toBeGreaterThanOrEqual(0);
        expect(normRoute.index).toBeLessThanOrEqual(2);

        // Accommodation questions
        const normAcc = normalizeWizardCursor(
          { section: "accommodation", question: "status", index: idx },
          form
        );
        expect(normAcc.index).toBeGreaterThanOrEqual(0);
        expect(normAcc.index).toBeLessThanOrEqual(2);

        // Transport questions
        const normTr = normalizeWizardCursor(
          { section: "transport", question: "endpoints", index: idx },
          form
        );
        expect(normTr.index).toBeGreaterThanOrEqual(0);
        expect(normTr.index).toBeLessThanOrEqual(3);
      }
    });

    it("Normalizes invalid questions within each section to section defaults", () => {
      // Basic with route question
      const normBasic = normalizeWizardCursor(
        { section: "basic", question: "city" as FirstPlanWizardQuestion },
        form
      );
      expect(normBasic.section).toBe("basic");
      expect(normBasic.question).toBe("title");
      expect(normBasic.index).toBeUndefined();

      // Route with accommodation question
      const normRoute = normalizeWizardCursor(
        { section: "route", question: "hotel-name" as FirstPlanWizardQuestion, index: 1 },
        form
      );
      expect(normRoute.section).toBe("route");
      expect(normRoute.question).toBe("city");
      expect(normRoute.index).toBe(1);

      // Accommodation with transport question
      const normAcc = normalizeWizardCursor(
        { section: "accommodation", question: "endpoints" as FirstPlanWizardQuestion, index: 2 },
        form
      );
      expect(normAcc.section).toBe("accommodation");
      expect(normAcc.question).toBe("status");
      expect(normAcc.index).toBe(2);

      // Transport with basic question
      const normTr = normalizeWizardCursor(
        { section: "transport", question: "headcount" as FirstPlanWizardQuestion, index: 2 },
        form
      );
      expect(normTr.section).toBe("transport");
      expect(normTr.question).toBe("endpoints");
      expect(normTr.index).toBe(2);
    });

    it("Enforces business invariant: accommodation hotel-name normalizes to status when isSearching is true", () => {
      // Accommodation 1 (교토) has isSearching: true
      const norm = normalizeWizardCursor(
        { section: "accommodation", question: "hotel-name", index: 1 },
        form
      );
      expect(norm.question).toBe("status");
      expect(norm.index).toBe(1);

      // Accommodation 0 (도쿄) has isSearching: false
      const normDecided = normalizeWizardCursor(
        { section: "accommodation", question: "hotel-name", index: 0 },
        form
      );
      expect(normDecided.question).toBe("hotel-name");
      expect(normDecided.index).toBe(0);
    });

    it("Enforces business invariant: transport mode/duration normalizes to status when bookingStatus is NOT_CHECKED", () => {
      // Transport 2 (교토 -> 오사카) is NOT_CHECKED
      const normMode = normalizeWizardCursor(
        { section: "transport", question: "mode", index: 2 },
        form
      );
      expect(normMode.question).toBe("status");
      expect(normMode.index).toBe(2);

      const normDuration = normalizeWizardCursor(
        { section: "transport", question: "duration", index: 2 },
        form
      );
      expect(normDuration.question).toBe("status");
      expect(normDuration.index).toBe(2);

      // Transport 0 (인천 -> 도쿄) is AVAILABLE
      const normAvailableMode = normalizeWizardCursor(
        { section: "transport", question: "mode", index: 0 },
        form
      );
      expect(normAvailableMode.question).toBe("mode");
      expect(normAvailableMode.index).toBe(0);
    });

    it("parseWizardCursor safely handles arbitrary query string attacks", () => {
      const attackParams = [
        new URLSearchParams("question=__proto__&index=NaN"),
        new URLSearchParams("question=constructor&index=99999999999999999999"),
        new URLSearchParams("question=null&index=-1&returnToReview=1"),
        new URLSearchParams("question=<script>alert(1)</script>&index=0x10"),
        new URLSearchParams("index=Infinity"),
      ];

      for (const params of attackParams) {
        const parsed = parseWizardCursor(params, "/trips/t1/plans/new/route");
        expect(FIRST_PLAN_WIZARD_SECTIONS).toContain(parsed.section);
        expect(FIRST_PLAN_WIZARD_QUESTIONS).toContain(parsed.question);
        if (parsed.index !== undefined) {
          expect(Number.isInteger(parsed.index)).toBe(true);
          expect(parsed.index).toBeGreaterThanOrEqual(0);
        }
      }
    });
  });

  // =========================================================================
  // 3. RETURN-TO-REVIEW MODE (returnToReview: true)
  // =========================================================================
  describe("Dimension 3: Return-to-Review Mode Transition & Navigation Integrity", () => {
    const form = createSampleMultiStopFormData();

    it("Basic info questions return immediately to Review on Next", () => {
      const basicQuestions: ReadonlyArray<FirstPlanWizardQuestion> = [
        "title",
        "proposal-reason",
        "headcount",
      ];

      for (const q of basicQuestions) {
        const cursor: FirstPlanWizardCursor = {
          section: "basic",
          question: q,
          returnToReview: true,
        };
        const next = getNextWizardCursor(cursor, form);
        expect(next).toEqual({ section: "review", question: "title" });
      }
    });

    it("Route section in returnToReview mode executes city -> arrival-date -> departure-date -> review (skipping add-city)", () => {
      let cursor: FirstPlanWizardCursor = {
        section: "route",
        question: "city",
        index: 1,
        returnToReview: true,
      };

      // City -> Arrival Date
      cursor = getNextWizardCursor(cursor, form);
      expect(cursor).toEqual({
        section: "route",
        question: "arrival-date",
        index: 1,
        returnToReview: true,
      });

      // Arrival Date -> Departure Date
      cursor = getNextWizardCursor(cursor, form);
      expect(cursor).toEqual({
        section: "route",
        question: "departure-date",
        index: 1,
        returnToReview: true,
      });

      // Departure Date -> Directly to Review! (Skips add-city)
      cursor = getNextWizardCursor(cursor, form);
      expect(cursor).toEqual({ section: "review", question: "title" });
    });

    it("Accommodation in returnToReview mode routes to hotel-name only if decided, else returns directly to Review", () => {
      // 1. Decided Accommodation (index 0 - 도쿄)
      let cursor: FirstPlanWizardCursor = {
        section: "accommodation",
        question: "status",
        index: 0,
        returnToReview: true,
      };
      // Status -> Hotel Name
      cursor = getNextWizardCursor(cursor, form);
      expect(cursor).toEqual({
        section: "accommodation",
        question: "hotel-name",
        index: 0,
        returnToReview: true,
      });
      // Hotel Name -> Review
      cursor = getNextWizardCursor(cursor, form);
      expect(cursor).toEqual({ section: "review", question: "title" });

      // 2. Searching Accommodation (index 1 - 교토)
      let searchingCursor: FirstPlanWizardCursor = {
        section: "accommodation",
        question: "status",
        index: 1,
        returnToReview: true,
      };
      // Status -> Directly to Review!
      searchingCursor = getNextWizardCursor(searchingCursor, form);
      expect(searchingCursor).toEqual({ section: "review", question: "title" });
    });

    it("Transport in returnToReview mode branches correctly on booking status", () => {
      // 1. Available Transport (index 0: 인천 -> 도쿄)
      let cursor: FirstPlanWizardCursor = {
        section: "transport",
        question: "endpoints",
        index: 0,
        returnToReview: true,
      };
      cursor = getNextWizardCursor(cursor, form);
      expect(cursor).toEqual({ section: "transport", question: "status", index: 0, returnToReview: true });
      cursor = getNextWizardCursor(cursor, form);
      expect(cursor).toEqual({ section: "transport", question: "mode", index: 0, returnToReview: true });
      cursor = getNextWizardCursor(cursor, form);
      expect(cursor).toEqual({ section: "transport", question: "duration", index: 0, returnToReview: true });
      cursor = getNextWizardCursor(cursor, form);
      expect(cursor).toEqual({ section: "review", question: "title" });

      // 2. Not Checked Transport (index 2: 교토 -> 오사카)
      let notCheckedCursor: FirstPlanWizardCursor = {
        section: "transport",
        question: "endpoints",
        index: 2,
        returnToReview: true,
      };
      notCheckedCursor = getNextWizardCursor(notCheckedCursor, form);
      expect(notCheckedCursor).toEqual({ section: "transport", question: "status", index: 2, returnToReview: true });
      // Status -> Directly to Review!
      notCheckedCursor = getNextWizardCursor(notCheckedCursor, form);
      expect(notCheckedCursor).toEqual({ section: "review", question: "title" });
    });

    it("Previous button from any question in returnToReview mode returns immediately to Review", () => {
      const testCursors: ReadonlyArray<FirstPlanWizardCursor> = [
        { section: "basic", question: "title", returnToReview: true },
        { section: "basic", question: "headcount", returnToReview: true },
        { section: "route", question: "arrival-date", index: 1, returnToReview: true },
        { section: "route", question: "departure-date", index: 2, returnToReview: true },
        { section: "accommodation", question: "hotel-name", index: 0, returnToReview: true },
        { section: "transport", question: "mode", index: 0, returnToReview: true },
        { section: "transport", question: "duration", index: 3, returnToReview: true },
      ];

      for (const c of testCursors) {
        const prev = getPreviousWizardCursor(c, form);
        expect(prev).toEqual({ section: "review", question: "title" });
      }
    });

    it("Validation error targeting specific section seamlessly integrates with returnToReview", () => {
      // Form missing accommodation hotel name at index 0
      const invalidForm: PlanEditorFormData = {
        ...form,
        accommodations: [
          { ...form.accommodations[0]!, hotelName: "", isSearching: false },
          form.accommodations[1]!,
          form.accommodations[2]!,
        ],
      };

      const errors = getPlanPublishValidationErrors(invalidForm);
      expect(errors.length).toBeGreaterThan(0);

      const targetCursor = mapValidationErrorToCursor(errors[0]!, invalidForm);
      expect(targetCursor).toEqual({
        section: "accommodation",
        question: "hotel-name",
        index: 0,
      });

      // Jump from review with returnToReview: true
      const reviewJumpCursor: FirstPlanWizardCursor = {
        ...targetCursor,
        returnToReview: true,
      };

      // Fixing the hotelName and pressing Next returns to Review
      const fixedForm: PlanEditorFormData = {
        ...invalidForm,
        accommodations: [
          { ...invalidForm.accommodations[0]!, hotelName: "도쿄 신주쿠 호텔" },
          invalidForm.accommodations[1]!,
          invalidForm.accommodations[2]!,
        ],
      };

      const next = getNextWizardCursor(reviewJumpCursor, fixedForm);
      expect(next).toEqual({ section: "review", question: "title" });
    });
  });

  // =========================================================================
  // 4. DRAFT PERSISTENCE WITH WIZARD CURSOR & CORRUPTION RESILIENCE
  // =========================================================================
  describe("Dimension 4: Draft Persistence, wizardCursor Roundtrip & Storage Resilience", () => {
    const validDraft: StoredPlanEditorDraft = {
      ownerId: "user-m3-alpha",
      title: "오사카 식도락 3박 4일",
      proposalReason: "맛집 탐방",
      baseHeadcount: 4,
      routes: [
        { city: "오사카", arrivalDate: "2026-11-01", departureDate: "2026-11-04" },
      ],
      accommodations: [
        {
          id: "acc-1",
          city: "오사카",
          period: "2026-11-01 ~ 2026-11-04",
          nights: 3,
          hotelName: "도톤보리 호텔",
          isSearching: false,
          bookingStatus: "AVAILABLE",
        },
      ],
      transports: [
        {
          id: "tr-1",
          fromCity: "인천",
          toCity: "오사카",
          mode: "항공",
          hasTransfer: false,
          durationText: "1시간 40분",
          bookingStatus: "AVAILABLE",
        },
        {
          id: "tr-2",
          fromCity: "오사카",
          toCity: "인천",
          mode: "항공",
          hasTransfer: false,
          durationText: "1시간 40분",
          bookingStatus: "AVAILABLE",
        },
      ],
      updatedAt: "2026-09-02T15:00:00.000Z",
      wizardCursor: {
        section: "transport",
        question: "mode",
        index: 1,
        returnToReview: true,
      },
    };

    it("Serializes and parses drafts with wizardCursor perfectly", () => {
      const key = "test_draft_key";
      const status = savePlanEditorDraft(localStorage, key, validDraft);
      expect(status).toBe("SAVED");

      const retrieved = parsePlanEditorDraft(localStorage.getItem(key));
      expect(retrieved).toBeDefined();
      expect(retrieved?.wizardCursor).toEqual({
        section: "transport",
        question: "mode",
        index: 1,
        returnToReview: true,
      });
      expect(retrieved?.title).toBe("오사카 식도락 3박 4일");
    });

    it("Legacy draft without wizardCursor parses cleanly and retains backward compatibility", () => {
      const { wizardCursor: _, ...legacyDraft } = validDraft;
      const key = "legacy_draft_key";
      savePlanEditorDraft(localStorage, key, legacyDraft as StoredPlanEditorDraft);

      const parsed = parsePlanEditorDraft(localStorage.getItem(key));
      expect(parsed).toBeDefined();
      expect(parsed?.wizardCursor).toBeUndefined();
      expect(parsed?.title).toBe("오사카 식도락 3박 4일");
    });

    it("Fuzzing & Corruption Suite: Corrupted or invalid wizardCursor safely rejects invalid draft without throwing", () => {
      const invalidCursorPayloads = [
        { section: "unknown_section", question: "title" },
        { section: "route", question: "unknown_question" },
        { section: "route", question: "city", index: -1 },
        { section: "route", question: "city", index: 1.5 },
        { section: "route", question: "city", index: "0" },
        { section: "route", question: "city", returnToReview: "true" },
        { section: "route", question: "city", returnToReview: 1 },
        null,
        "string-cursor",
        12345,
        [],
      ];

      for (const badCursor of invalidCursorPayloads) {
        const corruptDraft = {
          ...validDraft,
          wizardCursor: badCursor,
        };
        const raw = JSON.stringify(corruptDraft);
        const result = parsePlanEditorDraft(raw);
        expect(result).toBeUndefined();
      }
    });

    it("Handles storage write failure (e.g. QuotaExceededError) gracefully with ERROR status", () => {
      const failingStorage = {
        setItem: () => {
          throw new Error("QuotaExceededError");
        },
      };

      const status = savePlanEditorDraft(failingStorage, "key", validDraft);
      expect(status).toBe("ERROR");
    });

    it("usePlanEditorState automatically hydrates savedWizardCursor from localStorage and updates on cursor change", async () => {
      const room = createMockRoom();
      const draftKey = getPlanEditorDraftKey("user-m3-alpha", room.id, "new");
      localStorage.setItem(draftKey, JSON.stringify(validDraft));

      const { result, rerender } = renderHook(
        ({ cursor }: { cursor?: FirstPlanWizardCursor }) =>
          usePlanEditorState(
            room,
            undefined,
            undefined,
            "user-m3-alpha",
            false,
            cursor
          ),
        {
          initialProps: { cursor: validDraft.wizardCursor },
        }
      );

      // Hydration
      expect(result.current.isDraftHydrated).toBe(true);
      expect(result.current.title).toBe("오사카 식도락 3박 4일");
      expect(result.current.savedWizardCursor).toEqual({
        section: "transport",
        question: "mode",
        index: 1,
        returnToReview: true,
      });

      // Update cursor to route city 0
      const newCursor: FirstPlanWizardCursor = {
        section: "route",
        question: "city",
        index: 0,
      };

      rerender({ cursor: newCursor });

      // Verify draft auto-saves updated cursor
      const updatedStored = parsePlanEditorDraft(localStorage.getItem(draftKey));
      expect(updatedStored?.wizardCursor).toEqual(newCursor);
    });

    it("Discarding draft removes savedWizardCursor and clears localStorage item", () => {
      const room = createMockRoom();
      const draftKey = getPlanEditorDraftKey("user-m3-alpha", room.id, "new");
      localStorage.setItem(draftKey, JSON.stringify(validDraft));

      const { result } = renderHook(() =>
        usePlanEditorState(room, undefined, undefined, "user-m3-alpha")
      );

      expect(result.current.savedWizardCursor).toBeDefined();

      act(() => {
        result.current.discardDraft();
      });

      expect(result.current.savedWizardCursor).toBeUndefined();
      expect(localStorage.getItem(draftKey)).toBeNull();
    });
  });
});
