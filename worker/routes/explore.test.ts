import { drizzle, type NodePgClient } from "drizzle-orm/node-postgres";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PlanIdSchema,
  RevisionSchema,
  TripIdSchema,
} from "../../src/core/domain/ids.ts";
import type { TripPlan, TripRoom } from "../../src/core/domain/room.ts";
import type { ExplorePlanSnapshot } from "../../src/core/domain/explore-plan.ts";
import type { DatabaseHandle } from "../../src/infrastructure/persistence/drizzle/database.ts";
import * as schema from "../../src/infrastructure/persistence/drizzle/schema/index.ts";
import {
  createApp,
  type AppDependencies,
  type AppEnv,
} from "../app.ts";

const baseUrl = "https://galanda.test";
const env = {} as AppEnv["Bindings"];

const authorId = "user-author";
const hostId = "user-host";

const plan: TripPlan = {
  id: PlanIdSchema.make("plan-1"),
  title: "오사카 여행안",
  status: "VOTING",
  revision: RevisionSchema.make(3),
  publishedAt: "2026-08-24T00:00:00.000Z",
  authorId: authorId as TripPlan["authorId"],
  authorName: "작성자",
  baseHeadcount: 2,
  routes: [{ city: "오사카", arrivalDate: "2026-09-01", departureDate: "2026-09-04" }],
  accommodations: [
    {
      id: "stay-osaka",
      city: "오사카",
      period: "2026-09-01 ~ 2026-09-04",
      nights: 3,
      hotelName: "",
      isSearching: true,
      bookingStatus: "NOT_CHECKED",
    },
  ],
  transports: [
    {
      id: "outbound-osaka",
      fromCity: "인천",
      toCity: "오사카",
      mode: "",
      hasTransfer: false,
      durationText: "",
      bookingStatus: "NOT_CHECKED",
    },
    {
      id: "return-osaka",
      fromCity: "오사카",
      toCity: "인천",
      mode: "",
      hasTransfer: false,
      durationText: "",
      bookingStatus: "NOT_CHECKED",
    },
  ],
  places: [],
  memberOpinions: [],
  voteCount: 0,
};

const room: TripRoom = {
  id: TripIdSchema.make("trip-1"),
  title: "오사카 여행",
  destination: "오사카",
  revision: RevisionSchema.make(3),
  members: [
    { id: authorId as TripRoom["members"][number]["id"], name: "작성자", role: "MEMBER" },
    { id: hostId as TripRoom["members"][number]["id"], name: "방장", role: "HOST" },
  ],
  plans: [plan],
  confirmedPlanId: undefined,
};

const roomRow = (value: TripRoom): Array<unknown> => [
  value.id,
  value.title,
  value.destination,
  value.revision,
  value.members,
  value.plans,
  value.confirmedPlanId ?? null,
  "2026-08-23T00:00:00.000Z",
  "2026-08-23T00:00:00.000Z",
];

const listingSnapshot: ExplorePlanSnapshot = {
  title: plan.title,
  destination: room.destination,
  routes: [{ city: "오사카", arrivalDate: "2026-09-01", departureDate: "2026-09-04" }],
  dateRange: { startDate: "2026-09-01", endDate: "2026-09-04", nightCount: 3 },
  stays: [],
  transports: [],
  author: { displayName: "작성자" },
  sourcePlanRevision: RevisionSchema.make(3),
};

/** explore_plan_listings row in schema column order. */
const listingRow = (over?: {
  id?: string;
  status?: string;
  listingRevision?: number;
  listedAt?: string;
  unlistedAt?: string | null;
  sourceAuthorParticipantId?: string;
}): Array<unknown> => {
  const listedAt = over?.listedAt ?? "2026-08-25T00:00:00.000Z";
  return [
    over?.id ?? "listing-1",
    room.id,
    plan.id,
    over?.sourceAuthorParticipantId ?? authorId,
    listingSnapshot,
    over?.status ?? "LISTED",
    over?.listingRevision ?? 1,
    3,
    listedAt,
    listedAt,
    over?.unlistedAt ?? null,
  ];
};

const rankedListingRow = (over?: Parameters<typeof listingRow>[0]): Array<unknown> => {
  const legacy = listingRow(over);
  return [
    legacy[0],
    legacy[1],
    legacy[2],
    legacy[3],
    legacy[5],
    legacy[6],
    legacy[7],
    legacy[4],
    legacy[8],
    legacy[9],
    legacy[10],
    0,
    0,
    0,
  ];
};

const publicListingRow = (over?: Parameters<typeof listingRow>[0]): Array<unknown> =>
  rankedListingRow(over).slice(0, 12);

