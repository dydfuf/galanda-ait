import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import {
  ExploreListingIdSchema,
  ParticipantIdSchema,
  PlanIdSchema,
  RevisionSchema,
  TripIdSchema,
} from "../ids.ts";
import { TripPlanSchema, type TripPlan, type TripRoom } from "../room.ts";
import {
  copyExploreSnapshotToTripPlan,
  ExplorePlanListingSchema,
  ExplorePlanSnapshotSchema,
  projectExplorePlanSnapshot,
  type ExplorePlanSnapshot,
} from "../explore-plan.ts";

const authorId = ParticipantIdSchema.make("author-1");

const makePlan = (overrides: Partial<TripPlan> = {}): TripPlan => ({
  id: PlanIdSchema.make("plan-1"),
  title: "도쿄·교토 5박 미식 여행",
  status: "VOTING",
  revision: RevisionSchema.make(3),
  publishedAt: "2026-08-20T00:00:00.000Z",
  proposalReason: "이 코스가 제일 알차서 제안합니다",
  authorId,
  authorName: "plan-scoped 이름",
  baseHeadcount: 2,
  routes: [
    { city: "도쿄", arrivalDate: "2026-10-01", departureDate: "2026-10-04" },
    { city: "교토", arrivalDate: "2026-10-04", departureDate: "2026-10-06" },
  ],
  accommodations: [
    {
      id: "acc-tokyo",
      city: "도쿄",
      period: "2026-10-01 ~ 2026-10-04",
      nights: 3,
      hotelName: "신주쿠 호텔",
      bookingStatus: "AVAILABLE",
      priceRange: { min: 100000, max: 150000 },
      bookingUrl: "https://booking.example/tokyo",
      confirmedBy: "member-2",
      confirmedAt: "2026-08-21T00:00:00.000Z",
    },
    {
      id: "acc-kyoto",
      city: "교토",
      period: "2026-10-04 ~ 2026-10-06",
      nights: 2,
      hotelName: "",
      isSearching: true,
      bookingStatus: "NOT_CHECKED",
    },
  ],
  transports: [
    {
      id: "t-out",
      fromCity: "서울",
      toCity: "도쿄",
      mode: "항공",
      hasTransfer: false,
      durationText: "2시간 30분",
      bookingStatus: "AVAILABLE",
      priceRange: { min: 200000, max: 300000 },
      bookingUrl: "https://booking.example/flight",
      confirmedBy: "member-2",
    },
    {
      id: "t-mid",
      fromCity: "도쿄",
      toCity: "교토",
      mode: "신칸센",
      hasTransfer: false,
      durationText: "2시간 20분",
      bookingStatus: "AVAILABLE",
    },
    {
      id: "t-back",
      fromCity: "교토",
      toCity: "서울",
      mode: "항공",
      hasTransfer: true,
      durationText: "3시간",
      bookingStatus: "NOT_CHECKED",
    },
  ],
  places: [
    { id: "place-1", name: "비밀 맛집", category: "food", address: "도쿄 어딘가" },
  ],
  clonedFromPlanId: PlanIdSchema.make("private-source-plan"),
  differenceSummary: "숙소를 더 좋은 곳으로 변경",
  memberOpinions: [
    { userId: authorId, userName: "작성자", reaction: "LIKE" },
    {
      userId: ParticipantIdSchema.make("member-2"),
      userName: "반대한 멤버",
      reaction: "HARD",
      reason: "예산 초과라 반대",
    },
  ],
  voteCount: 4,
  ...overrides,
});

const makeRoom = (plan: TripPlan, overrides: Partial<TripRoom> = {}): TripRoom => ({
  id: TripIdSchema.make("trip-1"),
  title: "가을 일본 여행",
  destination: "일본",
  revision: RevisionSchema.make(7),
  members: [
    { id: authorId, name: "김여행", role: "HOST" },
    { id: ParticipantIdSchema.make("member-2"), name: "반대한 멤버", role: "MEMBER" },
  ],
  plans: [plan],
  ...overrides,
});

/** allowlist에 의해 공개 snapshot에 존재해도 되는 정확한 top-level key 집합. */
const PUBLIC_SNAPSHOT_KEYS = [
  "author",
  "dateRange",
  "destination",
  "routes",
  "sourcePlanRevision",
  "stays",
  "themeIds",
  "title",
  "transports",
].sort();

