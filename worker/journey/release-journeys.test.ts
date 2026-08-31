/**
 * Release-gate cross-boundary journeys (RAON-258 / Goal 14 DISC-10).
 *
 * 이 suite는 개별 unit test를 복제하지 않고 **경계 stitching**과 다섯 개
 * 사용자 여정의 재현 가능한 evidence를 만든다. 실제 production `createApp` +
 * route + Effect use case + Drizzle repository + 실제 SQL 생성을 통과하며,
 * request header로 인증 세션을 전환한다. privacy / no-live-sync / status 전이를
 * 명시적으로 증명한다.
 */
import { describe, expect, it } from "vitest";
import {
  createJourneyHarness,
  type ExploreListingRecord,
} from "./harness.ts";
import { listedListing, privateRoom, publishablePlan } from "./fixtures.ts";

const AUTHOR = { id: "author-1", name: "여행작가" };
const VIEWER = { id: "viewer-1", name: "구경꾼" };

const jsonBody = (value: unknown): RequestInit => ({
  method: "POST",
  body: JSON.stringify(value),
});

/** 응답 raw JSON에 어떤 private reference도 없어야 한다. */
const assertNoPrivateLeak = (raw: string, ...secrets: string[]) => {
  for (const secret of secrets) {
    expect(raw).not.toContain(secret);
  }
};

