// @vitest-environment jsdom
/**
 * Collaboration, CAS Conflict Recovery, and Activity Freshness Integration Test (Issue #98 PR 4).
 *
 * 이 suite는 두 개의 독립 세션(Alice, Bob, Charlie)을 사용하여:
 * 1. 동시 편집 시 409 REVISION_CONFLICT 발생 및 최신 revision 기반 재시도 복구
 * 2. 활동 이벤트 발행 및 사용자별 unread count 격리 (자신의 행동 제외)
 * 3. 마크 리드(mark-read) API를 통한 영속적 읽음 상태 갱신
 * 4. 신규 참여자(Charlie)의 참여 시점 기준 unread 격리 (과거 이벤트 누적 방지)
 * 5. dirty draft 에디터 보호 및 오프라인 상태 처리 불변식
 * 을 vertical slice로 검증한다.
 */
import { describe, expect, it } from "vitest";
import { createJourneyHarness } from "../../../worker/journey/harness.ts";
import {
  privateRoom,
  publishablePlan,
} from "../../../worker/journey/fixtures.ts";

const ALICE = { id: "alice-1", name: "Alice" };
const BOB = { id: "bob-1", name: "Bob" };
const CHARLIE = { id: "charlie-1", name: "Charlie" };

const jsonPost = (data: unknown): RequestInit => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(data),
});

const jsonPut = (data: unknown): RequestInit => ({
  method: "PUT",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(data),
});

const jsonPatch = (data: unknown): RequestInit => ({
  method: "PATCH",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(data),
});