const expectSnapshot = (
  room: TripRoom,
  plan: TripPlan
): ExplorePlanSnapshot => {
  const result = projectExplorePlanSnapshot(room, plan);
  if (!result.ok) {
    throw new Error(`projection failed: ${result.failure.kind}`);
  }
  return result.snapshot;
};

describe("projectExplorePlanSnapshot", () => {
  it("정확한 public key allowlist만 노출한다 (민감 필드 추가 시 fail-closed)", () => {
    const plan = makePlan();
    const snapshot = expectSnapshot(makeRoom(plan), plan);

    expect(Object.keys(snapshot).sort()).toEqual(PUBLIC_SNAPSHOT_KEYS);

    // top-level 직렬화에서 민감 문자열이 새어나오지 않는다.
    const serialized = JSON.stringify(snapshot);
    for (const secret of [
      "https://booking.example",
      "예산 초과라 반대",
      "이 코스가 제일 알차서 제안합니다",
      "숙소를 더 좋은 곳으로 변경",
      "private-source-plan",
      "place-1",
      "비밀 맛집",
      "acc-tokyo",
      "t-out",
      "member-2",
      "author-1",
      "trip-1",
      "plan-1",
    ]) {
      expect(serialized).not.toContain(secret);
    }
  });

  it("author는 display name만 노출하고 participant ID/opinion을 배제한다", () => {
    const plan = makePlan();
    const snapshot = expectSnapshot(makeRoom(plan), plan);

    expect(snapshot.author).toEqual({ displayName: "김여행" });
    expect(Object.keys(snapshot.author)).toEqual(["displayName"]);
  });

  it("stay/transport 요약에서 ID·URL·가격·예약상태·확정자를 제거한다", () => {
    const plan = makePlan();
    const snapshot = expectSnapshot(makeRoom(plan), plan);

    for (const stay of snapshot.stays) {
      expect(Object.keys(stay).sort()).toEqual(
        ["city", "hotelName", "isSearching", "nights"].sort()
      );
    }
    // 숙소 찾는 중 상태는 hotelName을 노출하지 않는다.
    const kyoto = snapshot.stays.find((stay) => stay.city === "교토");
    expect(kyoto?.isSearching).toBe(true);
    expect(kyoto?.hotelName).toBeUndefined();
    const tokyo = snapshot.stays.find((stay) => stay.city === "도쿄");
    expect(tokyo?.hotelName).toBe("신주쿠 호텔");

    for (const transport of snapshot.transports) {
      expect(Object.keys(transport).sort()).toEqual(
        ["durationText", "fromCity", "hasTransfer", "mode", "toCity"].sort()
      );
    }
  });

  it("route/date/duration 범위를 date helper로 파생한다", () => {
    const plan = makePlan();
    const snapshot = expectSnapshot(makeRoom(plan), plan);

    expect(snapshot.routes).toEqual([
      { city: "도쿄", arrivalDate: "2026-10-01", departureDate: "2026-10-04" },
      { city: "교토", arrivalDate: "2026-10-04", departureDate: "2026-10-06" },
    ]);
    expect(snapshot.dateRange).toEqual({
      startDate: "2026-10-01",
      endDate: "2026-10-06",
      nightCount: 5,
    });
    expect(snapshot.sourcePlanRevision).toBe(3);
    expect(snapshot.title).toBe("도쿄·교토 5박 미식 여행");
    expect(snapshot.destination).toBe("일본");
  });

  it("명시적으로 선택한 theme ID만 canonical order로 공개하고 텍스트에서 추론하지 않는다", () => {
    const plan = makePlan();
    const room = makeRoom(plan);

    expect(expectSnapshot(room, plan).themeIds).toEqual([]);
    const result = projectExplorePlanSnapshot(room, plan, ["nature", "food"]);
    if (!result.ok) throw new Error("projection failed");
    expect(result.snapshot.themeIds).toEqual(["food", "nature"]);
  });

  it("revision 없는 source plan은 MISSING_REVISION으로 fail-closed한다", () => {
    const plan = makePlan({ revision: undefined });
    const result = projectExplorePlanSnapshot(makeRoom(plan), plan);
    expect(result).toEqual({ ok: false, failure: { kind: "MISSING_REVISION" } });
  });

  it("author를 resolve할 수 없으면 UNRESOLVED_AUTHOR를 반환한다", () => {
    const plan = makePlan({ authorId: undefined, authorName: undefined });
    const room = makeRoom(plan, { members: [] });
    const result = projectExplorePlanSnapshot(room, plan);
    expect(result).toEqual({ ok: false, failure: { kind: "UNRESOLVED_AUTHOR" } });
  });

  it("legacy authorName은 일치하는 room member가 유일할 때만 resolve한다", () => {
    const legacyAuthorId = ParticipantIdSchema.make("legacy-author");
    const plan = makePlan({ authorId: undefined, authorName: "박작성" });
    const room = makeRoom(plan, {
      members: [{ id: legacyAuthorId, name: "박작성", role: "MEMBER" }],
    });
    const snapshot = expectSnapshot(room, plan);
    expect(snapshot.author).toEqual({ displayName: "박작성" });
  });

  it("legacy authorName과 일치하는 member가 없거나 둘 이상이면 fail-closed한다", () => {
    const plan = makePlan({ authorId: undefined, authorName: "박작성" });
    const missing = projectExplorePlanSnapshot(
      makeRoom(plan, { members: [] }),
      plan
    );
    const ambiguous = projectExplorePlanSnapshot(
      makeRoom(plan, {
        members: [
          {
            id: ParticipantIdSchema.make("legacy-author-1"),
            name: "박작성",
            role: "MEMBER",
          },
          {
            id: ParticipantIdSchema.make("legacy-author-2"),
            name: "박작성",
            role: "MEMBER",
          },
        ],
      }),
      plan
    );

    expect(missing).toEqual({
      ok: false,
      failure: { kind: "UNRESOLVED_AUTHOR" },
    });
    expect(ambiguous).toEqual({
      ok: false,
      failure: { kind: "UNRESOLVED_AUTHOR" },
    });
  });

  it("빈 route는 INVALID_ROUTE로 fail-closed한다", () => {
    const plan = makePlan({ routes: [] });
    const result = projectExplorePlanSnapshot(makeRoom(plan), plan);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.failure.kind).toBe("INVALID_ROUTE");
  });

  it("겹치는 route는 기존 publish validation을 재사용해 INVALID_ROUTE로 거부한다", () => {
    const plan = makePlan({
      routes: [
        { city: "도쿄", arrivalDate: "2026-10-01", departureDate: "2026-10-05" },
        { city: "교토", arrivalDate: "2026-10-03", departureDate: "2026-10-06" },
      ],
    });
    const result = projectExplorePlanSnapshot(makeRoom(plan), plan);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.failure.kind).toBe("INVALID_ROUTE");
  });

  it("source object를 mutate해도 이미 만든 snapshot은 변하지 않는다", () => {
    const plan = makePlan();
    const room = makeRoom(plan);
    const snapshot = expectSnapshot(room, plan);

    // source aggregate를 사후 변경한다.
    (plan.routes as unknown as Array<{ city: string }>)[0]!.city = "변경된도시";
    (plan.accommodations as unknown as Array<{ hotelName: string }>)[0]!.hotelName =
      "변경된호텔";
    (plan as { title: string }).title = "변경된제목";
    (room as { destination: string }).destination = "변경된목적지";

    expect(snapshot.routes[0]?.city).toBe("도쿄");
    expect(snapshot.stays[0]?.hotelName).toBe("신주쿠 호텔");
    expect(snapshot.title).toBe("도쿄·교토 5박 미식 여행");
    expect(snapshot.destination).toBe("일본");
  });

  it("projection 결과는 snapshot schema validation을 통과한다", () => {
    const plan = makePlan();
    const snapshot = expectSnapshot(makeRoom(plan), plan);
    expect(Schema.is(ExplorePlanSnapshotSchema)(snapshot)).toBe(true);
  });
});

