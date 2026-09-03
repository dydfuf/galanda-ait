// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getPlanEditorDraftKey,
  parsePlanEditorDraft,
  usePlanEditorState,
  type PlanEditorFormData,
  type StoredPlanEditorDraft,
} from "./usePlanEditorState.ts";
import type { TripPlan, TripRoom } from "../../../core/domain/room.ts";
import {
  ParticipantIdSchema,
  PlanIdSchema,
  RevisionSchema,
  TripIdSchema,
} from "../../../core/domain/ids.ts";
import type { FirstPlanWizardCursor } from "../first-plan-wizard-flow.ts";

const validBaseDraft: StoredPlanEditorDraft = {
  ownerId: "user-alpha",
  basePlanFingerprint: undefined,
  title: "제주도 3박 4일 힐링",
  proposalReason: "여유로운 힐링 여행",
  baseHeadcount: 3,
  routes: [
    { city: "제주", arrivalDate: "2026-10-10", departureDate: "2026-10-12" },
    { city: "서귀포", arrivalDate: "2026-10-12", departureDate: "2026-10-14" },
  ],
  accommodations: [
    {
      id: "acc-1",
      city: "제주",
      period: "2026-10-10 ~ 2026-10-12",
      nights: 2,
      hotelName: "신라스테이 제주",
      isSearching: false,
      bookingStatus: "AVAILABLE",
      priceRange: { min: 200000, max: 300000 },
    },
    {
      id: "acc-2",
      city: "서귀포",
      period: "2026-10-12 ~ 2026-10-14",
      nights: 2,
      hotelName: "",
      isSearching: true,
      bookingStatus: "NOT_CHECKED",
      priceRange: { min: 0, max: 0 },
    },
  ],
  transports: [
    {
      id: "trans-1",
      fromCity: "김포",
      toCity: "제주",
      mode: "항공",
      hasTransfer: false,
      durationText: "1시간 10분",
      bookingStatus: "AVAILABLE",
      priceRange: { min: 100000, max: 150000 },
    },
    {
      id: "trans-2",
      fromCity: "제주",
      toCity: "서귀포",
      mode: "렌터카",
      hasTransfer: false,
      durationText: "1시간",
      bookingStatus: "NEED_CHECK",
      priceRange: { min: 50000, max: 80000 },
    },
    {
      id: "trans-3",
      fromCity: "서귀포",
      toCity: "김포",
      mode: "항공",
      hasTransfer: false,
      durationText: "1시간 10분",
      bookingStatus: "AVAILABLE",
      priceRange: { min: 100000, max: 150000 },
    },
  ],
  updatedAt: "2026-09-02T12:00:00.000Z",
  wizardCursor: {
    section: "accommodation",
    question: "status",
    index: 1,
    returnToReview: false,
  },
};