describe("Journey 1: author lists private plan → other session discover/detail", () => {
  it("author가 게시하면 다른 세션이 feed/detail에서 public snapshot만 본다", async () => {
    const tripId = "trip-1";
    const planId = "plan-1";
    const harness = createJourneyHarness({
      participants: [
        { id: AUTHOR.id, name: AUTHOR.name },
        { id: VIEWER.id, name: VIEWER.name },
      ],
      tripRooms: [
        privateRoom({
          tripId,
          host: AUTHOR,
          plans: [
            publishablePlan({
              planId,
              authorId: AUTHOR.id,
              authorName: AUTHOR.name,
              revision: 1,
              hardReason: "숙소가 너무 비싸요",
              opinionUserId: VIEWER.id,
            }),
          ],
        }),
      ],
    });

    // 게시 전: viewer feed는 비어 있다(fake 데이터 없음).
    const emptyFeed = await harness.requestAs(VIEWER.id, "/api/explore/listings");
    expect(emptyFeed.status).toBe(200);
    expect(((await emptyFeed.json()) as { items: unknown[] }).items).toHaveLength(0);

    // outsider(viewer)는 author의 private plan을 게시할 수 없다(작성자 아님 → 404/403).
    const viewerCannotList = await harness.requestAs(
      VIEWER.id,
      `/api/trips/${tripId}/plans/${planId}/explore-listing`,
      jsonBody({})
    );
    expect(viewerCannotList.status).toBe(404);

    // author가 실제 API로 게시한다(201).
    const listRes = await harness.requestAs(
      AUTHOR.id,
      `/api/trips/${tripId}/plans/${planId}/explore-listing`,
      jsonBody({})
    );
    expect(listRes.status).toBe(201);
    const listed = (await listRes.json()) as {
      listingId: string;
      status: string;
      snapshot: Record<string, unknown>;
    };
    expect(listed.status).toBe("LISTED");
    const listingId = listed.listingId;

    // 다른 세션(viewer)이 feed에서 발견한다.
    const feed = await harness.requestAs(VIEWER.id, "/api/explore/listings");
    expect(feed.status).toBe(200);
    const feedBody = (await feed.json()) as {
      items: Array<{ listingId: string; snapshot: Record<string, unknown> }>;
    };
    expect(feedBody.items).toHaveLength(1);
    expect(feedBody.items[0]!.listingId).toBe(listingId);

    // detail도 public snapshot만 반환한다.
    const detail = await harness.requestAs(
      VIEWER.id,
      `/api/explore/listings/${listingId}`
    );
    expect(detail.status).toBe(200);
    const detailRaw = await detail.text();

    // privacy: private reference/opinion/HARD reason이 새어 나가지 않는다.
    assertNoPrivateLeak(
      detailRaw,
      tripId,
      planId,
      AUTHOR.id,
      VIEWER.id,
      "숙소가 너무 비싸요",
      "memberOpinions",
      "sourceTripId",
      "sourcePlanId"
    );
    // feed 응답에도 동일하게 누출이 없어야 한다.
    assertNoPrivateLeak(JSON.stringify(feedBody), tripId, planId, AUTHOR.id, VIEWER.id);

    // 비로그인 세션은 feed/detail 접근 불가(401).
    const anon = await harness.requestAs(null, "/api/explore/listings");
    expect(anon.status).toBe(401);
  });

  it("concurrent first-list(unique 충돌 loser)은 503이 아니라 winner의 같은 listing을 idempotent하게 받는다", async () => {
    // 진짜 race를 결정론적으로 재현한다: loser는 findBySource===none을 통과한 뒤
    // INSERT 직전에 winner가 같은 source의 LISTED row를 먼저 커밋한다(interleave 훅).
    // 그러면 loser의 INSERT는 실제 unique 충돌 경로(ON CONFLICT DO NOTHING → 0 rows
    // → 같은 tx에서 기존 row 재조회)를 밟고, RepositoryError(503) 대신 winner의
    // immutable listing을 그대로 반환해야 한다.
    const tripId = "trip-1-race";
    const planId = "plan-1-race";
    const winnerListingId = "listing-1-winner";
    const harness = createJourneyHarness({
      participants: [{ id: AUTHOR.id, name: AUTHOR.name }],
      tripRooms: [
        privateRoom({
          tripId,
          host: AUTHOR,
          plans: [
            publishablePlan({ planId, authorId: AUTHOR.id, authorName: AUTHOR.name }),
          ],
        }),
      ],
    });

    // INSERT 직전에 winner row가 먼저 존재하게 만든다(concurrent winner commit).
    harness.store.beforeNextListingInsert = () => {
      harness.store.exploreListings.set(
        winnerListingId,
        listedListing({
          listingId: winnerListingId,
          sourceTripId: tripId,
          sourcePlanId: planId,
          sourceAuthorParticipantId: AUTHOR.id,
        })
      );
      harness.store.exploreListingCities.set(winnerListingId, new Set(["osaka"]));
    };

    const loser = await harness.requestAs(
      AUTHOR.id,
      `/api/trips/${tripId}/plans/${planId}/explore-listing`,
      jsonBody({})
    );
    // 503(RepositoryError)이 아니라 201 + winner의 listingId.
    expect(loser.status).toBe(201);
    const body = (await loser.json()) as { listingId: string; status: string };
    expect(body.status).toBe("LISTED");
    expect(body.listingId).toBe(winnerListingId);

    // 논리적으로 단 하나의 listing row만 존재한다(loser가 새 row를 만들지 않음).
    const listingsForSource = [...harness.store.exploreListings.values()].filter(
      (l) => l.sourceTripId === tripId && l.sourcePlanId === planId
    );
    expect(listingsForSource).toHaveLength(1);
    expect(listingsForSource[0]!.id).toBe(winnerListingId);
    expect(harness.store.exploreListingCities.get(winnerListingId)).toEqual(
      new Set(["osaka"])
    );
  });

  it("같은 plan을 두 번 게시(double-submit/재시도)해도 503이 아니라 같은 listing을 idempotent하게 반환한다", async () => {
    // concurrent first-list(같은 source plan을 동시에 게시)의 user-observable
    // 계약: loser는 unique 충돌을 RepositoryError(503)로 흘리지 않고, winner가
    // 만든 동일 immutable listing을 그대로 받는다. 여기서는 순차 double-submit로
    // 그 관찰 가능한 결과(동일 listingId, 201, single row)를 재현한다.
    const tripId = "trip-1-dup";
    const planId = "plan-1-dup";
    const harness = createJourneyHarness({
      participants: [{ id: AUTHOR.id, name: AUTHOR.name }],
      tripRooms: [
        privateRoom({
          tripId,
          host: AUTHOR,
          plans: [
            publishablePlan({ planId, authorId: AUTHOR.id, authorName: AUTHOR.name }),
          ],
        }),
      ],
    });

    const first = await harness.requestAs(
      AUTHOR.id,
      `/api/trips/${tripId}/plans/${planId}/explore-listing`,
      jsonBody({})
    );
    expect(first.status).toBe(201);
    const firstListingId = ((await first.json()) as { listingId: string }).listingId;

    const second = await harness.requestAs(
      AUTHOR.id,
      `/api/trips/${tripId}/plans/${planId}/explore-listing`,
      jsonBody({})
    );
    // 503이 아니라 idempotent 201, 같은 listingId.
    expect(second.status).toBe(201);
    const secondListingId = ((await second.json()) as { listingId: string }).listingId;
    expect(secondListingId).toBe(firstListingId);

    // 논리적으로 단 하나의 listing row만 존재한다(중복 게시 없음).
    const listingsForSource = [...harness.store.exploreListings.values()].filter(
      (l) => l.sourceTripId === tripId && l.sourcePlanId === planId
    );
    expect(listingsForSource).toHaveLength(1);
    expect(listingsForSource[0]!.status).toBe("LISTED");
  });

  it("인기 도시와 cityId feed filter가 sidecar 전체 LISTED 상태를 사용한다", async () => {
    const harness = createJourneyHarness({
      participants: [{ id: VIEWER.id, name: VIEWER.name }],
      exploreListings: [
        listedListing({
          listingId: "listing-osaka",
          sourceTripId: "trip-osaka",
          sourcePlanId: "plan-osaka",
          sourceAuthorParticipantId: AUTHOR.id,
          cityIds: ["osaka"],
        }),
        listedListing({
          listingId: "listing-both",
          sourceTripId: "trip-both",
          sourcePlanId: "plan-both",
          sourceAuthorParticipantId: AUTHOR.id,
          cityIds: ["osaka", "kyoto", "kyoto"],
        }),
        listedListing({
          listingId: "listing-kyoto",
          sourceTripId: "trip-kyoto",
          sourcePlanId: "plan-kyoto",
          sourceAuthorParticipantId: AUTHOR.id,
          cityIds: ["kyoto"],
        }),
      ],
    });
    harness.store.exploreListings.get("listing-kyoto")!.status = "UNLISTED";

    const popular = await harness.requestAs(
      VIEWER.id,
      "/api/explore/popular-cities"
    );
    expect(popular.status).toBe(200);
    expect(await popular.json()).toEqual({
      items: [
        { cityId: "osaka", listingCount: 2 },
        { cityId: "kyoto", listingCount: 1 },
      ],
    });

    const kyotoFeed = await harness.requestAs(
      VIEWER.id,
      "/api/explore/listings?cityId=kyoto"
    );
    expect(kyotoFeed.status).toBe(200);
    expect(
      ((await kyotoFeed.json()) as { items: Array<{ listingId: string }> }).items.map(
        (item) => item.listingId
      )
    ).toEqual(["listing-both"]);
  });
});