describe("ExplorePlanListingSchema", () => {
  const plan = makePlan();
  const snapshot = expectSnapshot(makeRoom(plan), plan);

  it("LISTED/UNLISTED lifecycle envelope를 검증한다", () => {
    const listed = {
      listingId: "listing-1",
      status: "LISTED",
      listingRevision: 1,
      listedAt: "2026-08-25T00:00:00.000Z",
      updatedAt: "2026-08-25T00:00:00.000Z",
      snapshot,
    };
    expect(Schema.is(ExplorePlanListingSchema)(listed)).toBe(true);

    const unlisted = {
      ...listed,
      status: "UNLISTED",
      listingRevision: 2,
      updatedAt: "2026-08-26T00:00:00.000Z",
      unlistedAt: "2026-08-26T00:00:00.000Z",
    };
    expect(Schema.is(ExplorePlanListingSchema)(unlisted)).toBe(true);
  });

  it("잘못된 status·timestamp를 거부한다", () => {
    const base = {
      listingId: "listing-1",
      status: "LISTED",
      listingRevision: 1,
      listedAt: "2026-08-25T00:00:00.000Z",
      updatedAt: "2026-08-25T00:00:00.000Z",
      snapshot,
    };
    expect(Schema.is(ExplorePlanListingSchema)({ ...base, status: "PUBLIC" })).toBe(false);
    expect(Schema.is(ExplorePlanListingSchema)({ ...base, listedAt: "2026-08-25" })).toBe(false);
    expect(Schema.is(ExplorePlanListingSchema)({ ...base, listingRevision: 0 })).toBe(false);
    expect(Schema.is(ExplorePlanListingSchema)({ ...base, listingRevision: 1.5 })).toBe(false);
    expect(
      Schema.is(ExplorePlanListingSchema)({
        ...base,
        snapshot: { ...snapshot, sourcePlanRevision: 0 },
      })
    ).toBe(false);
  });
});

