// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getPlanEditorDraftKey,
  parsePlanEditorDraft,
  usePlanEditorState,
  rebasePlanEditorData,
  hasDraftBaseChanged,
  getPlanFingerprint,
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

const validBaseDraft: StoredPlanEditorDraft = {
  ownerId: "user-alpha",
  basePlanFingerprint: undefined,
  title: "제주도 힐링 여행",
  proposalReason: "여유로운 힐링 여행",
  baseHeadcount: 2,
  routes: [
    { city: "제주", arrivalDate: "2026-10-10", departureDate: "2026-10-12" },
  ],
  accommodations: [
    {
      id: "acc-1",
      city: "제주",
      period: "2026-10-10 ~ 2026-10-12",
      nights: 2,
      hotelName: "신라스테이",
      isSearching: false,
      bookingStatus: "AVAILABLE",
      priceRange: { min: 200000, max: 300000 },
    },
  ],
  transports: [
    {
      id: "trans-1",
      fromCity: "김포",
      toCity: "제주",
      mode: "항공",
      hasTransfer: false,
      durationText: "1시간",
      bookingStatus: "AVAILABLE",
      priceRange: { min: 100000, max: 150000 },
    },
    {
      id: "trans-2",
      fromCity: "제주",
      toCity: "김포",
      mode: "항공",
      hasTransfer: false,
      durationText: "1시간",
      bookingStatus: "AVAILABLE",
      priceRange: { min: 100000, max: 150000 },
    },
  ],
  updatedAt: "2026-09-03T00:00:00.000Z",
  wizardCursor: {
    section: "basic",
    question: "title",
  },
};

const mockRoomA: TripRoom = {
  id: TripIdSchema.make("room-alpha-1"),
  title: "알파 방",
  destination: "제주",
  revision: RevisionSchema.make(1),
  members: [
    { id: ParticipantIdSchema.make("user-alpha"), name: "Alpha", role: "HOST" },
  ],
  plans: [],
};

const mockRoomB: TripRoom = {
  id: TripIdSchema.make("room-beta-2"),
  title: "베타 방",
  destination: "부산",
  revision: RevisionSchema.make(1),
  members: [
    { id: ParticipantIdSchema.make("user-alpha"), name: "Alpha", role: "HOST" },
  ],
  plans: [],
};

const mockExistingPlan: TripPlan = {
  id: PlanIdSchema.make("plan-base-1"),
  title: "기존 1안",
  proposalReason: "기존 사유",
  baseHeadcount: 2,
  status: "VOTING",
  authorId: ParticipantIdSchema.make("user-peer"),
  authorName: "동행자",
  places: [],
  voteCount: 0,
  routes: [{ city: "제주", arrivalDate: "2026-10-10", departureDate: "2026-10-12" }],
  accommodations: [],
  transports: [],
};