describe("Journey 2: save → Home saved ideas → unsave", () => {
  it("save는 idempotent하고 saved-list read-through·unsave가 일관된다", async () => {
    const tripId = "trip-2";
    const planId = "plan-2";
    const listingId = "listing-2";
    const harness = createJourneyHarness({
      participants: [
        { id: AUTHOR.id, name: AUTHOR.name },
        { id: VIEWER.id, name: VIEWER.name },
      ],
      tripRooms: [
        privateRoom({
          tripId,
          host: AUTHOR,
          plans: [
            publishablePlan({ planId, authorId: AUTHOR.id, authorName: AUTHOR.name }),
          ],
        }),
      ],
      exploreListings: [
        listedListing({
          listingId,
          sourceTripId: tripId,
          sourcePlanId: planId,
          sourceAuthorParticipantId: AUTHOR.id,
        }),
      ],
    });

    // 초기 saved-list는 비어 있다.
    const before = await harness.requestAs(VIEWER.id, "/api/me/saved");
    expect(before.status).toBe(200);
    expect(((await before.json()) as { items: unknown[] }).items).toHaveLength(0);

    // save (LISTED만 허용) → { saved: true }.
    const save1 = await harness.requestAs(
      VIEWER.id,
      `/api/explore/listings/${listingId}/save`,
      jsonBody({})
    );
    expect(save1.status).toBe(200);
    expect((await save1.json()) as unknown).toEqual({ saved: true });

    // idempotent: 다시 저장해도 중복 row가 생기지 않는다.
    const save2 = await harness.requestAs(
      VIEWER.id,
      `/api/explore/listings/${listingId}/save`,
      jsonBody({})
    );
    expect(save2.status).toBe(200);
    expect((await save2.json()) as unknown).toEqual({ saved: true });
    expect(
      harness.store.exploreSaves.filter(
        (s) => s.participantId === VIEWER.id && s.listingId === listingId
      )
    ).toHaveLength(1);

    // Home saved ideas: 실제 저장 항목을 read-through로 본다(1건, private ID 미노출).
    const savedList = await harness.requestAs(VIEWER.id, "/api/me/saved");
    expect(savedList.status).toBe(200);
    const savedBody = (await savedList.json()) as {
      items: Array<{ savedAt: string; listing: { listingId: string; status: string } }>;
    };
    expect(savedBody.items).toHaveLength(1);
    expect(savedBody.items[0]!.listing.listingId).toBe(listingId);
    expect(savedBody.items[0]!.listing.status).toBe("LISTED");
    assertNoPrivateLeak(JSON.stringify(savedBody), tripId, planId, AUTHOR.id, VIEWER.id);

    // 저장 상태는 세션(actor)별로 격리된다: author는 저장한 적 없다.
    const authorSaved = await harness.requestAs(AUTHOR.id, "/api/me/saved");
    expect(((await authorSaved.json()) as { items: unknown[] }).items).toHaveLength(0);

    // unsave → { saved: false }, saved-list에서 사라진다.
    const unsave = await harness.requestAs(
      VIEWER.id,
      `/api/explore/listings/${listingId}/save`,
      { method: "DELETE", body: "{}" }
    );
    expect(unsave.status).toBe(200);
    expect((await unsave.json()) as unknown).toEqual({ saved: false });

    const after = await harness.requestAs(VIEWER.id, "/api/me/saved");
    expect(((await after.json()) as { items: unknown[] }).items).toHaveLength(0);
  });
});

