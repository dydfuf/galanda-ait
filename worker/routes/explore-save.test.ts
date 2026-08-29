import { drizzle, type NodePgClient } from "drizzle-orm/node-postgres";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RevisionSchema } from "../../src/core/domain/ids.ts";
import type { ExplorePlanSnapshot } from "../../src/core/domain/explore-plan.ts";
import type { DatabaseHandle } from "../../src/infrastructure/persistence/drizzle/database.ts";
import * as schema from "../../src/infrastructure/persistence/drizzle/schema/index.ts";
import { createApp, type AppDependencies, type AppEnv } from "../app.ts";

const baseUrl = "https://galanda.test";
const env = {} as AppEnv["Bindings"];

const saverId = "participant-1";

const listingSnapshot: ExplorePlanSnapshot = {
  title: "오사카 여행안",
  destination: "오사카",
  routes: [{ city: "오사카", arrivalDate: "2026-09-01", departureDate: "2026-09-04" }],
  dateRange: { startDate: "2026-09-01", endDate: "2026-09-04", nightCount: 3 },
  stays: [],
  transports: [],
  author: { displayName: "작성자" },
  sourcePlanRevision: RevisionSchema.make(3),
};

/** explore_plan_listings row in schema column order (getById). */
const listingRow = (over?: { status?: string }): Array<unknown> => {
  const listedAt = "2026-08-25T00:00:00.000Z";
  return [
    "listing-1",
    "trip-1",
    "plan-1",
    "author-1",
    listingSnapshot,
    over?.status ?? "LISTED",
    1,
    3,
    listedAt,
    listedAt,
    null,
  ];
};

/** saved-list join row in select() key order: savedAt,id,status,listingRevision,sourcePlanRevision,snapshot,listedAt,updatedAt,unlistedAt */
const savedJoinRow = (): Array<unknown> => [
  "2026-08-26T00:00:00.000Z",
  "listing-1",
  "LISTED",
  1,
  3,
  listingSnapshot,
  "2026-08-25T00:00:00.000Z",
  "2026-08-25T00:00:00.000Z",
  null,
];

interface SaveBehavior {
  /** rows for exists/isSaved select on explore_plan_saves */
  readonly saveExistsRows?: Array<Array<unknown>>;
  /** rows for getById on explore_plan_listings */
  readonly listingRows?: Array<Array<unknown>>;
  /** rows for saved-list inner join */
  readonly savedListRows?: Array<Array<unknown>>;
}