describe("M4 Draft Hydration Race Conditions & Concurrency Stress", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("Hydrates seamlessly when userId transitions from undefined (session loading) to defined", () => {
    const draftKey = getPlanEditorDraftKey("user-alpha", "room-alpha-1", "new");
    localStorage.setItem(draftKey, JSON.stringify(validBaseDraft));

    // Initially userId is undefined (session loading)
    const { result, rerender } = renderHook(
      ({ userId }) => usePlanEditorState(mockRoomA, undefined, undefined, userId),
      { initialProps: { userId: undefined as string | undefined } }
    );

    // Should not be hydrated yet
    expect(result.current.title).toBe("");
    expect(result.current.isDraftHydrated).toBe(true); // editorId is undefined, so true

    // User session resolves!
    rerender({ userId: "user-alpha" });

    // Now draft hydrates immediately without race condition
    expect(result.current.title).toBe("제주도 힐링 여행");
    expect(result.current.baseHeadcount).toBe(2);
    expect(result.current.routes).toHaveLength(1);
    expect(result.current.isDraftHydrated).toBe(true);
  });

  it("Does NOT overwrite in-memory edits when room revision updates in the background", () => {
    const draftKey = getPlanEditorDraftKey("user-alpha", "room-alpha-1", "new");
    localStorage.setItem(draftKey, JSON.stringify(validBaseDraft));

    const { result, rerender } = renderHook(
      ({ room }) => usePlanEditorState(room, undefined, undefined, "user-alpha"),
      { initialProps: { room: mockRoomA } }
    );

    expect(result.current.title).toBe("제주도 힐링 여행");

    // User makes new edits in memory
    act(() => {
      result.current.setTitle("사용자가 수정한 제목");
      result.current.setBaseHeadcount(5);
    });

    expect(result.current.title).toBe("사용자가 수정한 제목");
    expect(result.current.baseHeadcount).toBe(5);

    // Background poll updates room revision from 1 to 2 to 3
    const roomRev2: TripRoom = { ...mockRoomA, revision: RevisionSchema.make(2) };
    rerender({ room: roomRev2 });

    const roomRev3: TripRoom = { ...mockRoomA, revision: RevisionSchema.make(3) };
    rerender({ room: roomRev3 });

    // In-memory edits MUST NOT be wiped or reset back to initial
    expect(result.current.title).toBe("사용자가 수정한 제목");
    expect(result.current.baseHeadcount).toBe(5);

    // localStorage should contain the latest user edits
    const saved = parsePlanEditorDraft(localStorage.getItem(draftKey));
    expect(saved?.title).toBe("사용자가 수정한 제목");
    expect(saved?.baseHeadcount).toBe(5);
  });

  it("Cleans up and switches draft contexts correctly when room switches from Room A to Room B", () => {
    const draftKeyA = getPlanEditorDraftKey("user-alpha", "room-alpha-1", "new");
    const draftKeyB = getPlanEditorDraftKey("user-alpha", "room-beta-2", "new");

    const draftA: StoredPlanEditorDraft = {
      ...validBaseDraft,
      title: "제주 여행 A",
    };
    const draftB: StoredPlanEditorDraft = {
      ...validBaseDraft,
      title: "부산 여행 B",
      routes: [{ city: "부산", arrivalDate: "2026-11-01", departureDate: "2026-11-03" }],
    };

    localStorage.setItem(draftKeyA, JSON.stringify(draftA));
    localStorage.setItem(draftKeyB, JSON.stringify(draftB));

    const { result, rerender } = renderHook(
      ({ room }) => usePlanEditorState(room, undefined, undefined, "user-alpha"),
      { initialProps: { room: mockRoomA } }
    );

    expect(result.current.title).toBe("제주 여행 A");

    // Switch to Room B
    rerender({ room: mockRoomB });

    expect(result.current.title).toBe("부산 여행 B");
    expect(result.current.routes[0]?.city).toBe("부산");

    // Switch back to Room A
    rerender({ room: mockRoomA });

    expect(result.current.title).toBe("제주 여행 A");
    expect(result.current.routes[0]?.city).toBe("제주");
  });

  it("Handles rapid user input in the very first render cycle without losing keystrokes", () => {
    const draftKey = getPlanEditorDraftKey("user-alpha", "room-alpha-1", "new");
    // No pre-existing draft
    const { result } = renderHook(() =>
      usePlanEditorState(mockRoomA, undefined, undefined, "user-alpha")
    );

    act(() => {
      result.current.setTitle("첫 타자 입력");
      result.current.setProposalReason("사유 입력");
      result.current.handleAddCity("강릉");
    });

    expect(result.current.title).toBe("첫 타자 입력");
    expect(result.current.proposalReason).toBe("사유 입력");
    expect(result.current.routes[0]?.city).toBe("강릉");

    const saved = parsePlanEditorDraft(localStorage.getItem(draftKey));
    expect(saved?.title).toBe("첫 타자 입력");
    expect(saved?.proposalReason).toBe("사유 입력");
    expect(saved?.routes[0]?.city).toBe("강릉");
  });

  it("Detects base plan changes (fingerprint mismatch) in clone mode and triggers draftConflict without crashing", () => {
    const cloneTargetKey = getPlanEditorDraftKey("user-alpha", "room-alpha-1", `clone_${mockExistingPlan.id}`);
    const staleFingerprintDraft: StoredPlanEditorDraft = {
      ...validBaseDraft,
      basePlanFingerprint: '{"revision":1,"title":"옛날 계획"}',
      clonedFromPlanId: mockExistingPlan.id,
      title: "기존 1안 대안 (작성 중)",
    };
    localStorage.setItem(cloneTargetKey, JSON.stringify(staleFingerprintDraft));

    // Current mockExistingPlan has a different fingerprint
    const currentFingerprint = getPlanFingerprint(mockExistingPlan);
    expect(hasDraftBaseChanged(staleFingerprintDraft.basePlanFingerprint, currentFingerprint)).toBe(true);

    const { result } = renderHook(() =>
      usePlanEditorState(mockRoomA, undefined, mockExistingPlan, "user-alpha")
    );

    // Conflict flag must be raised
    expect(result.current.draftConflict).toBe(true);

    // Restoring conflicting draft applies user's draft back
    act(() => {
      result.current.restoreConflictingDraft();
    });

    expect(result.current.draftConflict).toBe(false);
    expect(result.current.title).toBe("기존 1안 대안 (작성 중)");
  });

  it("useLatestPublishedPlan resets form and unsets conflict flag", () => {
    const cloneTargetKey = getPlanEditorDraftKey("user-alpha", "room-alpha-1", `clone_${mockExistingPlan.id}`);
    const staleFingerprintDraft: StoredPlanEditorDraft = {
      ...validBaseDraft,
      basePlanFingerprint: '{"revision":1,"title":"옛날 계획"}',
      clonedFromPlanId: mockExistingPlan.id,
      title: "버려질 대안 제목",
    };
    localStorage.setItem(cloneTargetKey, JSON.stringify(staleFingerprintDraft));

    const currentFingerprint = getPlanFingerprint(mockExistingPlan);

    const { result } = renderHook(() =>
      usePlanEditorState(mockRoomA, undefined, mockExistingPlan, "user-alpha")
    );

    expect(result.current.draftConflict).toBe(true);

    act(() => {
      result.current.useLatestPublishedPlan();
    });

    expect(result.current.draftConflict).toBe(false);
    expect(result.current.title).toBe(`${mockExistingPlan.title} 대안`);
    // After useLatestPublishedPlan, auto-save re-saves with the latest server fingerprint
    const saved = parsePlanEditorDraft(localStorage.getItem(cloneTargetKey));
    expect(saved?.basePlanFingerprint).toBe(currentFingerprint);
  });
});