describe("Adversarial & Stress Tests: parsePlanEditorDraft", () => {
  it("Fuzzing / Corrupted inputs return undefined instead of throwing", () => {
    const corruptCases = [
      null,
      "",
      "undefined",
      "null",
      "[]",
      "123",
      "true",
      "{",
      '{"ownerId":',
      JSON.stringify(null),
      JSON.stringify("string"),
      JSON.stringify(123),
      JSON.stringify([]),
    ];

    for (const raw of corruptCases) {
      expect(parsePlanEditorDraft(raw as unknown as string)).toBeUndefined();
    }
  });

  it("Rejects drafts missing essential root fields", () => {
    const essentialFields = [
      "ownerId",
      "title",
      "proposalReason",
      "baseHeadcount",
      "routes",
      "accommodations",
      "transports",
      "updatedAt",
    ];

    for (const field of essentialFields) {
      const draft = { ...validBaseDraft };
      delete (draft as Record<string, unknown>)[field];
      expect(parsePlanEditorDraft(JSON.stringify(draft))).toBeUndefined();
    }
  });

  it("Boundary testing: headcount validation (< 1, float, NaN, Infinity, string)", () => {
    expect(parsePlanEditorDraft(JSON.stringify({ ...validBaseDraft, baseHeadcount: 0 }))).toBeUndefined();
    expect(parsePlanEditorDraft(JSON.stringify({ ...validBaseDraft, baseHeadcount: -1 }))).toBeUndefined();
    expect(parsePlanEditorDraft(JSON.stringify({ ...validBaseDraft, baseHeadcount: -999 }))).toBeUndefined();
    expect(parsePlanEditorDraft(JSON.stringify({ ...validBaseDraft, baseHeadcount: "4" }))).toBeUndefined();
    expect(parsePlanEditorDraft(JSON.stringify({ ...validBaseDraft, baseHeadcount: NaN }))).toBeUndefined();
    expect(parsePlanEditorDraft(JSON.stringify({ ...validBaseDraft, baseHeadcount: Infinity }))).toBeUndefined();

    // Valid headcount
    expect(parsePlanEditorDraft(JSON.stringify({ ...validBaseDraft, baseHeadcount: 1 }))).toBeDefined();
    expect(parsePlanEditorDraft(JSON.stringify({ ...validBaseDraft, baseHeadcount: 100 }))).toBeDefined();
  });

  it("Corrupted routes parsing and boundary validation", () => {
    const invalidRoutes = [
      "not an array",
      [null],
      [123],
      [{ city: 123, arrivalDate: "2026-10-10", departureDate: "2026-10-12" }],
      [{ city: "제주", arrivalDate: 123, departureDate: "2026-10-12" }],
      [{ city: "제주", arrivalDate: "2026-10-10", departureDate: null }],
      [{ city: "제주" }], // missing dates
    ];

    for (const r of invalidRoutes) {
      expect(parsePlanEditorDraft(JSON.stringify({ ...validBaseDraft, routes: r }))).toBeUndefined();
    }
  });

  it("Corrupted accommodations parsing and boundary validation", () => {
    const invalidAccommodations = [
      "not an array",
      [null],
      [{ id: 123, city: "제주", period: "p", nights: 1, hotelName: "", bookingStatus: "AVAILABLE" }],
      [{ id: "1", city: 123, period: "p", nights: 1, hotelName: "", bookingStatus: "AVAILABLE" }],
      [{ id: "1", city: "제주", period: 123, nights: 1, hotelName: "", bookingStatus: "AVAILABLE" }],
      [{ id: "1", city: "제주", period: "p", nights: "1", hotelName: "", bookingStatus: "AVAILABLE" }],
      [{ id: "1", city: "제주", period: "p", nights: 1, hotelName: 123, bookingStatus: "AVAILABLE" }],
      [{ id: "1", city: "제주", period: "p", nights: 1, hotelName: "", bookingStatus: "INVALID_STATUS" }],
      [{ id: "1", city: "제주", period: "p", nights: 1, hotelName: "", bookingStatus: "AVAILABLE", priceRange: "invalid" }],
      [{ id: "1", city: "제주", period: "p", nights: 1, hotelName: "", bookingStatus: "AVAILABLE", priceRange: { min: "0", max: 100 } }],
      [{ id: "1", city: "제주", period: "p", nights: 1, hotelName: "", bookingStatus: "AVAILABLE", isSearching: "true" }],
    ];

    for (const a of invalidAccommodations) {
      expect(parsePlanEditorDraft(JSON.stringify({ ...validBaseDraft, accommodations: a }))).toBeUndefined();
    }
  });

  it("Corrupted transports parsing and boundary validation", () => {
    const invalidTransports = [
      "not an array",
      [null],
      [{ id: "1", fromCity: 123, toCity: "제주", mode: "항공", hasTransfer: false, durationText: "1h", bookingStatus: "AVAILABLE" }],
      [{ id: "1", fromCity: "김포", toCity: null, mode: "항공", hasTransfer: false, durationText: "1h", bookingStatus: "AVAILABLE" }],
      [{ id: "1", fromCity: "김포", toCity: "제주", mode: 123, hasTransfer: false, durationText: "1h", bookingStatus: "AVAILABLE" }],
      [{ id: "1", fromCity: "김포", toCity: "제주", mode: "항공", hasTransfer: "false", durationText: "1h", bookingStatus: "AVAILABLE" }],
      [{ id: "1", fromCity: "김포", toCity: "제주", mode: "항공", hasTransfer: false, durationText: 123, bookingStatus: "AVAILABLE" }],
      [{ id: "1", fromCity: "김포", toCity: "제주", mode: "항공", hasTransfer: false, durationText: "1h", bookingStatus: "UNKNOWN_STATUS" }],
    ];

    for (const t of invalidTransports) {
      expect(parsePlanEditorDraft(JSON.stringify({ ...validBaseDraft, transports: t }))).toBeUndefined();
    }
  });

  it("Adversarial wizardCursor checks: malicious or corrupted cursors are safely rejected", () => {
    const maliciousCursors = [
      { section: "__proto__", question: "title" },
      { section: "constructor", question: "title" },
      { section: "basic", question: "__proto__" },
      { section: "basic", question: "toString" },
      { section: "basic", question: "title", index: -0.5 },
      { section: "basic", question: "title", index: -1 },
      { section: "basic", question: "title", index: 1.5 },
      { section: "basic", question: "title", index: "0" },
      { section: "basic", question: "title", index: NaN },
      { section: "basic", question: "title", index: Infinity },
      { section: "basic", question: "title", returnToReview: 1 },
      { section: "basic", question: "title", returnToReview: "false" },
      { section: "basic", question: "title", returnToReview: null },
      { section: 123, question: "title" },
      { section: "basic", question: 123 },
    ];

    for (const cursor of maliciousCursors) {
      const draft = { ...validBaseDraft, wizardCursor: cursor as unknown as FirstPlanWizardCursor };
      expect(parsePlanEditorDraft(JSON.stringify(draft))).toBeUndefined();
    }
  });

  it("Legacy draft compatibility: safely accepts draft without wizardCursor or basePlanFingerprint", () => {
    const legacyDraft: Record<string, unknown> = {
      ownerId: "user-alpha",
      title: "레거시 여행안",
      proposalReason: "설명",
      baseHeadcount: 2,
      routes: [],
      accommodations: [],
      transports: [],
      updatedAt: "2026-08-01T00:00:00.000Z",
    };

    const parsed = parsePlanEditorDraft(JSON.stringify(legacyDraft));
    expect(parsed).toBeDefined();
    expect(parsed?.title).toBe("레거시 여행안");
    expect(parsed?.wizardCursor).toBeUndefined();
    expect(parsed?.basePlanFingerprint).toBeUndefined();
    expect(parsed?.clonedFromPlanId).toBeUndefined();
  });
});