const makeApp = (
  behavior: SaveBehavior,
  user: { readonly id: string; readonly name: string } | null = {
    id: saverId,
    name: "저장자",
  },
  participantIds: string[] = [saverId]
) => {
  const calls: Array<{ readonly text: string; readonly params: unknown[] }> = [];
  const client = {
    query: async (
      config: { readonly text: string },
      params: unknown[] = []
    ) => {
      const text = config.text;
      if (text.includes('from "participant_alias"')) return { rows: [] };
      if (/^(begin|commit|rollback)/i.test(text)) return { rows: [] };
      calls.push({ text, params });

      if (text.includes('"explore_plan_saves"')) {
        if (text.startsWith("insert")) return { rows: [] };
        if (text.startsWith("delete")) return { rows: [] };
        // select on saves alone = exists/isSaved.
        if (text.startsWith("select") && !text.includes("inner join")) {
          return { rows: behavior.saveExistsRows ?? [] };
        }
        // saved-list join select starts from saves and joins listings.
        if (text.includes("inner join")) {
          return { rows: behavior.savedListRows ?? [] };
        }
      }
      if (
        text.includes('"explore_plan_listings"') &&
        text.startsWith("select")
      ) {
        return { rows: behavior.listingRows ?? [listingRow()] };
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
      resolveParticipantIdentity: async () => ({
        participantId: (user?.id ?? saverId) as never,
        participantIds: participantIds as never,
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

describe("Explore save API (RAON-254 DISC-6)", () => {
  it("POST save: LISTED listing을 저장하면 200 + { saved: true }", async () => {
    const { app } = makeApp({ saveExistsRows: [], listingRows: [listingRow()] });
    const res = await app.fetch(
      request("/api/explore/listings/listing-1/save", {
        method: "POST",
        body: "{}",
      }),
      env
    );
    expect(res.status).toBe(200);
    expect((await res.json()) as unknown).toEqual({ saved: true });
  });

  it("POST save: body에 spoof 필드가 있으면 400", async () => {
    const { app } = makeApp({});
    const res = await app.fetch(
      request("/api/explore/listings/listing-1/save", {
        method: "POST",
        body: JSON.stringify({ participantId: "evil" }),
      }),
      env
    );
    expect(res.status).toBe(400);
  });

  it("POST save: 이미 저장돼 있어도 200 + { saved: true } (idempotent)", async () => {
    const { app, calls } = makeApp({
      saveExistsRows: [["existing"]],
      listingRows: [listingRow()],
    });
    const res = await app.fetch(
      request("/api/explore/listings/listing-1/save", {
        method: "POST",
        body: "{}",
      }),
      env
    );
    expect(res.status).toBe(200);
    expect((await res.json()) as unknown).toEqual({ saved: true });
    // insert가 발생하지 않았다(이미 저장).
    expect(
      calls.some(
        (c) => c.text.startsWith("insert") && c.text.includes("explore_plan_saves")
      )
    ).toBe(false);
  });

  it("POST save: UNLISTED listing은 410으로 저장 거부", async () => {
    const { app } = makeApp({
      saveExistsRows: [],
      listingRows: [listingRow({ status: "UNLISTED" })],
    });
    const res = await app.fetch(
      request("/api/explore/listings/listing-1/save", {
        method: "POST",
        body: "{}",
      }),
      env
    );
    expect(res.status).toBe(410);
  });

  it("POST save: 없는 listing은 404", async () => {
    const { app } = makeApp({ saveExistsRows: [], listingRows: [] });
    const res = await app.fetch(
      request("/api/explore/listings/listing-1/save", {
        method: "POST",
        body: "{}",
      }),
      env
    );
    expect(res.status).toBe(404);
  });

  it("POST save: 비로그인은 401", async () => {
    const { app } = makeApp({}, null);
    const res = await app.fetch(
      request("/api/explore/listings/listing-1/save", {
        method: "POST",
        body: "{}",
      }),
      env
    );
    expect(res.status).toBe(401);
  });

  it("DELETE save: 저장 해제하면 200 + { saved: false } (반복 안전)", async () => {
    const { app } = makeApp({});
    const res = await app.fetch(
      request("/api/explore/listings/listing-1/save", {
        method: "DELETE",
        body: "{}",
      }),
      env
    );
    expect(res.status).toBe(200);
    expect((await res.json()) as unknown).toEqual({ saved: false });
  });

  it("GET save: 실제 저장 상태를 반환한다", async () => {
    const { app } = makeApp({ saveExistsRows: [["x"]] });
    const res = await app.fetch(
      request("/api/explore/listings/listing-1/save"),
      env
    );
    expect(res.status).toBe(200);
    expect((await res.json()) as unknown).toEqual({ saved: true });
  });

  it("GET /api/me/saved: LISTED read-through 페이지 + savedAt을 반환하고 private ID를 노출하지 않는다", async () => {
    const { app } = makeApp({ savedListRows: [savedJoinRow()] });
    const res = await app.fetch(request("/api/me/saved"), env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, any>;
    expect(body.items).toHaveLength(1);
    expect(body.items[0].savedAt).toBe("2026-08-26T00:00:00.000Z");
    expect(body.items[0].listing.status).toBe("LISTED");
    const raw = JSON.stringify(body);
    expect(raw).not.toContain("trip-1");
    expect(raw).not.toContain("plan-1");
    expect(raw).not.toContain("author-1");
    expect(raw).not.toContain(saverId);
  });

  it("GET /api/me/saved: 잘못된 cursor는 400", async () => {
    const { app } = makeApp({});
    const res = await app.fetch(
      request("/api/me/saved?cursor=not-a-valid-token%21%21"),
      env
    );
    expect(res.status).toBe(400);
  });

  it("GET /api/me/saved: 비로그인은 401", async () => {
    const { app } = makeApp({}, null);
    const res = await app.fetch(request("/api/me/saved"), env);
    expect(res.status).toBe(401);
  });
});