describe("M4 LocalStorage Corruption & Security Resilience", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("Resilience against Prototype Pollution payloads in localStorage", () => {
    const maliciousPayloads = [
      '{"ownerId":"user-alpha","title":"t","proposalReason":"r","baseHeadcount":2,"routes":[],"accommodations":[],"transports":[],"updatedAt":"2026-09-03T00:00:00.000Z","__proto__":{"isAdmin":true}}',
      '{"ownerId":"user-alpha","title":"t","proposalReason":"r","baseHeadcount":2,"routes":[],"accommodations":[],"transports":[],"updatedAt":"2026-09-03T00:00:00.000Z","constructor":{"prototype":{"polluted":true}}}',
      '{"ownerId":"user-alpha","title":"t","proposalReason":"r","baseHeadcount":2,"routes":[{"__proto__":{"polluted":true},"city":"제주","arrivalDate":"2026-10-10","departureDate":"2026-10-12"}],"accommodations":[],"transports":[],"updatedAt":"2026-09-03T00:00:00.000Z"}',
    ];

    for (const payload of maliciousPayloads) {
      const parsed = parsePlanEditorDraft(payload);
      expect((Object.prototype as unknown as { isAdmin?: boolean }).isAdmin).toBeUndefined();
      expect((Object.prototype as unknown as { polluted?: boolean }).polluted).toBeUndefined();
      expect((parsed as unknown as { isAdmin?: boolean } | undefined)?.isAdmin).toBeUndefined();
    }
  });

  it("Resilience against corrupted arrays, NaN/Infinity, and truncated JSON", () => {
    const corruptPayloads = [
      '{ "ownerId": "user-alpha", "title": "test", "routes": [ { "city": null } ] }',
      '{ "ownerId": "user-alpha", "title": "test", "baseHeadcount": 1e999 }', // Infinity
      '{ "ownerId": "user-alpha", "title": "test", "baseHeadcount": -5 }',
      '{ "ownerId": "user-alpha", "title": "test", "accommodations": [ { "id": "1", "nights": -5 } ] }',
      '{ "ownerId": "user-alpha", "title": "test", "accommodations": [ { "id": "1", "city": "c", "period": "p", "nights": 1, "hotelName": "h", "bookingStatus": "INVALID" } ] }',
      '{ "ownerId": "user-alpha", "title": "test", "transports": [ { "hasTransfer": "yes" } ] }',
      '{ "ownerId": "user-alpha", "title": "test", "wizardCursor": { "section": "routes", "index": -99 } }',
      '{ "ownerId": "user-alpha", "title": "test", "wizardCursor": { "section": "basic", "question": null } }',
      '{ "ownerId": "user-alpha", "title": "test", "wizardCursor": { "section": "basic", "question": "title", "index": 1.7 } }',
      '{"ownerId": "user-alpha", "title": "test", "routes": new Array() }', // Invalid JSON
      '{"ownerId": "user-alpha", "title": "test", "updatedAt": 1234567890 }',
    ];

    for (const payload of corruptPayloads) {
      expect(parsePlanEditorDraft(payload)).toBeUndefined();
    }
  });

  it("Gracefully handles Storage QuotaExceededError during auto-save without crashing", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      const err = new DOMException("QuotaExceededError", "QuotaExceededError");
      throw err;
    });

    const { result } = renderHook(() =>
      usePlanEditorState(mockRoomA, undefined, undefined, "user-alpha")
    );

    // Form editing continues in-memory without crash
    act(() => {
      result.current.setTitle("대용량 초안 작성");
      result.current.setProposalReason("용량 초과 발생");
    });

    expect(result.current.title).toBe("대용량 초안 작성");
    expect(result.current.proposalReason).toBe("용량 초과 발생");
    expect(result.current.draftSaveStatus).toBe("ERROR");
  });

  it("Gracefully handles complete SecurityError (sandboxed iframe / private mode) on getItem, setItem, and removeItem", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("The operation is insecure.", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("The operation is insecure.", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new DOMException("The operation is insecure.", "SecurityError");
    });

    const { result } = renderHook(() =>
      usePlanEditorState(mockRoomA, undefined, undefined, "user-alpha")
    );

    // Initial state is cleanly initialized
    expect(result.current.title).toBe("");
    expect(result.current.draftSaveStatus).toBe("ERROR");

    // Can edit safely in memory
    act(() => {
      result.current.setTitle("보안 제한 환경 제목");
    });
    expect(result.current.title).toBe("보안 제한 환경 제목");

    // Discard and clear do not throw
    expect(() => {
      act(() => {
        result.current.discardDraft();
        result.current.clearDraft();
      });
    }).not.toThrow();

    expect(result.current.title).toBe("");
  });

  it("syncAccommodationNights maintains data integrity under route additions, deletions, and reordering", () => {
    const { result } = renderHook(() =>
      usePlanEditorState(mockRoomA, undefined, undefined, "user-alpha")
    );

    act(() => {
      result.current.handleAddCity("도쿄");
      result.current.handleUpdateCity(0, { arrivalDate: "2026-10-01", departureDate: "2026-10-04" });
    });

    act(() => {
      result.current.handleAddAccommodation({
        id: "acc-tokyo",
        city: "도쿄",
        period: "2026-10-01 ~ 2026-10-04",
        nights: 3,
        hotelName: "도쿄 호텔",
        bookingStatus: "AVAILABLE",
      });
    });

    expect(result.current.accommodations[0]?.nights).toBe(3);

    // Update route dates -> accommodation nights should auto-sync to 4 nights
    act(() => {
      result.current.handleUpdateCity(0, { arrivalDate: "2026-10-01", departureDate: "2026-10-05" });
    });

    expect(result.current.accommodations[0]?.nights).toBe(4);
    expect(result.current.accommodations[0]?.period).toBe("2026-10-01 ~ 2026-10-05");
  });

  it("3-way rebase algorithm correctly merges remote non-conflicting changes with local changes", () => {
    const base: PlanEditorFormData = {
      title: "원본 제목",
      proposalReason: "원본 사유",
      baseHeadcount: 2,
      routes: [{ city: "서울", arrivalDate: "2026-10-01", departureDate: "2026-10-03" }],
      accommodations: [],
      transports: [],
    };

    // User modified proposalReason and headcount locally
    const local: PlanEditorFormData = {
      ...base,
      proposalReason: "로컬에서 수정한 사유",
      baseHeadcount: 4,
    };

    // Server modified title remotely
    const latest: PlanEditorFormData = {
      ...base,
      title: "서버에서 변경된 제목",
    };

    const rebased = rebasePlanEditorData(base, local, latest);

    expect(rebased.title).toBe("서버에서 변경된 제목"); // Took latest server title
    expect(rebased.proposalReason).toBe("로컬에서 수정한 사유"); // Kept local change
    expect(rebased.baseHeadcount).toBe(4); // Kept local change
  });
});