describe("Adversarial & Isolation Tests: usePlanEditorState Hook", () => {
  const mockRoom: TripRoom = {
    id: TripIdSchema.make("room-stress-1"),
    title: "스트레스 테스트 방",
    destination: "제주",
    revision: RevisionSchema.make(1),
    members: [
      { id: ParticipantIdSchema.make("user-alpha"), name: "Alpha", role: "HOST" },
      { id: ParticipantIdSchema.make("user-beta"), name: "Beta", role: "MEMBER" },
    ],
    plans: [],
  };

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("Strict User & Room Isolation: User A cannot read User B's draft or other Room's draft", () => {
    const userAKey = getPlanEditorDraftKey("user-alpha", "room-stress-1", "new");
    const userBKey = getPlanEditorDraftKey("user-beta", "room-stress-1", "new");

    const draftA: StoredPlanEditorDraft = {
      ...validBaseDraft,
      ownerId: "user-alpha",
      title: "알파의 비밀 여행",
    };
    const draftB: StoredPlanEditorDraft = {
      ...validBaseDraft,
      ownerId: "user-beta",
      title: "베타의 비밀 여행",
    };

    localStorage.setItem(userAKey, JSON.stringify(draftA));
    localStorage.setItem(userBKey, JSON.stringify(draftB));

    // Render hook for User Alpha
    const { result: resultAlpha } = renderHook(() =>
      usePlanEditorState(mockRoom, undefined, undefined, "user-alpha")
    );
    expect(resultAlpha.current.title).toBe("알파의 비밀 여행");
    expect(resultAlpha.current.savedWizardCursor).toEqual(validBaseDraft.wizardCursor);

    // Render hook for User Beta
    const { result: resultBeta } = renderHook(() =>
      usePlanEditorState(mockRoom, undefined, undefined, "user-beta")
    );
    expect(resultBeta.current.title).toBe("베타의 비밀 여행");

    // Render hook for User Gamma (no draft)
    const { result: resultGamma } = renderHook(() =>
      usePlanEditorState(mockRoom, undefined, undefined, "user-gamma")
    );
    expect(resultGamma.current.title).toBe("");

    // Render hook for User Alpha in other room
    const otherRoom: TripRoom = { ...mockRoom, id: TripIdSchema.make("room-other-9") };
    const { result: resultAlphaOther } = renderHook(() =>
      usePlanEditorState(otherRoom, undefined, undefined, "user-alpha")
    );
    expect(resultAlphaOther.current.title).toBe("");
  });

  it("Cross-user spoofing defense: Draft containing mismatched ownerId inside storage is ignored", () => {
    const userAKey = getPlanEditorDraftKey("user-alpha", "room-stress-1", "new");
    // An attacker tried to inject user-beta's draft into user-alpha's key
    const spoofedDraft: StoredPlanEditorDraft = {
      ...validBaseDraft,
      ownerId: "user-beta", // Mismatched!
      title: "위조된 여행안",
    };
    localStorage.setItem(userAKey, JSON.stringify(spoofedDraft));

    const { result } = renderHook(() =>
      usePlanEditorState(mockRoom, undefined, undefined, "user-alpha")
    );

    // Must not hydrate the spoofed draft
    expect(result.current.title).toBe("");
    expect(result.current.savedWizardCursor).toBeUndefined();
  });

  it("Storage Quota Failure & Exception Handling: Hook remains functional and marks draftSaveStatus as ERROR", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
    });

    const { result } = renderHook(() =>
      usePlanEditorState(mockRoom, undefined, undefined, "user-alpha")
    );

    act(() => {
      result.current.setTitle("오류 발생 테스트");
    });

    expect(result.current.title).toBe("오류 발생 테스트");
    expect(result.current.draftSaveStatus).toBe("ERROR");
  });

  it("localStorage.getItem security blocking / exception: Hook falls back to clean initial data without crashing", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Access denied in sandbox", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Access denied in sandbox", "SecurityError");
    });

    const { result } = renderHook(() =>
      usePlanEditorState(mockRoom, undefined, undefined, "user-alpha")
    );

    expect(result.current.title).toBe("");
    expect(result.current.draftSaveStatus).toBe("ERROR");
  });

  it("Discard operation clears localStorage and unsets savedWizardCursor without leaking to other drafts", () => {
    const userAKey = getPlanEditorDraftKey("user-alpha", "room-stress-1", "new");
    const userBKey = getPlanEditorDraftKey("user-beta", "room-stress-1", "new");

    localStorage.setItem(userAKey, JSON.stringify({ ...validBaseDraft, ownerId: "user-alpha" }));
    localStorage.setItem(userBKey, JSON.stringify({ ...validBaseDraft, ownerId: "user-beta" }));

    const { result } = renderHook(() =>
      usePlanEditorState(mockRoom, undefined, undefined, "user-alpha")
    );

    expect(result.current.title).toBe(validBaseDraft.title);
    expect(result.current.savedWizardCursor).toEqual(validBaseDraft.wizardCursor);

    act(() => {
      result.current.discardDraft();
    });

    expect(localStorage.getItem(userAKey)).toBeNull();
    expect(localStorage.getItem(userBKey)).not.toBeNull(); // User B's draft is untouched!
    expect(result.current.savedWizardCursor).toBeUndefined();
  });

  it("clearDraft resets form data to initial state and unsets savedWizardCursor", () => {
    const userAKey = getPlanEditorDraftKey("user-alpha", "room-stress-1", "new");
    localStorage.setItem(userAKey, JSON.stringify({ ...validBaseDraft, ownerId: "user-alpha" }));

    const { result } = renderHook(() =>
      usePlanEditorState(mockRoom, undefined, undefined, "user-alpha")
    );

    expect(result.current.title).toBe(validBaseDraft.title);

    act(() => {
      result.current.clearDraft();
    });

    expect(result.current.title).toBe("");
    expect(result.current.savedWizardCursor).toBeUndefined();
    expect(result.current.routes).toHaveLength(0);
  });

  it("pauseDraftSave flag prevents auto-saving while active", () => {
    const userAKey = getPlanEditorDraftKey("user-alpha", "room-stress-1", "new");
    const { result, rerender } = renderHook(
      ({ pause }) => usePlanEditorState(mockRoom, undefined, undefined, "user-alpha", pause),
      { initialProps: { pause: true } }
    );

    act(() => {
      result.current.setTitle("저장되지 않아야 하는 제목");
    });

    expect(localStorage.getItem(userAKey)).toBeNull();

    // Now unpause
    rerender({ pause: false });

    expect(localStorage.getItem(userAKey)).not.toBeNull();
    const parsed = JSON.parse(localStorage.getItem(userAKey)!);
    expect(parsed.title).toBe("저장되지 않아야 하는 제목");
  });

  it("replaceFormData seamlessly updates all form fields and savedWizardCursor simultaneously", () => {
    const { result } = renderHook(() =>
      usePlanEditorState(mockRoom, undefined, undefined, "user-alpha")
    );

    const replacement: PlanEditorFormData = {
      title: "완전 새로운 계획",
      proposalReason: "교체된 사유",
      baseHeadcount: 5,
      routes: [{ city: "강릉", arrivalDate: "2026-11-01", departureDate: "2026-11-03" }],
      accommodations: [{
        id: "acc-g",
        city: "강릉",
        period: "2026-11-01 ~ 2026-11-03",
        nights: 2,
        hotelName: "씨마크 호텔",
        isSearching: false,
        bookingStatus: "AVAILABLE",
        priceRange: { min: 400000, max: 600000 },
      }],
      transports: [{
        id: "tr-g",
        fromCity: "서울",
        toCity: "강릉",
        mode: "KTX",
        hasTransfer: false,
        durationText: "2시간",
        bookingStatus: "AVAILABLE",
        priceRange: { min: 30000, max: 30000 },
      }],
    };

    const targetCursor: FirstPlanWizardCursor = {
      section: "review",
      question: "title",
    };

    act(() => {
      result.current.replaceFormData(replacement, targetCursor);
    });

    expect(result.current.title).toBe("완전 새로운 계획");
    expect(result.current.proposalReason).toBe("교체된 사유");
    expect(result.current.baseHeadcount).toBe(5);
    expect(result.current.routes).toHaveLength(1);
    expect(result.current.accommodations).toHaveLength(1);
    expect(result.current.transports).toHaveLength(1);
    expect(result.current.savedWizardCursor).toEqual(targetCursor);
  });

  it("Conflict resolution: restoreConflictingDraft vs useLatestPublishedPlan", () => {
    const publishedPlan: TripPlan = {
      id: PlanIdSchema.make("plan-pub-1"),
      revision: RevisionSchema.make(1),
      title: "서버에 등록된 계획",
      proposalReason: "서버 이유",
      baseHeadcount: 2,
      routes: [],
      accommodations: [],
      transports: [],
      places: [],
      voteCount: 0,
      status: "VOTING",
    };

    const draftKey = getPlanEditorDraftKey("user-alpha", "room-stress-1", "plan-pub-1");
    const staleDraft: StoredPlanEditorDraft = {
      ownerId: "user-alpha",
      basePlanFingerprint: "old-fingerprint-v0",
      title: "로컬에서 편집 중이던 제목",
      proposalReason: "로컬 편집 사유",
      baseHeadcount: 4,
      routes: [],
      accommodations: [],
      transports: [],
      updatedAt: new Date().toISOString(),
      wizardCursor: { section: "basic", question: "proposal-reason" },
    };
    localStorage.setItem(draftKey, JSON.stringify(staleDraft));

    // Render hook with publishedPlan
    const { result } = renderHook(() =>
      usePlanEditorState(mockRoom, publishedPlan, undefined, "user-alpha")
    );

    // Initial load detects conflict
    expect(result.current.draftConflict).toBe(true);
    expect(result.current.title).toBe("서버에 등록된 계획"); // Shows published first

    // User chooses to restore conflicting local draft
    act(() => {
      result.current.restoreConflictingDraft();
    });

    expect(result.current.draftConflict).toBe(false);
    expect(result.current.title).toBe("로컬에서 편집 중이던 제목");
    expect(result.current.proposalReason).toBe("로컬 편집 사유");
    expect(result.current.baseHeadcount).toBe(4);
    expect(result.current.savedWizardCursor).toEqual({ section: "basic", question: "proposal-reason" });
  });
});