interface DbBehavior {
  readonly tripRoomRows?: Array<Array<unknown>>;
  /** rows returned by the create() source-revalidation `select "plans" ... for update` */
  readonly tripRoomLockRows?: Array<Array<unknown>>;
  /** rows returned by trip_rooms insert ... returning (NEW_TRIP import) */
  readonly tripRoomInsertRows?: Array<Array<unknown>>;
  /** rows returned by trip_rooms update ... returning (EXISTING_TRIP CAS) */
  readonly tripRoomUpdateRows?: Array<Array<unknown>>;
  /** response for the first explore select (findBySource or getById) */
  readonly exploreSelectRows?: Array<Array<unknown>>;
  /** rows returned by listing insert ... on conflict do nothing returning (empty => unique conflict) */
  readonly exploreInsertRows?: Array<Array<unknown>>;
  /** response for the CAS re-select of current revision (update miss) */
  readonly exploreCasSelectRows?: Array<Array<unknown>>;
  /** rows returned by update ... returning (empty => CAS miss) */
  readonly exploreUpdateRows?: Array<Array<unknown>>;
  /** rows returned by the public city aggregate */
  readonly popularCityRows?: Array<Array<unknown>>;
}

const makeApp = (
  behavior: DbBehavior,
  user: { readonly id: string; readonly name: string } | null = {
    id: authorId,
    name: "작성자",
  }
) => {
  const calls: Array<{ readonly text: string; readonly params: unknown[] }> = [];
  let exploreSelectCount = 0;
  const client = {
    query: async (
      config: { readonly text: string },
      params: unknown[] = []
    ) => {
      const text = config.text;
      if (
        text.includes('from "participant_alias"') &&
        !text.includes('"explore_plan_saves"')
      ) return { rows: [] };
      if (/^(begin|commit|rollback)/i.test(text)) return { rows: [] };
      calls.push({ text, params });

      if (text.includes('"trip_rooms"') && text.startsWith("select")) {
        // create()의 source revalidation: `select "plans" ... for update`는
        // plans projection만 잠가서 읽는다. getRoom의 전체 row select와 구분해
        // positional [plans] 형태로 반환한다.
        if (text.includes("for update")) {
          return { rows: behavior.tripRoomLockRows ?? [[room.plans]] };
        }
        return { rows: behavior.tripRoomRows ?? [roomRow(room)] };
      }
      if (text.includes('"trip_rooms"') && text.startsWith("insert")) {
        return { rows: behavior.tripRoomInsertRows ?? [] };
      }
      if (text.includes('"trip_rooms"') && text.startsWith("update")) {
        return { rows: behavior.tripRoomUpdateRows ?? [] };
      }
      if (
        text.includes('"explore_listing_cities"') &&
        text.includes("group by")
      ) {
        return { rows: behavior.popularCityRows ?? [] };
      }
      if (text.includes('"explore_plan_listings"')) {
        if (text.startsWith("insert")) {
          // 실제 INSERT는 ON CONFLICT DO NOTHING RETURNING "id". 정상 삽입은 1 row,
          // concurrent unique 충돌은 0 rows(→ create()가 기존 row 재조회).
          return { rows: behavior.exploreInsertRows ?? [["listing-1"]] };
        }
        if (text.startsWith("update")) {
          return { rows: behavior.exploreUpdateRows ?? [] };
        }
        if (text.startsWith("select")) {
          // first explore select is findBySource/getById; a later select during
          // CAS returns the current revision for conflict detection.
          exploreSelectCount += 1;
          if (exploreSelectCount === 1) {
            return { rows: behavior.exploreSelectRows ?? [] };
          }
          return { rows: behavior.exploreCasSelectRows ?? [] };
        }
      }
      return { rows: [] };
    },
  };
  const db = drizzle(client as unknown as NodePgClient, { schema });
  const makeAuth = (() => ({
    handler: () => new Response(),
    api: {
      getSession: async () =>
        user ? { user: { ...user, email: `${user.id}@example.com` } } : null,
    },
  })) as unknown as NonNullable<AppDependencies["makeAuth"]>;
  const withDatabase: NonNullable<AppDependencies["withDatabase"]> = async (
    _requestEnv,
    run
  ) => run(db as DatabaseHandle);

  return {
    app: createApp({
      makeAuth,
      withDatabase,
      resolveParticipantIdentity: async (_db, authUserId) => ({
        participantId: authUserId as never,
        participantIds: [authUserId as never],
      }),
    }),
    calls,
  };
};

const request = (path: string, init?: RequestInit) =>
  new Request(`${baseUrl}${path}`, {
    ...init,
    headers: init?.body ? { "content-type": "application/json" } : undefined,
  });

afterEach(() => vi.restoreAllMocks());

