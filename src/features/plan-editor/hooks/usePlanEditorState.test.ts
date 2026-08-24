import { describe, expect, it } from "vitest";
import {
  getPlanEditorInitialData,
  getPlanEditorDraftKey,
  getPlanFingerprint,
  hasDraftBaseChanged,
  parsePlanEditorDraft,
  rebasePlanEditorData,
  savePlanEditorDraft,
  type PlanEditorFormData,
  type StoredPlanEditorDraft,
} from "./usePlanEditorState.ts";
import type { TripPlan, TripRoom } from "../../../core/domain/room.ts";
import { RevisionSchema } from "../../../core/domain/ids.ts";

const validDraft = {
  ownerId: "user-a",
  basePlanFingerprint: "base-v1",
  title: "도쿄 여행",
  proposalReason: "이동을 줄인 안",
  baseHeadcount: 4,
  routes: [{ city: "도쿄", arrivalDate: "2026-12-10", departureDate: "2026-12-13" }],
  accommodations: [{
    id: "stay-1",
    city: "도쿄",
    period: "전체 일정",
    nights: 3,
    hotelName: "",
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
    expect(parsePlanEditorDraft(JSON.stringify({ ...validDraft, routes: [{ city: "도쿄" }] }))).toBeUndefined();
    expect(parsePlanEditorDraft(JSON.stringify({ ...validDraft, transports: [{ id: "broken" }] }))).toBeUndefined();
  });

  it("사용자별 key를 분리한다", () => {
    expect(getPlanEditorDraftKey("user-a", "room-1", "new"))
      .not.toBe(getPlanEditorDraftKey("user-b", "room-1", "new"));
  });

  it("기준 공개본이 바뀐 draft를 stale로 판정한다", () => {
    const before = getPlanFingerprint({ title: "기존 여행안" });
    const current = getPlanFingerprint({ title: "수정된 여행안" });

    expect(hasDraftBaseChanged(before, current)).toBe(true);
    expect(hasDraftBaseChanged(current, current)).toBe(false);
  });

  it("공개본 내용이 같아도 revision이 바뀌면 기존 draft를 stale로 판정한다", () => {
    const before = getPlanFingerprint({ title: "기존 여행안", revision: RevisionSchema.make(1) });
    const current = getPlanFingerprint({ title: "기존 여행안", revision: RevisionSchema.make(2) });

    expect(hasDraftBaseChanged(before, current)).toBe(true);
  });
});

describe("plan editor initial data", () => {
  const room = {
    members: [
      { id: "host-1", name: "Host", role: "HOST" },
      { id: "member-1", name: "Member", role: "MEMBER" },
    ],
  } as unknown as TripRoom;
  const publishedPlan = {
    id: "plan-1",
    title: "도쿄 여행",
    status: "VOTING",
    proposalReason: "이동을 줄인 안",
    baseHeadcount: 3,
    routes: validDraft.routes,
    accommodations: validDraft.accommodations,
    transports: validDraft.transports,
    places: [],
    voteCount: 0,
  } as unknown as TripPlan;

  it("신규 여행안을 실제 빈 사용자 상태로 시작한다", () => {
    expect(getPlanEditorInitialData(room)).toEqual({
      title: "",
      proposalReason: "",
      baseHeadcount: 2,
      routes: [],
      accommodations: [],
      transports: [],
    });
  });

  it("수정과 복제는 기존 값을 보존하되 원본 객체를 공유하지 않는다", () => {
    const edit = getPlanEditorInitialData(room, publishedPlan);
    const clone = getPlanEditorInitialData(room, undefined, publishedPlan);

    expect(edit).toMatchObject({
      title: publishedPlan.title,
      accommodations: publishedPlan.accommodations,
      transports: publishedPlan.transports,
    });
    expect(clone).toMatchObject({
      title: `${publishedPlan.title} 대안`,
      clonedFromPlanId: publishedPlan.id,
      accommodations: publishedPlan.accommodations,
      transports: publishedPlan.transports,
    });
    expect(clone.routes).not.toBe(publishedPlan.routes);
    expect(clone.routes[0]).not.toBe(publishedPlan.routes?.[0]);
    expect(clone.accommodations[0]?.priceRange).not.toBe(
      publishedPlan.accommodations?.[0]?.priceRange
    );
  });

  it("기존 찾는 중 숙소의 예시 이름을 편집 데이터에서 제거한다", () => {
    const legacyPlan = {
      ...publishedPlan,
      accommodations: publishedPlan.accommodations?.map((stay) => ({
        ...stay,
        hotelName: "숙소 찾는 중",
        isSearching: true,
      })),
    };

    expect(getPlanEditorInitialData(room, legacyPlan).accommodations[0]?.hotelName).toBe("");
  });
});

describe("plan conflict rebase (RAON-158)", () => {
  it("내가 바꾼 제목과 다른 사용자가 바꾼 숙소를 함께 보존한다", () => {
    const base = {
      title: "오사카 여행",
      proposalReason: "",
      baseHeadcount: 4,
      routes: validDraft.routes,
      accommodations: [{ ...validDraft.accommodations[0], hotelName: "A 호텔" }],
      transports: validDraft.transports,
    } as PlanEditorFormData;
    const local = { ...base, title: "오사카 맛집 여행" };
    const latest = {
      ...base,
      accommodations: [{ ...base.accommodations[0], hotelName: "B 호텔" }],
    };

    const rebased = rebasePlanEditorData(base, local, latest);

    expect(rebased.title).toBe("오사카 맛집 여행");
    expect(rebased.accommodations[0]?.hotelName).toBe("B 호텔");
  });
});

describe("draft persistence status", () => {
  it("실제 write 결과를 반환하고 다음 write에서 ERROR에서 회복한다", () => {
    let shouldFail = false;
    const storage = {
      setItem: () => {
        if (shouldFail) throw new Error("quota exceeded");
      },
    };
    const draft = validDraft as unknown as StoredPlanEditorDraft;

    expect(savePlanEditorDraft(storage, "draft", draft)).toBe("SAVED");
    shouldFail = true;
    expect(savePlanEditorDraft(storage, "draft", draft)).toBe("ERROR");
    shouldFail = false;
    expect(savePlanEditorDraft(storage, "draft", draft)).toBe("SAVED");
  });
});