describe("Journey 3: NEW_TRIP import → private trip → independent edit / no live sync", () => {
  it("import한 plan은 독립 소유이고 source 변경/재게시와 동기화되지 않는다", async () => {
    const sourceTripId = "trip-3-src";
    const sourcePlanId = "plan-3-src";
    const listingId = "listing-3";
    const harness = createJourneyHarness({
      participants: [
        { id: AUTHOR.id, name: AUTHOR.name },
        { id: VIEWER.id, name: VIEWER.name },
      ],
      tripRooms: [
        privateRoom({
          tripId: sourceTripId,
          host: AUTHOR,
          plans: [
            publishablePlan({
              planId: sourcePlanId,
              authorId: AUTHOR.id,
              authorName: AUTHOR.name,
            }),
          ],
        }),
      ],
      exploreListings: [
        listedListing({
          listingId,
          sourceTripId,
          sourcePlanId,
          sourceAuthorParticipantId: AUTHOR.id,
          title: "오사카 벚꽃 여행",
        }),
      ],
    });

    // viewer가 NEW_TRIP으로 import → 자신의 새 private trip이 생긴다.
    const importRes = await harness.requestAs(
      VIEWER.id,
      `/api/explore/listings/${listingId}/import`,
      jsonBody({ target: { type: "NEW_TRIP", title: "내 오사카 여행" } })
    );
    expect(importRes.status).toBe(201);
    const imported = (await importRes.json()) as { tripId: string; planId: string };
    expect(imported.tripId).not.toBe(sourceTripId);
    expect(imported.planId).not.toBe(sourcePlanId);

    // 응답 allowlist: tripId/planId만 (snapshot/provenance/source ref 없음).
    expect(Object.keys(imported).sort()).toEqual(["planId", "tripId"]);

    // viewer는 자신의 새 trip을 소유·조회할 수 있다.
    const myTrip = await harness.requestAs(VIEWER.id, `/api/trips/${imported.tripId}`);
    expect(myTrip.status).toBe(200);
    const myTripBody = (await myTrip.json()) as {
      title: string;
      revision: number;
      plans: Array<{
        id: string;
        title: string;
        authorId?: string;
        revision?: number;
        importedFromExploreListingId?: string;
        baseHeadcount?: number;
        routes?: unknown[];
        accommodations?: unknown[];
        transports?: unknown[];
        places: unknown[];
      }>;
    };
    expect(myTripBody.title).toBe("내 오사카 여행");
    expect(myTripBody.plans).toHaveLength(1);
    const myPlan = myTripBody.plans[0]!;
    // 독립 소유: authorId=viewer, revision=1, provenance=공개 listingId(=source private ID 아님).
    expect(myPlan.authorId).toBe(VIEWER.id);
    expect(myPlan.revision).toBe(1);
    expect(myPlan.importedFromExploreListingId).toBe(listingId);
    expect(myPlan.id).toBe(imported.planId);

    // imported plan을 viewer가 실제 private PATCH로 독립 수정한다. source snapshot을
    // 덮어쓰거나 source private aggregate를 역참조하지 않는다.
    const editImported = await harness.requestAs(
      VIEWER.id,
      `/api/trips/${imported.tripId}/plans/${imported.planId}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          title: "내가 직접 다듬은 오사카 여행",
          baseHeadcount: myPlan.baseHeadcount,
          routes: myPlan.routes,
          accommodations: myPlan.accommodations,
          transports: myPlan.transports,
          places: myPlan.places,
          expectedRevision: myTripBody.revision,
        }),
      }
    );
    expect(editImported.status).toBe(200);
    const editedImportedRoom = (await editImported.json()) as {
      revision: number;
      plans: Array<{
        id: string;
        title: string;
        importedFromExploreListingId?: string;
      }>;
    };
    expect(editedImportedRoom.revision).toBe(2);
    expect(
      editedImportedRoom.plans.find((candidate) => candidate.id === imported.planId)
    ).toMatchObject({
      title: "내가 직접 다듬은 오사카 여행",
      importedFromExploreListingId: listingId,
    });

    // imported copy 수정은 source private plan에 역전파되지 않는다.
    const sourceAfterImportedEdit = await harness.requestAs(
      AUTHOR.id,
      `/api/trips/${sourceTripId}`
    );
    const sourceAfterImportedEditBody = (await sourceAfterImportedEdit.json()) as {
      plans: Array<{ title: string }>;
    };
    expect(sourceAfterImportedEditBody.plans[0]!.title).toBe("오사카 벚꽃 여행");

    // author는 viewer의 새 trip에 접근할 수 없다(비멤버 → 404).
    const authorPeek = await harness.requestAs(AUTHOR.id, `/api/trips/${imported.tripId}`);
    expect(authorPeek.status).toBe(404);

    // no live sync: source author가 원본 plan을 수정한다(revision 상승).
    const editSource = await harness.requestAs(
      AUTHOR.id,
      `/api/trips/${sourceTripId}/plans/${sourcePlanId}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          title: "완전히 바뀐 원본",
          baseHeadcount: 2,
          routes: [
            { city: "오사카", arrivalDate: "2026-09-01", departureDate: "2026-09-04" },
          ],
          accommodations: [
            {
              id: `${sourcePlanId}-stay-1`,
              city: "오사카",
              period: "2026-09-01 ~ 2026-09-04",
              nights: 3,
              hotelName: "완전히 다른 호텔",
              isSearching: false,
              bookingStatus: "NOT_CHECKED",
            },
          ],
          transports: [
            {
              id: `${sourcePlanId}-transport-1`,
              fromCity: "서울",
              toCity: "오사카",
              mode: "비행기",
              hasTransfer: false,
              durationText: "1시간 40분",
              bookingStatus: "NOT_CHECKED",
            },
            {
              id: `${sourcePlanId}-transport-2`,
              fromCity: "오사카",
              toCity: "서울",
              mode: "비행기",
              hasTransfer: false,
              durationText: "1시간 40분",
              bookingStatus: "NOT_CHECKED",
            },
          ],
          places: [],
          expectedRevision: 1,
        }),
      }
    );
    expect(editSource.status).toBe(200);

    // viewer의 imported plan은 자신의 독립 수정 상태를 유지한다. 이후 원본 제목
    // 변경도 전파되지 않고, provenance 역시 source와의 live-sync capability가 아니다.
    const myTripAfter = await harness.requestAs(VIEWER.id, `/api/trips/${imported.tripId}`);
    const myTripAfterBody = (await myTripAfter.json()) as {
      plans: Array<{ title: string; revision?: number; importedFromExploreListingId?: string }>;
    };
    expect(myTripAfterBody.plans[0]!.title).toBe(
      "내가 직접 다듬은 오사카 여행"
    );
    expect(myTripAfterBody.plans[0]!.title).not.toBe("완전히 바뀐 원본");
    expect(myTripAfterBody.plans[0]!.importedFromExploreListingId).toBe(listingId);
  });
});