describe("Explore API vertical slice (RAON-259 DISC-3)", () => {
  it("POST .../explore-listing: author가 게시하면 201 + 공개 DTO를 반환하고 source private ID를 노출하지 않는다", async () => {
    const { app } = makeApp({ exploreSelectRows: [] }); // findBySource -> none
    const res = await app.fetch(request("/api/trips/trip-1/plans/plan-1/explore-listing", {
        method: "POST",
        body: JSON.stringify({ themeIds: ["nature", "food"] }),
      }), env);

    expect(res.status).toBe(201);
    const body = (await res.json()) as Record<string, any>;
    const raw = JSON.stringify(body);
    expect(body.status).toBe("LISTED");
    expect(body.listingRevision).toBe(1);
    expect(body.snapshot.author.displayName).toBe("작성자");
    expect(body.snapshot.themeIds).toEqual(["food", "nature"]);
    // privacy: 실제 source private IDs가 response JSON에 없어야 한다.
    expect(raw).not.toContain("trip-1");
    expect(raw).not.toContain("plan-1");
    expect(raw).not.toContain(authorId);
    expect(body.sourceTripId).toBeUndefined();
    expect(body.sourcePlanId).toBeUndefined();
    expect(body.sourceAuthorParticipantId).toBeUndefined();
  });

  it("POST .../explore-listing: body에 spoof 필드가 있으면 400으로 거부한다", async () => {
    const { app } = makeApp({});
    const res = await app.fetch(request("/api/trips/trip-1/plans/plan-1/explore-listing", {
        method: "POST",
        body: JSON.stringify({ authorId: "user-evil", snapshot: { title: "x" } }),
      }), env);
    expect(res.status).toBe(400);
  });

  it("POST .../explore-listing: arbitrary theme ID나 client label은 400으로 거부한다", async () => {
    const { app } = makeApp({});
    const arbitraryId = await app.fetch(
      request("/api/trips/trip-1/plans/plan-1/explore-listing", {
        method: "POST",
        body: JSON.stringify({ themeIds: ["custom-theme"] }),
      }),
      env
    );
    const clientLabel = await app.fetch(
      request("/api/trips/trip-1/plans/plan-1/explore-listing", {
        method: "POST",
        body: JSON.stringify({ themeIds: ["food"], themeLabel: "내 테마" }),
      }),
      env
    );

    expect(arbitraryId.status).toBe(400);
    expect(clientLabel.status).toBe(400);
  });

  it("POST .../explore-listing: 작성자가 아니면(HOST여도) 403", async () => {
    const { app } = makeApp({ exploreSelectRows: [] }, { id: hostId, name: "방장" });
    const res = await app.fetch(request("/api/trips/trip-1/plans/plan-1/explore-listing", {
        method: "POST",
        body: JSON.stringify({}),
      }), env);
    expect(res.status).toBe(403);
  });

  it("POST .../explore-listing: room 비참여자에게는 404로 존재를 숨긴다", async () => {
    const { app } = makeApp({}, { id: "user-outsider", name: "외부인" });
    const res = await app.fetch(request("/api/trips/trip-1/plans/plan-1/explore-listing", {
        method: "POST",
        body: JSON.stringify({}),
      }), env);
    expect(res.status).toBe(404);
  });

  it("POST .../explore-listing: concurrent delete가 lock 하에서 source plan을 없애면 listing을 만들지 않고 404로 fail-closed한다 (RAON-244/DISC-10)", async () => {
    // getRoom(auth/authz)에서는 plan이 아직 보이지만, create의
    // `select "plans" ... for update`(concurrent delete 커밋 이후) 시점에는
    // source plan이 사라진 상태를 모델링한다. 삭제된 source에 대한 LISTED
    // listing INSERT가 발생하면 안 된다.
    const { app, calls } = makeApp({
      exploreSelectRows: [], // findBySource -> none (첫 게시 경로)
      tripRoomLockRows: [[[]]], // lock 하에서 plans가 비어 source plan 없음
    });
    const res = await app.fetch(request("/api/trips/trip-1/plans/plan-1/explore-listing", {
        method: "POST",
        body: JSON.stringify({}),
      }), env);

    expect(res.status).toBe(404);
    // 삭제된 source에 대한 listing INSERT가 절대 실행되지 않았음을 증명한다.
    const insertedListing = calls.some(
      (c) =>
        c.text.startsWith("insert") && c.text.includes('"explore_plan_listings"')
    );
    expect(insertedListing).toBe(false);
  });

  it("DELETE /api/explore/listings/:id: author가 unlist하면 200 + UNLISTED", async () => {
    const { app } = makeApp({
      exploreSelectRows: [listingRow({ status: "LISTED", listingRevision: 1 })],
      exploreUpdateRows: [[2]], // CAS success
    });
    const res = await app.fetch(request("/api/explore/listings/listing-1", {
        method: "DELETE",
        body: JSON.stringify({ expectedRevision: 1 }),
      }), env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, any>;
    expect(body.status).toBe("UNLISTED");
    expect(JSON.stringify(body)).not.toContain(authorId);
  });

  it("DELETE /api/explore/listings/:id: excess property는 400", async () => {
    const { app } = makeApp({});
    const res = await app.fetch(request("/api/explore/listings/listing-1", {
        method: "DELETE",
        body: JSON.stringify({ expectedRevision: 1, extra: "nope" }),
      }), env);
    expect(res.status).toBe(400);
  });

  it("DELETE /api/explore/listings/:id: 작성자가 아니면 403", async () => {
    const { app } = makeApp(
      {
        exploreSelectRows: [
          listingRow({ status: "LISTED", sourceAuthorParticipantId: authorId }),
        ],
      },
      { id: hostId, name: "방장" }
    );
    const res = await app.fetch(request("/api/explore/listings/listing-1", {
        method: "DELETE",
        body: JSON.stringify({ expectedRevision: 1 }),
      }), env);
    expect(res.status).toBe(403);
  });

  it("DELETE /api/explore/listings/:id: stale revision이면 409", async () => {
    const { app } = makeApp({
      exploreSelectRows: [listingRow({ status: "LISTED", listingRevision: 5 })],
      exploreUpdateRows: [], // CAS miss
      exploreCasSelectRows: [[5]], // current revision
    });
    const res = await app.fetch(request("/api/explore/listings/listing-1", {
        method: "DELETE",
        body: JSON.stringify({ expectedRevision: 1 }),
      }), env);
    expect(res.status).toBe(409);
  });

  it("POST /api/explore/listings/:id/relist: author가 relist하면 200 + LISTED, 새 snapshot", async () => {
    const { app } = makeApp({
      exploreSelectRows: [
        listingRow({ status: "UNLISTED", listingRevision: 2, unlistedAt: "2026-08-26T00:00:00.000Z" }),
      ],
      exploreUpdateRows: [[3]], // CAS success
    });
    const res = await app.fetch(request("/api/explore/listings/listing-1/relist", {
        method: "POST",
        body: JSON.stringify({ expectedRevision: 2 }),
      }), env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, any>;
    expect(body.status).toBe("LISTED");
    expect(body.unlistedAt).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain(authorId);
  });

  it("POST /api/explore/listings/:id/relist: 검증 후 source 삭제가 먼저 commit되면 404이고 UNLISTED를 되살리지 않는다", async () => {
    // getById에서는 UNLISTED listing, getRoom(auth/authz)에서는 source plan이
    // 존재하지만, relist transaction이 room FOR UPDATE lock을 얻은 시점에는
    // concurrent delete가 commit되어 plans가 비어 있는 interleaving이다.
    const { app, calls } = makeApp({
      exploreSelectRows: [
        listingRow({
          status: "UNLISTED",
          listingRevision: 2,
          unlistedAt: "2026-08-26T00:00:00.000Z",
        }),
      ],
      tripRoomLockRows: [[[]]],
      // 버그가 남아 listing CAS까지 도달하면 성공하도록 두어 잘못된 relist를 탐지한다.
      exploreUpdateRows: [[3]],
    });

    const res = await app.fetch(
      request("/api/explore/listings/listing-1/relist", {
        method: "POST",
        body: JSON.stringify({ expectedRevision: 2 }),
      }),
      env
    );

    expect(res.status).toBe(404);
    expect(
      calls.some(
        (call) =>
          call.text.startsWith("update") &&
          call.text.includes('"explore_plan_listings"')
      )
    ).toBe(false);
  });

  it("POST /api/explore/listings/:id/relist: 존재하지 않는 listing은 404", async () => {
    const { app } = makeApp({ exploreSelectRows: [] });
    const res = await app.fetch(request("/api/explore/listings/listing-missing/relist", {
        method: "POST",
        body: JSON.stringify({ expectedRevision: 2 }),
      }), env);
    expect(res.status).toBe(404);
  });
  it("PUT /api/explore/listings/:id/themes: author가 ID-only 분류를 CAS로 수정한다", async () => {
    const { app } = makeApp({
      exploreSelectRows: [listingRow({ status: "LISTED", listingRevision: 1 })],
      exploreUpdateRows: [[2]],
    });
    const res = await app.fetch(
      request("/api/explore/listings/listing-1/themes", {
        method: "PUT",
        body: JSON.stringify({
          expectedRevision: 1,
          themeIds: ["nature", "food"],
        }),
      }),
      env
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, any>;
    expect(body.listingRevision).toBe(2);
    expect(body.snapshot.themeIds).toEqual(["food", "nature"]);
    expect(body.snapshot.sourcePlanRevision).toBe(3);
  });
});

describe("Explore feed read (GET /api/explore/listings) — RAON-260 DISC-4", () => {
  it("authenticated session은 다른 Trip membership 없이 공개 feed를 조회한다", async () => {
    const { app, calls } = makeApp({
      exploreSelectRows: [
        rankedListingRow({ id: "listing-1", listedAt: "2026-08-25T00:00:00.000Z" }),
        rankedListingRow({ id: "listing-2", listedAt: "2026-08-24T00:00:00.000Z" }),
      ],
    });
    const res = await app.fetch(request("/api/explore/listings"), env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: Array<Record<string, any>>; nextCursor?: string };
    expect(body.items).toHaveLength(2);
    expect(body.items.map((i) => i.listingId)).toEqual(["listing-1", "listing-2"]);
    // private aggregate read-through 금지: trip_rooms를 조회하지 않는다.
    expect(calls.some((c) => c.text.includes('"trip_rooms"'))).toBe(false);
    // 오직 explore_plan_listings만 읽는다.
    expect(calls.some((c) => c.text.includes('"explore_plan_listings"'))).toBe(true);
  });

  it("public shape만 반환하고 source private ID를 노출하지 않는다", async () => {
    const { app } = makeApp({
      exploreSelectRows: [rankedListingRow({ id: "listing-1" })],
    });
    const res = await app.fetch(request("/api/explore/listings"), env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: Array<Record<string, any>> };
    const raw = JSON.stringify(body);
    // 실제 source private IDs가 응답에 없어야 한다.
    expect(raw).not.toContain("trip-1");
    expect(raw).not.toContain("plan-1");
    expect(raw).not.toContain(authorId);
    const item = body.items[0]!;
    expect(item.sourceTripId).toBeUndefined();
    expect(item.sourcePlanId).toBeUndefined();
    expect(item.sourceAuthorParticipantId).toBeUndefined();
    // 공개 카드 계약 필드만.
    expect(item.snapshot.title).toBe("오사카 여행안");
    expect(item.snapshot.author.displayName).toBe("작성자");
    // fake popularity/image/count 없음.
    expect("popularity" in item.snapshot).toBe(false);
    expect("saveCount" in item.snapshot).toBe(false);
    expect("imageUrl" in item.snapshot).toBe(false);
  });

  it("미인증 세션은 401로 거부한다", async () => {
    const { app } = makeApp({ exploreSelectRows: [] }, null);
    const res = await app.fetch(request("/api/explore/listings"), env);
    expect(res.status).toBe(401);
  });

  it("limit이 상한(50)을 넘으면 400으로 거부한다", async () => {
    const { app } = makeApp({ exploreSelectRows: [] });
    const res = await app.fetch(request("/api/explore/listings?limit=51"), env);
    expect(res.status).toBe(400);
  });

  it("limit이 정수가 아니면 400으로 거부한다", async () => {
    const { app } = makeApp({ exploreSelectRows: [] });
    const res = await app.fetch(request("/api/explore/listings?limit=abc"), env);
    expect(res.status).toBe(400);
  });

  it("malformed cursor는 400으로 거부한다(첫 페이지로 조용히 fallback하지 않는다)", async () => {
    const { app } = makeApp({ exploreSelectRows: [] });
    const res = await app.fetch(
      request("/api/explore/listings?cursor=%21not-a-valid-cursor%21"),
      env
    );
    expect(res.status).toBe(400);
  });

  it("oversized cursor는 decode 전에 400으로 거부한다", async () => {
    const { app } = makeApp({ exploreSelectRows: [] });
    const cursor = "a".repeat(4097);
    const res = await app.fetch(
      request(`/api/explore/listings?cursor=${cursor}`),
      env,
    );
    expect(res.status).toBe(400);
  });

  it("검색·목적지·경유 도시·테마·기간 filter를 strict DTO로 받아 public listing query에 전달한다", async () => {
    const { app, calls } = makeApp({ exploreSelectRows: [rankedListingRow()] });
    const params = new URLSearchParams({
      query: "오사카",
      destination: "일본",
      routeCity: "교토",
      themeId: "food",
      startDate: "2026-09-01",
      endDate: "2026-09-30",
    });
    const res = await app.fetch(
      request(`/api/explore/listings?${params.toString()}`),
      env
    );

    expect(res.status).toBe(200);
    const select = calls.find(
      (call) =>
        call.text.startsWith("select") &&
        call.text.includes('from "explore_plan_listings"')
    )!;
    expect(select.text).toContain("jsonb_array_elements");
    expect(select.text).not.toContain('"trip_rooms"');
    expect(select.params).toEqual(
      expect.arrayContaining([
        "LISTED",
        "오사카",
        "일본",
        "교토",
        "food",
        "2026-09-01",
        "2026-09-30",
      ])
    );
  });

  it("빈 filter와 100자를 넘는 filter를 400으로 거부한다", async () => {
    const { app } = makeApp({ exploreSelectRows: [] });
    const blank = await app.fetch(
      request("/api/explore/listings?query=%20%20"),
      env
    );
    const oversized = await app.fetch(
      request(`/api/explore/listings?destination=${"a".repeat(101)}`),
      env
    );
    expect(blank.status).toBe(400);
    expect(oversized.status).toBe(400);
  });

  it("알 수 없는 themeId는 400으로 거부한다", async () => {
    const { app } = makeApp({ exploreSelectRows: [] });
    const res = await app.fetch(
      request("/api/explore/listings?themeId=custom-theme"),
      env
    );
    expect(res.status).toBe(400);
  });

  it("유효하지 않거나 역순인 date range를 400으로 거부한다", async () => {
    const { app } = makeApp({ exploreSelectRows: [] });
    const invalid = await app.fetch(
      request("/api/explore/listings?startDate=2026-99-01"),
      env
    );
    const reversed = await app.fetch(
      request(
        "/api/explore/listings?startDate=2026-10-31&endDate=2026-10-01"
      ),
      env
    );
    expect(invalid.status).toBe(400);
    expect(reversed.status).toBe(400);
  });

  it("지원하지 않는 query/filter는 조용히 무시하지 않고 400으로 거부한다", async () => {
    const { app } = makeApp({ exploreSelectRows: [] });
    const res = await app.fetch(
      request("/api/explore/listings?popularity=trending"),
      env,
    );
    expect(res.status).toBe(400);
  });

  it("cityId filter는 canonical city aggregate와 sidecar query로 전달한다", async () => {
    const { app, calls } = makeApp({ exploreSelectRows: [rankedListingRow()] });
    const res = await app.fetch(
      request("/api/explore/listings?cityId=osaka"),
      env
    );

    expect(res.status).toBe(200);
    const select = calls.find(
      (call) =>
        call.text.startsWith("select") &&
        call.text.includes('from "explore_plan_listings"')
    )!;
    expect(select.text).toContain('"explore_listing_cities"');
    expect(select.text).toContain("city.city_id");
    expect(select.params).toContain("osaka");
  });

  it("알 수 없는 cityId는 400으로 거부한다", async () => {
    const { app } = makeApp({ exploreSelectRows: [] });
    const res = await app.fetch(
      request("/api/explore/listings?cityId=not-a-city"),
      env
    );
    expect(res.status).toBe(400);
  });

  it("인기 도시 aggregate는 인증된 public listing만 집계하고 strict query를 적용한다", async () => {
    const { app, calls } = makeApp({
      popularCityRows: [["osaka", "3"], ["kyoto", 2]],
    });
    const res = await app.fetch(request("/api/explore/popular-cities"), env);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      items: [
        { cityId: "osaka", listingCount: 3 },
        { cityId: "kyoto", listingCount: 2 },
      ],
    });
    const aggregate = calls.find((call) => call.text.includes("group by"))!;
    expect(aggregate.text).toContain('"explore_listing_cities"');
    expect(aggregate.text).toContain('"explore_plan_listings"');
    expect(aggregate.text).not.toContain('"trip_rooms"');

    const strict = await app.fetch(
      request("/api/explore/popular-cities?limit=8"),
      env
    );
    expect(strict.status).toBe(400);
  });

  it("인기 도시 aggregate는 미인증 세션을 401로 거부한다", async () => {
    const { app } = makeApp({ popularCityRows: [] }, null);
    const res = await app.fetch(request("/api/explore/popular-cities"), env);
    expect(res.status).toBe(401);
  });

  it("hasMore일 때 opaque nextCursor를 발급하고, 그 cursor로 다음 페이지를 조회할 수 있다", async () => {
    // limit=1 요청 + 2 rows → adapter가 limit+1=2를 조회하고 hasMore로 판단.
    const { app } = makeApp({
      exploreSelectRows: [
        rankedListingRow({ id: "listing-1", listedAt: "2026-08-25T00:00:00.000Z" }),
        rankedListingRow({ id: "listing-2", listedAt: "2026-08-24T00:00:00.000Z" }),
      ],
    });
    const res = await app.fetch(request("/api/explore/listings?limit=1"), env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: Array<Record<string, any>>; nextCursor?: string };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]!.listingId).toBe("listing-1");
    expect(typeof body.nextCursor).toBe("string");
    expect(body.nextCursor!.length).toBeGreaterThan(0);
    // opaque token은 내부 tuple을 평문으로 노출하지 않는다.
    expect(body.nextCursor).not.toContain("listing-1");

    // 발급된 cursor를 그대로 다시 넘기면 (round-trip decode 성공) 200을 받는다.
    const { app: app2 } = makeApp({
      exploreSelectRows: [rankedListingRow({ id: "listing-2", listedAt: "2026-08-24T00:00:00.000Z" })],
    });
    const res2 = await app2.fetch(
      request(`/api/explore/listings?limit=1&cursor=${encodeURIComponent(body.nextCursor!)}`),
      env
    );
    expect(res2.status).toBe(200);
    const body2 = (await res2.json()) as { items: Array<Record<string, any>>; nextCursor?: string };
    expect(body2.items[0]!.listingId).toBe("listing-2");
    expect(body2.nextCursor).toBeUndefined();

    // cursor는 발급 당시 filter identity에 묶인다. 다른 filter로 재사용하면
    // matching rows를 건너뛰지 않도록 400으로 fail-closed한다.
    const mismatched = await app2.fetch(
      request(
        `/api/explore/listings?limit=1&themeId=food&cursor=${encodeURIComponent(body.nextCursor!)}`
      ),
      env
    );
    expect(mismatched.status).toBe(400);
  });
});

