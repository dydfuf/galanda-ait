import { describe, expect, it } from "vitest";
import { parsePlanEditorDraft } from "./usePlanEditorState.ts";

const validDraft = {
  title: "도쿄 여행",
  proposalReason: "이동을 줄인 안",
  baseHeadcount: 4,
  routes: [{ city: "도쿄", nights: 3 }],
  accommodations: [{
    id: "stay-1",
    city: "도쿄",
    period: "전체 일정",
    nights: 3,
    hotelName: "숙소 찾는 중",
    isSearching: true,
    bookingStatus: "NEED_CHECK",
    priceRange: { min: 0, max: 0 },
  }],
  transports: [{
    id: "transport-1",
    fromCity: "인천",
    toCity: "도쿄",
    mode: "항공",
    hasTransfer: false,
    durationText: "2시간",
    bookingStatus: "AVAILABLE",
    priceRange: { min: 400000, max: 500000 },
  }],
  updatedAt: "2026-08-21T00:00:00.000Z",
};

describe("parsePlanEditorDraft", () => {
  it("정상 draft만 복원하고 손상된 저장값은 무시한다", () => {
    expect(parsePlanEditorDraft(JSON.stringify(validDraft))?.title).toBe("도쿄 여행");
    expect(parsePlanEditorDraft("{broken")).toBeUndefined();
    expect(parsePlanEditorDraft(JSON.stringify({ ...validDraft, routes: [{ nights: 3 }] }))).toBeUndefined();
    expect(parsePlanEditorDraft(JSON.stringify({ ...validDraft, transports: [{ id: "broken" }] }))).toBeUndefined();
  });
});