describe("Journey 4: EXISTING_TRIP import → concurrent 409 → latest refetch/retry", () => {
  it("stale expectedRevision import는 409, 최신 revision으로 재시도하면 성공한다", async () => {
    const sourceTripId = "trip-4-src";
    const sourcePlanId = "plan-4-src";
    const listingId = "listing-4";
    const targetTripId = "trip-4-target";
    const IMPORTER = { id: "importer-4", name: "가져오는사람" };
    const COEDITOR = { id: "coeditor-4", name: "동시편집자" };

    const harness = createJourneyHarness({
      participants: [
        { id: AUTHOR.id, name: AUTHOR.name },
        { id: IMPORTER.id, name: IMPORTER.name },
        { id: COEDITOR.id, name: COEDITOR.name },
      ],
      tripRooms: [
        privateRoom({
          tripId: sourceTripId,
          host: AUTHOR,
          plans: [
            publishablePlan({
              planId: sourcePlanId,
              authorId: AUTHOR.id,
              authorName: AUTHOR.name,
            }),
          ],
        }),
        // importer가 host, coeditor가 member인 대상 방(둘 다 plan:create 가능).
        privateRoom({
          tripId: targetTripId,
          host: IMPORTER,
          extraMembers: [COEDITOR],
          plans: [],
          revision: 1,
        }),
      ],
      exploreListings: [
        listedListing({
          listingId,
          sourceTripId,
          sourcePlanId,
          sourceAuthorParticipantId: AUTHOR.id,
        }),
      ],
    });

    // importer가 대상 방을 revision 1로 읽었다고 가정. 그 사이 별도 coeditor
    // 세션이 plan을 생성해 room revision을 2로 올린다.
    const concurrentEdit = await harness.requestAs(
      COEDITOR.id,
      `/api/trips/${targetTripId}/plans`,
      jsonBody({
        title: "동시 편집자가 만든 여행안",
        baseHeadcount: 2,
        routes: [
          {
            city: "교토",
            arrivalDate: "2026-10-01",
            departureDate: "2026-10-04",
          },
        ],
        accommodations: [
          {
            id: "coeditor-stay-1",
            city: "교토",
            period: "2026-10-01 ~ 2026-10-04",
            nights: 3,
            hotelName: "",
            isSearching: true,
            bookingStatus: "NOT_CHECKED",
          },
        ],
        transports: [
          {
            id: "coeditor-transport-1",
            fromCity: "서울",
            toCity: "교토",
            mode: "",
            hasTransfer: false,
            durationText: "",
            bookingStatus: "NOT_CHECKED",
          },
          {
            id: "coeditor-transport-2",
            fromCity: "교토",
            toCity: "서울",
            mode: "",
            hasTransfer: false,
            durationText: "",
            bookingStatus: "NOT_CHECKED",
          },
        ],
        places: [],
        expectedRevision: 1,
      })
    );
    expect(concurrentEdit.status).toBe(201);
    expect(((await concurrentEdit.json()) as { revision: number }).revision).toBe(2);

    // importer가 stale revision 1로 EXISTING_TRIP import → 409 REVISION_CONFLICT.
    const staleImport = await harness.requestAs(
      IMPORTER.id,
      `/api/explore/listings/${listingId}/import`,
      jsonBody({
        target: { type: "EXISTING_TRIP", tripId: targetTripId, expectedRevision: 1 },
      })
    );
    expect(staleImport.status).toBe(409);
    const conflictBody = (await staleImport.json()) as { error: { code: string } };
    expect(conflictBody.error.code).toBe("REVISION_CONFLICT");

    // 아직 import되지 않았다(대상 방 plan은 1개 그대로).
    const midTrip = await harness.requestAs(IMPORTER.id, `/api/trips/${targetTripId}`);
    const midBody = (await midTrip.json()) as { revision: number; plans: unknown[] };
    expect(midBody.plans).toHaveLength(1);

    // recovery: 최신 revision(2)으로 refetch/retry → 성공.
    const retryImport = await harness.requestAs(
      IMPORTER.id,
      `/api/explore/listings/${listingId}/import`,
      jsonBody({
        target: {
          type: "EXISTING_TRIP",
          tripId: targetTripId,
          expectedRevision: midBody.revision,
        },
      })
    );
    expect(retryImport.status).toBe(201);
    const retried = (await retryImport.json()) as { tripId: string; planId: string };
    expect(retried.tripId).toBe(targetTripId);

    // 대상 방에 새 plan이 추가됐고 revision이 다시 올랐다.
    const finalTrip = await harness.requestAs(IMPORTER.id, `/api/trips/${targetTripId}`);
    const finalBody = (await finalTrip.json()) as {
      revision: number;
      plans: Array<{ id: string; authorId?: string; importedFromExploreListingId?: string }>;
    };
    expect(finalBody.plans).toHaveLength(2);
    expect(finalBody.revision).toBe(3);
    const importedPlan = finalBody.plans.find((p) => p.id === retried.planId)!;
    expect(importedPlan.authorId).toBe(IMPORTER.id);
    expect(importedPlan.importedFromExploreListingId).toBe(listingId);
  });
});