describe("Explore listing detail (GET /api/explore/listings/:listingId) — RAON-263 DISC-5", () => {
  it("LISTED listing은 200 + public detail을 반환하고 source private ID를 노출하지 않는다", async () => {
    const { app, calls } = makeApp({
      exploreSelectRows: [publicListingRow({ id: "listing-1", status: "LISTED" })],
    });
    const res = await app.fetch(request("/api/explore/listings/listing-1"), env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, any>;
    const raw = JSON.stringify(body);

    expect(body.status).toBe("LISTED");
    expect(body.snapshot.title).toBe("오사카 여행안");
    expect(body.snapshot.author.displayName).toBe("작성자");

    // privacy: source private IDs가 응답에 없어야 한다.
    expect(raw).not.toContain("trip-1");
    expect(raw).not.toContain("plan-1");
    expect(raw).not.toContain(authorId);
    expect(body.sourceTripId).toBeUndefined();
    expect(body.sourcePlanId).toBeUndefined();
    expect(body.sourceAuthorParticipantId).toBeUndefined();

    // private aggregate read-through 금지: trip_rooms를 조회하지 않는다.
    expect(calls.some((c) => c.text.includes('"trip_rooms"'))).toBe(false);
    // 오직 explore_plan_listings만 읽는다.
    expect(calls.some((c) => c.text.includes('"explore_plan_listings"'))).toBe(
      true
    );
  });

  it("UNLISTED listing은 410 LISTING_UNAVAILABLE로 응답한다(cached private fallback 없음)", async () => {
    const { app, calls } = makeApp({
      exploreSelectRows: [
        publicListingRow({
          id: "listing-1",
          status: "UNLISTED",
          listingRevision: 2,
          unlistedAt: "2026-08-26T00:00:00.000Z",
        }),
      ],
    });
    const res = await app.fetch(request("/api/explore/listings/listing-1"), env);
    expect(res.status).toBe(410);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("LISTING_UNAVAILABLE");
    // UNLISTED여도 source aggregate를 read-through하지 않는다.
    expect(calls.some((c) => c.text.includes('"trip_rooms"'))).toBe(false);
  });

  it("존재하지 않는 listing은 404 NOT_FOUND로 응답한다", async () => {
    const { app } = makeApp({ exploreSelectRows: [] });
    const res = await app.fetch(
      request("/api/explore/listings/listing-missing"),
      env
    );
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("미인증 세션은 401로 거부한다", async () => {
    const { app } = makeApp({ exploreSelectRows: [] }, null);
    const res = await app.fetch(request("/api/explore/listings/listing-1"), env);
    expect(res.status).toBe(401);
  });
});

// --- RAON-261 DISC-7: snapshot import ---------------------------------------

/** publish validation을 통과할 수 있는 import 대상 snapshot. */
const importableSnapshot: ExplorePlanSnapshot = {
  title: "오사카 여행안",
  destination: "오사카",
  routes: [{ city: "오사카", arrivalDate: "2026-09-01", departureDate: "2026-09-04" }],
  dateRange: { startDate: "2026-09-01", endDate: "2026-09-04", nightCount: 3 },
  stays: [{ city: "오사카", isSearching: true, nights: 3 }],
  transports: [
    { fromCity: "인천", toCity: "오사카", mode: "항공", hasTransfer: false, durationText: "1시간 40분" },
    { fromCity: "오사카", toCity: "인천", mode: "항공", hasTransfer: false, durationText: "1시간 40분" },
  ],
  author: { displayName: "작성자" },
  sourcePlanRevision: RevisionSchema.make(3),
};

/** explore_plan_listings row with an importable snapshot (column order). */
const importableListingRow = (over?: {
  status?: string;
}): Array<unknown> => [
  "listing-1",
  room.id,
  plan.id,
  authorId,
  importableSnapshot,
  over?.status ?? "LISTED",
  1,
  3,
  "2026-08-25T00:00:00.000Z",
  "2026-08-25T00:00:00.000Z",
  null,
];

describe("Explore snapshot import (POST /api/explore/listings/:id/import) — RAON-261 DISC-7", () => {
  it("NEW_TRIP: LISTED snapshot을 새 방에 복사하고 201 + {tripId, planId}만 반환한다(private ID 미노출)", async () => {
    const { app, calls } = makeApp({
      exploreSelectRows: [importableListingRow()],
      // createRoom insert ... returning 이 non-empty row를 돌려줘야 성공.
      tripRoomInsertRows: [roomRow(room)],
    });
    const res = await app.fetch(
      request("/api/explore/listings/listing-1/import", {
        method: "POST",
        body: JSON.stringify({ target: { type: "NEW_TRIP" } }),
      }),
      env
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as Record<string, any>;
    // 응답 allowlist: tripId, planId만.
    expect(Object.keys(body).sort()).toEqual(["planId", "tripId"]);
    expect(typeof body.tripId).toBe("string");
    expect(typeof body.planId).toBe("string");
    // privacy: source private IDs 미노출.
    const raw = JSON.stringify(body);
    expect(raw).not.toContain("plan-1");
    expect(raw).not.toContain(authorId);
    // 단일 aggregate write: trip_rooms insert 발생, update(saveRoom CAS)는 없음.
    expect(calls.some((c) => c.text.includes('"trip_rooms"') && c.text.startsWith("insert"))).toBe(true);
    expect(calls.some((c) => c.text.includes('"trip_rooms"') && c.text.startsWith("update"))).toBe(false);
  });

  it("NEW_TRIP: body에 server-owned spoof 필드가 있으면 400으로 거부한다", async () => {
    const { app } = makeApp({ exploreSelectRows: [importableListingRow()] });
    const res = await app.fetch(
      request("/api/explore/listings/listing-1/import", {
        method: "POST",
        body: JSON.stringify({
          target: { type: "NEW_TRIP" },
          authorId: "user-evil",
          status: "CONFIRMED",
          snapshot: { title: "x" },
          importedFromExploreListingId: "listing-evil",
        }),
      }),
      env
    );
    expect(res.status).toBe(400);
  });

  it("NEW_TRIP: target union에 unknown 필드가 있으면 400으로 거부한다", async () => {
    const { app } = makeApp({ exploreSelectRows: [importableListingRow()] });
    const res = await app.fetch(
      request("/api/explore/listings/listing-1/import", {
        method: "POST",
        body: JSON.stringify({ target: { type: "NEW_TRIP", revision: 9, authorId: "x" } }),
      }),
      env
    );
    expect(res.status).toBe(400);
  });

  it("EXISTING_TRIP: 멤버가 미확정 방에 CAS로 plan을 추가하면 201 + {tripId, planId}", async () => {
    const { app, calls } = makeApp({
      exploreSelectRows: [importableListingRow()],
      // getRoom select는 기본 roomRow(room) (revision 3). saveRoom update CAS 성공.
      tripRoomUpdateRows: [roomRow({ ...room, revision: RevisionSchema.make(4) })],
    });
    const res = await app.fetch(
      request("/api/explore/listings/listing-1/import", {
        method: "POST",
        body: JSON.stringify({
          target: { type: "EXISTING_TRIP", tripId: "trip-1", expectedRevision: 3 },
        }),
      }),
      env
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as Record<string, any>;
    expect(Object.keys(body).sort()).toEqual(["planId", "tripId"]);
    expect(body.tripId).toBe("trip-1");
    // aggregate CAS: trip_rooms update 발생.
    expect(calls.some((c) => c.text.includes('"trip_rooms"') && c.text.startsWith("update"))).toBe(true);
  });

  it("EXISTING_TRIP: stale expectedRevision이면 409 REVISION_CONFLICT", async () => {
    const { app } = makeApp({
      exploreSelectRows: [importableListingRow()],
    });
    const res = await app.fetch(
      request("/api/explore/listings/listing-1/import", {
        method: "POST",
        body: JSON.stringify({
          target: { type: "EXISTING_TRIP", tripId: "trip-1", expectedRevision: 1 },
        }),
      }),
      env
    );
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("REVISION_CONFLICT");
  });

  it("EXISTING_TRIP: 비멤버(outsider)는 403", async () => {
    const { app } = makeApp(
      { exploreSelectRows: [importableListingRow()] },
      { id: "user-outsider", name: "외부인" }
    );
    const res = await app.fetch(
      request("/api/explore/listings/listing-1/import", {
        method: "POST",
        body: JSON.stringify({
          target: { type: "EXISTING_TRIP", tripId: "trip-1", expectedRevision: 3 },
        }),
      }),
      env
    );
    expect(res.status).toBe(403);
  });

  it("존재하지 않는 listing import는 404", async () => {
    const { app } = makeApp({ exploreSelectRows: [] });
    const res = await app.fetch(
      request("/api/explore/listings/listing-missing/import", {
        method: "POST",
        body: JSON.stringify({ target: { type: "NEW_TRIP" } }),
      }),
      env
    );
    expect(res.status).toBe(404);
  });

  it("UNLISTED listing import는 410 LISTING_UNAVAILABLE", async () => {
    const { app } = makeApp({
      exploreSelectRows: [importableListingRow({ status: "UNLISTED" })],
    });
    const res = await app.fetch(
      request("/api/explore/listings/listing-1/import", {
        method: "POST",
        body: JSON.stringify({ target: { type: "NEW_TRIP" } }),
      }),
      env
    );
    expect(res.status).toBe(410);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("LISTING_UNAVAILABLE");
  });

  it("미인증 세션 import는 401", async () => {
    const { app } = makeApp({ exploreSelectRows: [importableListingRow()] }, null);
    const res = await app.fetch(
      request("/api/explore/listings/listing-1/import", {
        method: "POST",
        body: JSON.stringify({ target: { type: "NEW_TRIP" } }),
      }),
      env
    );
    expect(res.status).toBe(401);
  });
});