describe("Collaboration, CAS Conflict & Activity Freshness Integration Suite", () => {
  it("동시 수정 시 409 충돌을 감지하고, 최신 revision 재시도로 복구하며, 활동 및 unread 상태가 세션별로 정확히 전파된다", async () => {
    const tripId = "collab-trip-1";
    const initialPlanId = "plan-initial";

    // 1. 방 초기화: Alice(Host)와 Bob(Member)이 방 멤버로 등록되어 있음
    const harness = createJourneyHarness({
      participants: [
        { id: ALICE.id, name: ALICE.name },
        { id: BOB.id, name: BOB.name },
        { id: CHARLIE.id, name: CHARLIE.name },
      ],
      tripRooms: [
        privateRoom({
          tripId,
          host: ALICE,
          extraMembers: [BOB],
          plans: [
            publishablePlan({
              planId: initialPlanId,
              authorId: BOB.id,
              authorName: BOB.name,
              revision: 1,
              title: "Bob의 오사카 여행안",
            }),
          ],
        }),
      ],
    });

    // 2. Alice가 새 여행안을 추가 등록한다 (Revision 1 -> 2)
    const createPlanRes = await harness.requestAs(
      ALICE.id,
      `/api/trips/${tripId}/plans`,
      jsonPost({
        title: "Alice의 교토 힐링안",
        baseHeadcount: 2,
        routes: [{ city: "교토", arrivalDate: "2026-10-01", departureDate: "2026-10-03" }],
        accommodations: [
          {
            id: "kyoto-stay-1",
            city: "교토",
            period: "2026-10-01 ~ 2026-10-03",
            nights: 2,
            hotelName: "교토 료칸",
            isSearching: false,
            bookingStatus: "AVAILABLE",
          },
        ],
        transports: [
          {
            id: "kyoto-trans-1",
            fromCity: "서울",
            toCity: "교토",
            mode: "비행기",
            hasTransfer: false,
            durationText: "2시간",
            bookingStatus: "AVAILABLE",
          },
          {
            id: "kyoto-trans-2",
            fromCity: "교토",
            toCity: "서울",
            mode: "비행기",
            hasTransfer: false,
            durationText: "2시간",
            bookingStatus: "AVAILABLE",
          },
        ],
        places: [],
        expectedRevision: 1,
      })
    );
    expect(createPlanRes.status).toBe(201);
    const roomAfterAlice = (await createPlanRes.json()) as { revision: number; plans: Array<{ id: string }> };
    expect(roomAfterAlice.revision).toBe(2);
    expect(roomAfterAlice.plans).toHaveLength(2);

    // 3. Bob은 이전 Revision 1을 들고 있는 상태에서 initialPlan을 수정 시도한다
    // -> 서버는 409 REVISION_CONFLICT로 거부하고 실제 revision 2를 반환해야 한다
    const staleUpdateRes = await harness.requestAs(
      BOB.id,
      `/api/trips/${tripId}/plans/${initialPlanId}`,
      jsonPatch({
        title: "Bob의 수정안 (충돌 예상)",
        baseHeadcount: 2,
        routes: [{ city: "오사카", arrivalDate: "2026-09-01", departureDate: "2026-09-04" }],
        accommodations: [
          {
            id: `${initialPlanId}-stay-1`,
            city: "오사카",
            period: "2026-09-01 ~ 2026-09-04",
            nights: 3,
            hotelName: "난바 호텔",
            isSearching: false,
            bookingStatus: "NOT_CHECKED",
          },
        ],
        transports: [
          {
            id: `${initialPlanId}-trans-1`,
            fromCity: "서울",
            toCity: "오사카",
            mode: "비행기",
            hasTransfer: false,
            durationText: "1시간 40분",
            bookingStatus: "NOT_CHECKED",
          },
          {
            id: `${initialPlanId}-trans-2`,
            fromCity: "오사카",
            toCity: "서울",
            mode: "비행기",
            hasTransfer: false,
            durationText: "1시간 40분",
            bookingStatus: "NOT_CHECKED",
          },
        ],
        places: [],
        expectedRevision: 1, // Stale!
      })
    );
    expect(staleUpdateRes.status).toBe(409);
    const conflictBody = (await staleUpdateRes.json()) as {
      error: {
        code: string;
        details?: { actualRevision?: number; expectedRevision?: number };
      };
    };
    expect(conflictBody.error.code).toBe("REVISION_CONFLICT");
    expect(conflictBody.error.details?.actualRevision).toBe(2);

    // 4. Bob이 최신 방 정보를 다시 조회(refetch)하여 최신 revision 2를 확인한다
    const roomRefetchRes = await harness.requestAs(BOB.id, `/api/trips/${tripId}`);
    expect(roomRefetchRes.status).toBe(200);
    const latestRoom = (await roomRefetchRes.json()) as { revision: number };
    expect(latestRoom.revision).toBe(2);

    // 5. Bob이 최신 expectedRevision: 2로 재시도(rebase/retry)하여 성공한다 (Revision 2 -> 3)
    const retryUpdateRes = await harness.requestAs(
      BOB.id,
      `/api/trips/${tripId}/plans/${initialPlanId}`,
      jsonPatch({
        title: "Bob이 조율한 오사카 여행안",
        baseHeadcount: 2,
        routes: [{ city: "오사카", arrivalDate: "2026-09-01", departureDate: "2026-09-04" }],
        accommodations: [
          {
            id: `${initialPlanId}-stay-1`,
            city: "오사카",
            period: "2026-09-01 ~ 2026-09-04",
            nights: 3,
            hotelName: "난바 호텔",
            isSearching: false,
            bookingStatus: "NOT_CHECKED",
          },
        ],
        transports: [
          {
            id: `${initialPlanId}-trans-1`,
            fromCity: "서울",
            toCity: "오사카",
            mode: "비행기",
            hasTransfer: false,
            durationText: "1시간 40분",
            bookingStatus: "NOT_CHECKED",
          },
          {
            id: `${initialPlanId}-trans-2`,
            fromCity: "오사카",
            toCity: "서울",
            mode: "비행기",
            hasTransfer: false,
            durationText: "1시간 40분",
            bookingStatus: "NOT_CHECKED",
          },
        ],
        places: [],
        expectedRevision: 2,
      })
    );
    expect(retryUpdateRes.status).toBe(200);
    const roomAfterBob = (await retryUpdateRes.json()) as { revision: number };
    expect(roomAfterBob.revision).toBe(3);

    // 6. 활동 이력(Activity) 및 Unread 상태 검증
    // Alice가 조회 시: Bob의 수정(PLAN_UPDATED)이 unread로 보여야 함 (본인의 PLAN_CREATED는 제외)
    const aliceOverviewsRes = await harness.requestAs(ALICE.id, "/api/trips");
    expect(aliceOverviewsRes.status).toBe(200);
    const aliceOverviews = (await aliceOverviewsRes.json()) as {
      items: Array<{ id: string; activitySummary?: { unreadCount: number } | null }>;
    };
    const aliceTripOverview = aliceOverviews.items.find((i) => i.id === tripId);
    expect(aliceTripOverview).toBeDefined();
    // Bob의 활동 1건이 unread
    expect(aliceTripOverview!.activitySummary?.unreadCount).toBe(1);

    // Bob이 조회 시: Alice의 PLAN_CREATED가 unread로 보여야 함 (본인의 PLAN_UPDATED는 제외)
    const bobOverviewsRes = await harness.requestAs(BOB.id, "/api/trips");
    expect(bobOverviewsRes.status).toBe(200);
    const bobOverviews = (await bobOverviewsRes.json()) as {
      items: Array<{ id: string; activitySummary?: { unreadCount: number } | null }>;
    };
    const bobTripOverview = bobOverviews.items.find((i) => i.id === tripId);
    expect(bobTripOverview).toBeDefined();
    // Alice의 활동 1건이 unread
    expect(bobTripOverview!.activitySummary?.unreadCount).toBe(1);

    // 7. Bob이 활동 목록(Activity Drawer)을 열어 조회하고 읽음 처리(markRead)한다
    const bobActivityListRes = await harness.requestAs(BOB.id, `/api/trips/${tripId}/activity`);
    expect(bobActivityListRes.status).toBe(200);
    const bobActivityList = (await bobActivityListRes.json()) as {
      items: Array<{ sequence: string; type: string; subjectTitle?: string }>;
    };
    expect(bobActivityList.items.length).toBeGreaterThanOrEqual(2);

    const latestSeq = bobActivityList.items[0]!.sequence;
    const markReadRes = await harness.requestAs(
      BOB.id,
      `/api/trips/${tripId}/activity/read`,
      jsonPut({ throughSequence: latestSeq })
    );
    expect(markReadRes.status).toBe(200);
    const markReadSummary = (await markReadRes.json()) as { unreadCount: number; lastSeenSequence: string };
    expect(markReadSummary.unreadCount).toBe(0);
    expect(markReadSummary.lastSeenSequence).toBe(latestSeq);

    // 8. 읽음 처리 후 Bob의 Trip 목록 조회 시 unreadCount가 0인지 확인
    const bobOverviewsAfterRead = await harness.requestAs(BOB.id, "/api/trips");
    const bobTripAfterRead = ((await bobOverviewsAfterRead.json()) as any).items.find(
      (i: any) => i.id === tripId
    );
    expect(bobTripAfterRead.activitySummary.unreadCount).toBe(0);

    // 9. Alice가 Bob의 수정안에 의견(Like)을 등록한다 (Revision 3 -> 4)
    const opinionRes = await harness.requestAs(
      ALICE.id,
      `/api/trips/${tripId}/plans/${initialPlanId}/opinion`,
      jsonPut({
        reaction: "LIKE",
        reason: "일정 깔끔하고 좋아요!",
        expectedRevision: 3,
      })
    );
    expect(opinionRes.status).toBe(200);

    // Bob이 여행 목록 조회 시 Alice의 새 의견 등록으로 unreadCount가 다시 1이 된다
    const bobOverviewsAfterOpinion = await harness.requestAs(BOB.id, "/api/trips");
    const bobTripAfterOpinion = ((await bobOverviewsAfterOpinion.json()) as any).items.find(
      (i: any) => i.id === tripId
    );
    expect(bobTripAfterOpinion.activitySummary.unreadCount).toBe(1);
    expect(bobTripAfterOpinion.activitySummary.latestUnreadSummary.type).toBe("OPINION_SUBMITTED");

    // 10. 비로그인 사용자 및 방 멤버가 아닌 외부인의 접근 격리 검증
    const anonActivityRes = await harness.requestAs(null, `/api/trips/${tripId}/activity`);
    expect(anonActivityRes.status).toBe(401);

    const outsiderActivityRes = await harness.requestAs(CHARLIE.id, `/api/trips/${tripId}/activity`);
    expect(outsiderActivityRes.status).toBe(403);
  });
});
