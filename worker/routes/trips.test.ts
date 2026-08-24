import { drizzle, type NodePgClient } from "drizzle-orm/node-postgres";
import { describe, expect, it } from "vitest";
import {
  ParticipantIdSchema,
  PlanIdSchema,
  RevisionSchema,
  TripIdSchema,
  UserIdSchema,
} from "../../src/core/domain/ids.ts";
import type { TripPlan, TripRoom } from "../../src/core/domain/room.ts";
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
const plan: TripPlan = {
  id: PlanIdSchema.make("plan-1"),
  title: "첫 여행안",
  status: "DRAFT",
  authorId: hostId,
  authorName: "Host",
  baseHeadcount: 2,
  routes: [
    {
      city: "오사카",
      arrivalDate: "2026-09-01",
      departureDate: "2026-09-04",
    },
  ],
  accommodations: [{
    id: "stay-osaka",
    city: "오사카",
    period: "2026-09-01 ~ 2026-09-04",
    nights: 3,
    hotelName: "",
    isSearching: true,
    bookingStatus: "NOT_CHECKED",
  }],
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
  members: [{ id: hostId, name: "Host", role: "HOST" }],
  plans: [],
  confirmedPlanId: undefined,
};
const roomWithPlan: TripRoom = { ...room, plans: [plan] };

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