describe("Explore listing lifecycle 정책 (문서화된 전이 값 규칙)", () => {
  const plan = makePlan();
  const room = makeRoom(plan);
  const snapshot = expectSnapshot(room, plan);
  const isListing = Schema.is(ExplorePlanListingSchema);

  // list: 최초 게시. LISTED, listedAt=updatedAt, unlistedAt 없음.
  const listed = {
    listingId: "listing-1",
    status: "LISTED" as const,
    listingRevision: 1,
    listedAt: "2026-08-25T00:00:00.000Z",
    updatedAt: "2026-08-25T00:00:00.000Z",
    snapshot,
  };

  it("list: LISTED이고 listedAt=updatedAt이며 unlistedAt이 없다", () => {
    expect(isListing(listed)).toBe(true);
    expect(listed.status).toBe("LISTED");
    expect(listed.listedAt).toBe(listed.updatedAt);
    expect("unlistedAt" in listed).toBe(false);
  });

  it("unlist: LISTED→UNLISTED에서 revision 증가·unlistedAt 설정·listedAt 유지·snapshot 불변", () => {
    const unlisted = {
      ...listed,
      status: "UNLISTED" as const,
      listingRevision: listed.listingRevision + 1,
      updatedAt: "2026-08-26T00:00:00.000Z",
      unlistedAt: "2026-08-26T00:00:00.000Z",
    };
    expect(isListing(unlisted)).toBe(true);
    expect(unlisted.status).toBe("UNLISTED");
    expect(unlisted.listingRevision).toBeGreaterThan(listed.listingRevision);
    expect(unlisted.listedAt).toBe(listed.listedAt); // 최초 게시 시각 유지
    expect(unlisted.unlistedAt).toBe(unlisted.updatedAt);
    expect(unlisted.snapshot).toBe(listed.snapshot); // snapshot immutable
  });

  it("relist: UNLISTED→LISTED에서 revision 증가·unlistedAt 제거·새 snapshot 재사영·listedAt 갱신", () => {
    const unlisted = {
      ...listed,
      status: "UNLISTED" as const,
      listingRevision: 2,
      updatedAt: "2026-08-26T00:00:00.000Z",
      unlistedAt: "2026-08-26T00:00:00.000Z",
    };
    // 재게시는 최신 source를 다시 project한 새 snapshot으로 교체한다.
    const reprojected = expectSnapshot(room, plan);
    const relistedAt = "2026-08-27T00:00:00.000Z";
    const relisted = {
      listingId: unlisted.listingId,
      status: "LISTED" as const,
      listingRevision: unlisted.listingRevision + 1,
      listedAt: relistedAt, // 재게시 시각으로 갱신(feed 최신화)
      updatedAt: relistedAt,
      snapshot: reprojected,
    };
    expect(isListing(relisted)).toBe(true);
    expect(relisted.status).toBe("LISTED");
    expect(relisted.listingRevision).toBeGreaterThan(unlisted.listingRevision);
    expect("unlistedAt" in relisted).toBe(false); // 다시 노출 중이므로 제거
    expect(relisted.listedAt).toBe(relisted.updatedAt); // listedAt=updatedAt=재게시 시각
    expect(relisted.listedAt).not.toBe(listed.listedAt); // 원래 게시 시각과 다름
  });

  it("source deletion policy: 삭제 시 auto-unlist(unlist와 동일 값 규칙)이며 snapshot은 immutable 유지", () => {
    // source plan/room 삭제 트리거 → 기존 LISTED는 auto-unlist된다.
    const autoUnlisted = {
      ...listed,
      status: "UNLISTED" as const,
      listingRevision: listed.listingRevision + 1,
      updatedAt: "2026-08-28T00:00:00.000Z",
      unlistedAt: "2026-08-28T00:00:00.000Z",
    };
    expect(isListing(autoUnlisted)).toBe(true);
    expect(autoUnlisted.status).toBe("UNLISTED");
    expect(autoUnlisted.listingRevision).toBeGreaterThan(listed.listingRevision);
    expect(autoUnlisted.unlistedAt).toBe(autoUnlisted.updatedAt);
    // source가 사라져도 이미 박제된 snapshot 내용은 그대로다.
    expect(autoUnlisted.snapshot).toEqual(listed.snapshot);
  });
});

