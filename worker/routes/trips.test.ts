import { drizzle, type NodePgClient } from "drizzle-orm/node-postgres";
import { describe, expect, it } from "vitest";
import {
  RevisionSchema,
  TripIdSchema,
  UserIdSchema,
} from "../../src/core/domain/ids.ts";
import type { TripRoom } from "../../src/core/domain/room.ts";
import type { DatabaseHandle } from "../../src/infrastructure/persistence/drizzle/database.ts";
import * as schema from "../../src/infrastructure/persistence/drizzle/schema/index.ts";
import {
  createApp,
  type AppDependencies,
  type AppEnv,
} from "../app.ts";

const baseUrl = "https://galanda.test";
const env = {} as AppEnv["Bindings"];
const hostId = UserIdSchema.make("host-1");
const room: TripRoom = {
  id: TripIdSchema.make("trip-1"),
  title: "오사카 여행",
  destination: "오사카",
  revision: RevisionSchema.make(3),
  members: [{ id: hostId, name: "Host", role: "HOST" }],
  plans: [],
  confirmedPlanId: undefined,
};

const rowValues = (value: TripRoom): Array<unknown> => [
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

const makeApp = (responses: Array<Array<Array<unknown>>>) => {
  const calls: Array<{ readonly text: string; readonly params: unknown[] }> = [];
  const client = {
    query: async (
      config: { readonly text: string },
      params: unknown[] = []
    ) => {
      calls.push({ text: config.text, params });
      return { rows: responses.shift() ?? [] };
    },
  };
  const db = drizzle(client as unknown as NodePgClient, { schema });
  const makeAuth = (() => ({
    handler: () => new Response(),
    api: {
      getSession: async () => ({
        user: { id: hostId, name: "Host", email: "host@example.com" },
      }),
    },
  })) as unknown as NonNullable<AppDependencies["makeAuth"]>;
  const withDatabase: NonNullable<AppDependencies["withDatabase"]> = async (
    _requestEnv,
    run
  ) => run(db as DatabaseHandle);

  return { app: createApp({ makeAuth, withDatabase }), calls };
};

const request = (path: string, init?: RequestInit) =>
  new Request(`${baseUrl}${path}`, {
    ...init,
    headers: init?.body ? { "content-type": "application/json" } : undefined,
  });

describe("Trip API vertical slice", () => {
  it("list/detail/create/update를 Hono → Effect → Drizzle 경계로 실행한다", async () => {
    const created = { ...room, id: TripIdSchema.make("trip-created"), revision: RevisionSchema.make(1) };
    const updated = { ...room, title: "교토와 오사카", revision: RevisionSchema.make(4) };
    const { app, calls } = makeApp([
      [rowValues(room)],
      [rowValues(room)],
      [rowValues(created)],
      [rowValues(room)],
      [rowValues(updated)],
    ]);

    const listResponse = await app.fetch(request("/api/trips"), env);
    const detailResponse = await app.fetch(request("/api/trips/trip-1"), env);
    const createResponse = await app.fetch(
      request("/api/trips", {
        method: "POST",
        body: JSON.stringify({ title: "새 여행" }),
      }),
      env
    );
    const updateResponse = await app.fetch(
      request("/api/trips/trip-1", {
        method: "PATCH",
        body: JSON.stringify({
          title: "교토와 오사카",
          expectedRevision: 3,
        }),
      }),
      env
    );

    expect(listResponse.status).toBe(200);
    await expect(listResponse.json()).resolves.toEqual([room]);
    expect(detailResponse.status).toBe(200);
    await expect(detailResponse.json()).resolves.toEqual(room);
    expect(createResponse.status).toBe(201);
    await expect(createResponse.json()).resolves.toEqual(created);
    expect(updateResponse.status).toBe(200);
    await expect(updateResponse.json()).resolves.toEqual(updated);
    expect(calls.map(({ text }) => text.split(" ", 1)[0])).toEqual([
      "select",
      "select",
      "insert",
      "select",
      "update",
    ]);
    expect(calls[2].params).toContain(
      JSON.stringify([{ id: hostId, name: "Host", role: "HOST" }])
    );
    expect(calls[4].text).toContain(
      'where ("trip_rooms"."id" = $2 and "trip_rooms"."revision" = $3)'
    );
  });

  it("create DTO의 서버 소유 필드를 거부한다", async () => {
    const { app, calls } = makeApp([]);

    const response = await app.fetch(
      request("/api/trips", {
        method: "POST",
        body: JSON.stringify({
          title: "위조 여행",
          id: "client-owned-id",
          hostUser: { id: "attacker", name: "Attacker", role: "HOST" },
        }),
      }),
      env
    );

    expect(response.status).toBe(400);
    expect(calls).toEqual([]);
  });

  it("stale PATCH를 현재 revision이 포함된 409로 변환한다", async () => {
    const current = { ...room, revision: RevisionSchema.make(4) };
    const { app, calls } = makeApp([[rowValues(current)], [], [[4]]]);

    const response = await app.fetch(
      request("/api/trips/trip-1", {
        method: "PATCH",
        body: JSON.stringify({ title: "늦은 수정", expectedRevision: 3 }),
      }),
      env
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "REVISION_CONFLICT",
        details: { expectedRevision: 3, actualRevision: 4 },
      },
    });
    expect(calls[1].text).toContain('"revision" = "trip_rooms"."revision" + 1');
  });
});