const makeApp = (
  responses: Array<Array<Array<unknown>>>,
  user: { readonly id: string; readonly name: string } | null | Error = {
    id: hostId,
    name: "Host",
  }
) => {
  const calls: Array<{ readonly text: string; readonly params: unknown[] }> = [];
  const client = {
    query: async (
      config: { readonly text: string },
      params: unknown[] = []
    ) => {
      if (config.text.includes('from "participant_alias"')) return { rows: [] };
      calls.push({ text: config.text, params });
      return { rows: responses.shift() ?? [] };
    },
  };
  const db = drizzle(client as unknown as NodePgClient, { schema });
  const makeAuth = (() => ({
    handler: () => new Response(),
    api: {
      getSession: async () => {
        if (user instanceof Error) throw user;
        return user
          ? { user: { ...user, email: `${user.id}@example.com` } }
          : null;
      },
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
      resolveParticipantIdentity: async (_db, authUserId) => {
        const participantId = ParticipantIdSchema.make(authUserId);
        return { participantId, participantIds: [participantId] };
      },
    }),
    calls,
  };
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
    expect(calls[0].text).toContain('"trip_rooms"."members" @>');
    expect(calls[0].params).toEqual([JSON.stringify([{ id: hostId }])]);
    expect(calls[4].params.slice(-2)).toEqual([room.id, room.revision]);
  });

  it("목록은 인증을 요구하고 세션 장애를 구분하며 비멤버 상세를 숨긴다", async () => {
    const unauthenticated = makeApp([], null);
    const unauthenticatedResponse = await unauthenticated.app.fetch(
      request("/api/trips"),
      env
    );
    expect(unauthenticatedResponse.status).toBe(401);
    expect(unauthenticated.calls).toEqual([]);

    const unavailable = makeApp([], new Error("auth unavailable"));
    const unavailableResponse = await unavailable.app.fetch(
      request("/api/trips"),
      env
    );
    expect(unavailableResponse.status).toBe(503);
    await expect(unavailableResponse.json()).resolves.toMatchObject({
      error: { code: "AUTH_SERVICE_UNAVAILABLE" },
    });
    expect(unavailable.calls).toEqual([]);

    const outsider = makeApp([[rowValues(room)]], {
      id: "outsider",
      name: "Outsider",
    });
    const outsiderResponse = await outsider.app.fetch(
      request("/api/trips/trip-1"),
      env
    );
    expect(outsiderResponse.status).toBe(404);
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

  it("확정 권한 실패와 이미 확정된 상태를 서로 다른 contract로 반환한다", async () => {
    const memberId = UserIdSchema.make("member-1");
    const memberRoom = {
      ...roomWithPlan,
      members: [
        ...roomWithPlan.members,
        { id: memberId, name: "Member", role: "MEMBER" as const },
      ],
    };
    const member = makeApp([[rowValues(memberRoom)]], {
      id: memberId,
      name: "Member",
    });
    const forbidden = await member.app.fetch(
      request("/api/trips/trip-1/plans/plan-1/confirm", {
        method: "POST",
        body: JSON.stringify({ expectedRevision: 3 }),
      }),
      env
    );

    const confirmedRoom = {
      ...roomWithPlan,
      plans: [{ ...plan, status: "CONFIRMED" as const }],
      confirmedPlanId: plan.id,
    };
    const confirmed = makeApp([[rowValues(confirmedRoom)]]);
    const stateConflict = await confirmed.app.fetch(
      request("/api/trips/trip-1/plans/plan-1/confirm", {
        method: "POST",
        body: JSON.stringify({ expectedRevision: 3 }),
      }),
      env
    );

    expect(forbidden.status).toBe(403);
    await expect(forbidden.json()).resolves.toMatchObject({
      error: { code: "FORBIDDEN" },
    });
    expect(stateConflict.status).toBe(409);
    const stateConflictBody = (await stateConflict.json()) as {
      error: { code: string; details?: unknown };
    };
    expect(stateConflictBody).toMatchObject({
      error: { code: "STATE_CONFLICT" },
    });
    expect(stateConflictBody.error.details).toBeUndefined();
  });

  it("plan create가 작성자와 서버 소유 필드를 세션에서 결정한다", async () => {
    const created = {
      ...roomWithPlan,
      revision: RevisionSchema.make(4),
    };
    const { app, calls } = makeApp([
      [rowValues(room)],
      [rowValues(created)],
    ]);

    const response = await app.fetch(
      request("/api/trips/trip-1/plans", {
        method: "POST",
        body: JSON.stringify({
          title: "첫 여행안",
          baseHeadcount: plan.baseHeadcount,
          routes: plan.routes,
          accommodations: plan.accommodations,
          transports: plan.transports,
          places: [],
          expectedRevision: 3,
        }),
      }),
      env
    );

    expect(response.status).toBe(201);
    const persistedPlans = JSON.parse(calls[1].params[3] as string) as TripPlan[];
    expect(persistedPlans[0]).toMatchObject({
      title: "첫 여행안",
      authorId: hostId,
      authorName: "Host",
      status: "VOTING",
      revision: 1,
      voteCount: 0,
    });
    expect(Date.parse(persistedPlans[0].publishedAt ?? "")).not.toBeNaN();
  });

  it("plan update DTO의 서버 소유 필드를 거부한다", async () => {
    const { app, calls } = makeApp([]);

    const response = await app.fetch(
      request("/api/trips/trip-1/plans/plan-1", {
        method: "PATCH",
        body: JSON.stringify({
          title: "위조 수정",
          places: [],
          expectedRevision: 3,
          status: "CONFIRMED",
          authorId: "attacker",
          voteCount: 999,
          revision: 999,
          publishedAt: "2026-08-24T00:00:00.000Z",
        }),
      }),
      env
    );

    expect(response.status).toBe(400);
    expect(calls).toEqual([]);
  });

  it("opinion/confirm/delete를 domain transition과 CAS 저장으로 연결한다", async () => {
    const cases = [
      {
        method: "PUT",
        path: "/api/trips/trip-1/plans/plan-1/opinion",
        body: { reaction: "LIKE", expectedRevision: 3 },
        initial: roomWithPlan,
        updated: {
          ...roomWithPlan,
          revision: RevisionSchema.make(4),
          plans: [
            {
              ...plan,
              memberOpinions: [
                { userId: hostId, userName: "Host", reaction: "LIKE" as const },
              ],
              voteCount: 1,
            },
          ],
        },
      },
      {
        method: "POST",
        path: "/api/trips/trip-1/plans/plan-1/confirm",
        body: { expectedRevision: 3 },
        initial: roomWithPlan,
        updated: {
          ...roomWithPlan,
          revision: RevisionSchema.make(4),
          plans: [{ ...plan, status: "CONFIRMED" as const }],
          confirmedPlanId: plan.id,
        },
      },
      {
        method: "DELETE",
        path: "/api/trips/trip-1/plans/plan-1",
        body: { expectedRevision: 3 },
        initial: roomWithPlan,
        updated: {
          ...roomWithPlan,
          revision: RevisionSchema.make(4),
          plans: [],
        },
      },
    ] satisfies ReadonlyArray<{
      readonly method: string;
      readonly path: string;
      readonly body?: unknown;
      readonly initial: TripRoom;
      readonly updated: TripRoom;
    }>;

    for (const testCase of cases) {
      const { app, calls } = makeApp([
        [rowValues(testCase.initial)],
        [rowValues(testCase.updated)],
      ]);
      const response = await app.fetch(
        request(testCase.path, {
          method: testCase.method,
          body:
            testCase.body === undefined
              ? undefined
              : JSON.stringify(testCase.body),
        }),
        env
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual(testCase.updated);
      expect(calls.map(({ text }) => text.split(" ", 1)[0])).toEqual([
        "select",
        "update",
      ]);
    }
  });
});