// --- RAON-261 DISC-7: snapshot → private TripPlan copier ---------------------

describe("copyExploreSnapshotToTripPlan (DISC-7)", () => {
  const listingId = ExploreListingIdSchema.make("listing-import-1");
  const newAuthorId = ParticipantIdSchema.make("importer-1");
  const newPlanId = PlanIdSchema.make("plan-copied-1");

  // publish validation을 통과할 수 있는 정상 snapshot을 project로 만든다.
  const makeSnapshot = (): ExplorePlanSnapshot => {
    const plan = makePlan();
    return expectSnapshot(makeRoom(plan), plan);
  };

  const runCopy = (
    over?: Partial<Parameters<typeof copyExploreSnapshotToTripPlan>[0]>
  ) => {
    return copyExploreSnapshotToTripPlan({
      snapshot: makeSnapshot(),
      planId: newPlanId,
      authorId: newAuthorId,
      authorName: "가져온 사람",
      baseHeadcount: 1,
      publishedAt: "2026-08-30T00:00:00.000Z",
      listingId,
      ...over,
    });
  };

  it("copied plan은 새 ID/actor 소유권/revision=1/status=VOTING/server timestamp/provenance를 갖는다", () => {
    const result = runCopy();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { plan } = result;

    expect(plan.id).toBe(newPlanId);
    expect(plan.authorId).toBe(newAuthorId);
    expect(plan.authorName).toBe("가져온 사람");
    expect(plan.revision).toBe(1);
    expect(plan.status).toBe("VOTING");
    expect(plan.publishedAt).toBe("2026-08-30T00:00:00.000Z");
    expect(plan.importedFromExploreListingId).toBe(listingId);
    expect(plan.baseHeadcount).toBe(1);
    // 최종 plan은 TripPlanSchema를 통과한다.
    expect(Schema.is(TripPlanSchema)(plan)).toBe(true);
  });

  it("sanitized-away 필드를 fake 복원하지 않는다 (proposalReason 없음, places/opinions 빈 배열, booking 정보 없음)", () => {
    const result = runCopy();
    if (!result.ok) throw new Error("copy failed");
    const { plan } = result;

    expect(plan.proposalReason).toBeUndefined();
    expect(plan.places).toEqual([]);
    expect(plan.memberOpinions).toEqual([]);
    expect(plan.voteCount).toBe(0);
    expect(plan.differenceSummary).toBeUndefined();
    expect(plan.clonedFromPlanId).toBeUndefined();

    for (const stay of plan.accommodations ?? []) {
      expect(stay.bookingStatus).toBe("NOT_CHECKED");
      expect(stay.priceRange).toBeUndefined();
      expect(stay.bookingUrl).toBeUndefined();
      expect(stay.confirmedBy).toBeUndefined();
      expect(stay.confirmedAt).toBeUndefined();
    }
    for (const transport of plan.transports ?? []) {
      expect(transport.bookingStatus).toBe("NOT_CHECKED");
      expect(transport.priceRange).toBeUndefined();
      expect(transport.bookingUrl).toBeUndefined();
      expect(transport.confirmedBy).toBeUndefined();
      expect(transport.confirmedAt).toBeUndefined();
    }
  });

  it("내부 ID를 새 planId+kind+stable index로 결정적으로 파생하고 원본(source) ID/random을 쓰지 않는다", () => {
    const result = runCopy();
    if (!result.ok) throw new Error("copy failed");
    const stayIds = (result.plan.accommodations ?? []).map((s) => s.id);
    const transportIds = (result.plan.transports ?? []).map((t) => t.id);

    // 결정적 파생 ID: `${planId}-stay-N` / `${planId}-transport-N` (1-based, 순서대로).
    expect(stayIds).toEqual(
      stayIds.map((_, i) => `${newPlanId}-stay-${i + 1}`)
    );
    expect(transportIds).toEqual(
      transportIds.map((_, i) => `${newPlanId}-transport-${i + 1}`)
    );

    const allIds = [...stayIds, ...transportIds];
    // 원본 source ID(acc-tokyo/t-out 등)는 없다.
    expect(allIds).not.toContain("acc-tokyo");
    expect(allIds).not.toContain("acc-kyoto");
    expect(allIds).not.toContain("t-out");
    // 서로 다른 고유 ID다.
    expect(new Set(allIds).size).toBe(allIds.length);

    // 결정적: 동일 입력을 다시 복사하면 동일한 ID 집합이 나온다(random 미사용).
    const again = runCopy();
    if (!again.ok) throw new Error("copy failed");
    expect((again.plan.accommodations ?? []).map((s) => s.id)).toEqual(stayIds);
    expect((again.plan.transports ?? []).map((t) => t.id)).toEqual(transportIds);
  });

  it("accommodation period는 매칭된 정확한 route occurrence에서만 파생한다", () => {
    const result = runCopy();
    if (!result.ok) throw new Error("copy failed");
    const tokyo = result.plan.accommodations?.find((s) => s.city === "도쿄");
    expect(tokyo?.period).toBe("2026-10-01 ~ 2026-10-04");
    const kyoto = result.plan.accommodations?.find((s) => s.city === "교토");
    expect(kyoto?.period).toBe("2026-10-04 ~ 2026-10-06");
  });

  it("같은 도시를 여러 번 방문해도 각 stay가 서로 다른 route occurrence(city+nights)에 매칭되어 올바른 기간을 갖는다", () => {
    // 도쿄를 두 번 방문: 첫 방문 3박, 재방문 1박. copyStay가 첫 매칭만 쓰면
    // 두 번째 도쿄 stay가 잘못된 기간을 갖게 되므로 이를 회귀 검증한다.
    const snapshot: ExplorePlanSnapshot = {
      title: "도쿄 왕복 여정",
      destination: "일본",
      routes: [
        { city: "도쿄", arrivalDate: "2026-11-01", departureDate: "2026-11-04" },
        { city: "오사카", arrivalDate: "2026-11-04", departureDate: "2026-11-06" },
        { city: "도쿄", arrivalDate: "2026-11-06", departureDate: "2026-11-07" },
      ],
      dateRange: { startDate: "2026-11-01", endDate: "2026-11-07", nightCount: 6 },
      stays: [
        { city: "도쿄", isSearching: true, nights: 3 },
        { city: "오사카", isSearching: true, nights: 2 },
        { city: "도쿄", isSearching: true, nights: 1 },
      ],
      transports: [
        { fromCity: "서울", toCity: "도쿄", mode: "항공", hasTransfer: false, durationText: "2시간" },
        { fromCity: "도쿄", toCity: "오사카", mode: "신칸센", hasTransfer: false, durationText: "3시간" },
        { fromCity: "오사카", toCity: "도쿄", mode: "신칸센", hasTransfer: false, durationText: "3시간" },
        { fromCity: "도쿄", toCity: "서울", mode: "항공", hasTransfer: false, durationText: "2시간" },
      ],
      author: { displayName: "여행자" },
      sourcePlanRevision: RevisionSchema.make(1),
    };
    const result = copyExploreSnapshotToTripPlan({
      snapshot,
      planId: newPlanId,
      authorId: newAuthorId,
      authorName: "가져온 사람",
      baseHeadcount: 1,
      publishedAt: "2026-08-30T00:00:00.000Z",
      listingId,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const tokyoStays = result.plan.accommodations!.filter((s) => s.city === "도쿄");
    expect(tokyoStays).toHaveLength(2);
    // 첫 3박 도쿄 stay는 첫 route, 1박 도쿄 stay는 세 번째 route에서 기간을 얻는다.
    const threeNight = tokyoStays.find((s) => s.nights === 3);
    const oneNight = tokyoStays.find((s) => s.nights === 1);
    expect(threeNight?.period).toBe("2026-11-01 ~ 2026-11-04");
    expect(oneNight?.period).toBe("2026-11-06 ~ 2026-11-07");
  });

  it("stay를 매칭할 route occurrence가 없으면 fabricate하지 않고 실패한다", () => {
    // route가 하나뿐인데 같은 도시 stay가 둘이면 두 번째는 매칭할 route가 없다.
    const snapshot: ExplorePlanSnapshot = {
      title: "매칭 불가",
      destination: "도쿄",
      routes: [
        { city: "도쿄", arrivalDate: "2026-12-01", departureDate: "2026-12-04" },
      ],
      dateRange: { startDate: "2026-12-01", endDate: "2026-12-04", nightCount: 3 },
      stays: [
        { city: "도쿄", isSearching: true, nights: 3 },
        { city: "도쿄", isSearching: true, nights: 3 },
      ],
      transports: [],
      author: { displayName: "여행자" },
      sourcePlanRevision: RevisionSchema.make(1),
    };
    const result = copyExploreSnapshotToTripPlan({
      snapshot,
      planId: newPlanId,
      authorId: newAuthorId,
      authorName: "가져온 사람",
      baseHeadcount: 1,
      publishedAt: "2026-08-30T00:00:00.000Z",
      listingId,
    });
    expect(result.ok).toBe(false);
  });

  it("copied plan은 source snapshot과 독립적인 array/object다 (mutate 격리)", () => {
    const snapshot = makeSnapshot();
    const result = copyExploreSnapshotToTripPlan({
      snapshot,
      planId: newPlanId,
      authorId: newAuthorId,
      authorName: "가져온 사람",
      baseHeadcount: 1,
      publishedAt: "2026-08-30T00:00:00.000Z",
      listingId,
    });
    if (!result.ok) throw new Error("copy failed");

    // copied plan을 mutate해도 snapshot은 그대로.
    (result.plan.routes as unknown as Array<{ city: string }>)[0]!.city = "변경";
    expect(snapshot.routes[0]?.city).toBe("도쿄");
    // 참조 동일성 없음.
    expect(result.plan.routes).not.toBe(snapshot.routes);
    expect(result.plan.accommodations).not.toBe(snapshot.stays);
  });

  it("legacy/incomplete snapshot이 publish validation을 못 넘기면 fake 없이 실패한다", () => {
    // route와 맞지 않는 stay nights → route 매칭 실패로 fake 없이 거부된다.
    const snapshot = makeSnapshot();
    const brokenSnapshot: ExplorePlanSnapshot = {
      ...snapshot,
      stays: snapshot.stays.map((stay) => ({ ...stay, nights: 999 })),
    };
    const result = copyExploreSnapshotToTripPlan({
      snapshot: brokenSnapshot,
      planId: newPlanId,
      authorId: newAuthorId,
      authorName: "가져온 사람",
      baseHeadcount: 1,
      publishedAt: "2026-08-30T00:00:00.000Z",
      listingId,
    });
    expect(result.ok).toBe(false);
  });
});