describe("Journey 5: unlist / source deletion → feed·detail·save·import unavailable", () => {
  it("unlist 후 feed 제거·detail 410·save 410·import 410으로 일관된다", async () => {
    const tripId = "trip-5";
    const planId = "plan-5";
    const listingId = "listing-5";
    const harness = createJourneyHarness({
      participants: [
        { id: AUTHOR.id, name: AUTHOR.name },
        { id: VIEWER.id, name: VIEWER.name },
      ],
      tripRooms: [
        privateRoom({
          tripId,
          host: AUTHOR,
          plans: [
            publishablePlan({ planId, authorId: AUTHOR.id, authorName: AUTHOR.name }),
          ],
        }),
      ],
      exploreListings: [
        listedListing({
          listingId,
          sourceTripId: tripId,
          sourcePlanId: planId,
          sourceAuthorParticipantId: AUTHOR.id,
        }),
      ],
    });

    // 게시 상태: viewer feed/detail에 노출된다.
    const feedBefore = await harness.requestAs(VIEWER.id, "/api/explore/listings");
    expect(((await feedBefore.json()) as { items: unknown[] }).items).toHaveLength(1);

    // author가 unlist한다(LISTED revision 1 → UNLISTED).
    const unlist = await harness.requestAs(
      AUTHOR.id,
      `/api/explore/listings/${listingId}`,
      { method: "DELETE", body: JSON.stringify({ expectedRevision: 1 }) }
    );
    expect(unlist.status).toBe(200);
    expect(((await unlist.json()) as { status: string }).status).toBe("UNLISTED");

    // feed에서 사라진다.
    const feedAfter = await harness.requestAs(VIEWER.id, "/api/explore/listings");
    expect(((await feedAfter.json()) as { items: unknown[] }).items).toHaveLength(0);

    // detail은 410 (NotFound와 구분되는 gone).
    const detail = await harness.requestAs(VIEWER.id, `/api/explore/listings/${listingId}`);
    expect(detail.status).toBe(410);

    // save 불가 410.
    const save = await harness.requestAs(
      VIEWER.id,
      `/api/explore/listings/${listingId}/save`,
      jsonBody({})
    );
    expect(save.status).toBe(410);

    // import 불가 410.
    const importRes = await harness.requestAs(
      VIEWER.id,
      `/api/explore/listings/${listingId}/import`,
      jsonBody({ target: { type: "NEW_TRIP" } })
    );
    expect(importRes.status).toBe(410);
  });

  it("source plan 삭제는 LISTED listing을 auto-unlist하고 이후 접근이 모두 unavailable", async () => {
    const tripId = "trip-5b";
    const planId = "plan-5b";
    const harness = createJourneyHarness({
      participants: [
        { id: AUTHOR.id, name: AUTHOR.name },
        { id: VIEWER.id, name: VIEWER.name },
      ],
      tripRooms: [
        privateRoom({
          tripId,
          host: AUTHOR,
          plans: [
            publishablePlan({ planId, authorId: AUTHOR.id, authorName: AUTHOR.name }),
          ],
        }),
      ],
    });

    // author가 실제 API로 게시 → LISTED.
    const listRes = await harness.requestAs(
      AUTHOR.id,
      `/api/trips/${tripId}/plans/${planId}/explore-listing`,
      jsonBody({})
    );
    expect(listRes.status).toBe(201);
    const listingId = ((await listRes.json()) as { listingId: string }).listingId;
    const storedBeforeDelete = harness.store.exploreListings.get(
      listingId
    ) as ExploreListingRecord;
    const snapshotBeforeDelete = JSON.stringify(storedBeforeDelete.snapshot);
    const listedAtBeforeDelete = storedBeforeDelete.listedAt;
    const listingRevisionBeforeDelete = storedBeforeDelete.listingRevision;

    // viewer feed에 1건.
    const feedBefore = await harness.requestAs(VIEWER.id, "/api/explore/listings");
    expect(((await feedBefore.json()) as { items: unknown[] }).items).toHaveLength(1);

    // author가 source plan을 삭제한다(room revision 1 CAS + auto-unlist 단일 tx).
    const del = await harness.requestAs(
      AUTHOR.id,
      `/api/trips/${tripId}/plans/${planId}`,
      { method: "DELETE", body: JSON.stringify({ expectedRevision: 1 }) }
    );
    expect(del.status).toBe(200);

    // listing이 auto-unlist됐다: feed에서 사라지고 detail/save/import 모두 410.
    const feedAfter = await harness.requestAs(VIEWER.id, "/api/explore/listings");
    expect(((await feedAfter.json()) as { items: unknown[] }).items).toHaveLength(0);

    const detail = await harness.requestAs(VIEWER.id, `/api/explore/listings/${listingId}`);
    expect(detail.status).toBe(410);

    const save = await harness.requestAs(
      VIEWER.id,
      `/api/explore/listings/${listingId}/save`,
      jsonBody({})
    );
    expect(save.status).toBe(410);

    const importRes = await harness.requestAs(
      VIEWER.id,
      `/api/explore/listings/${listingId}/import`,
      jsonBody({ target: { type: "NEW_TRIP" } })
    );
    expect(importRes.status).toBe(410);

    // store invariant: listing row와 immutable snapshot/original listedAt은 보존하되
    // lifecycle만 revision +1 / UNLISTED / unlistedAt으로 전이된다.
    const stored = harness.store.exploreListings.get(listingId) as ExploreListingRecord;
    expect(stored.status).toBe("UNLISTED");
    expect(stored.listingRevision).toBe(listingRevisionBeforeDelete + 1);
    expect(JSON.stringify(stored.snapshot)).toBe(snapshotBeforeDelete);
    expect(stored.listedAt).toBe(listedAtBeforeDelete);
    expect(stored.unlistedAt).not.toBeNull();
  });
});
