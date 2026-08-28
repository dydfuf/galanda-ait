import { drizzle, type NodePgClient } from "drizzle-orm/node-postgres";
import { afterEach, describe, expect, it, vi } from "vitest";
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
const shadowEnv = {
  AI_RECOMMENDATION_MODE: "shadow",
  AI_RECOMMENDATION_MODEL: "test-model",
  AI_RECOMMENDATION_POLICY_VERSION: "nba-ai-test-v1",
  AI_RECOMMENDATION_TIMEOUT_MS: "100",
  AI_GATEWAY_ACCOUNT_ID: "account-id",
  AI_GATEWAY_ID: "gateway-id",
  AI_GATEWAY_TOKEN: "gateway-token",
} as AppEnv["Bindings"];
const activeEnv = {
  ...shadowEnv,
  AI_RECOMMENDATION_MODE: "active",
  AI_RECOMMENDATION_ACTIVE_APPROVED_POLICY_VERSION: "nba-ai-test-v1",
} as AppEnv["Bindings"];
const hostId = UserIdSchema.make("host-1");
const plan: TripPlan = {
  id: PlanIdSchema.make("plan-1"),
  title: "첫 여행안",
  status: "VOTING",
  revision: RevisionSchema.make(1),
  publishedAt: "2026-08-24T00:00:00.000Z",
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
const confirmedRoom: TripRoom = {
  ...roomWithPlan,
  plans: [{ ...plan, status: "CONFIRMED" }],
  confirmedPlanId: plan.id,
};
const itinerarySnapshot = {
  planTitle: plan.title,
  destination: room.destination,
  routes: plan.routes!,
  items: [
    { type: "TRANSPORT" as const, date: "2026-09-01", transport: plan.transports![0]! },
    { type: "STAY" as const, date: "2026-09-01", endDate: "2026-09-04", accommodation: plan.accommodations![0]! },
    { type: "TRANSPORT" as const, date: "2026-09-04", transport: plan.transports![1]! },
  ],
};
const itineraryRowValues = (revision = 1, changes: unknown[] = []): Array<unknown> => [
  "itinerary-1",
  room.id,
  plan.id,
  1,
  revision,
  hostId,
  "2026-08-24T00:00:00.000Z",
  itinerarySnapshot,
  changes,
  hostId,
  "2026-08-24T00:00:00.000Z",
];

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
  responses: Array<Array<Array<unknown>> | Error>,
  user: { readonly id: string; readonly name: string } | null | Error = {
    id: hostId,
    name: "Host",
  }
) => {
  const calls: Array<{ readonly text: string; readonly params: unknown[] }> = [];
  const transactionCommands: string[] = [];
  const client = {
    query: async (
      config: { readonly text: string },
      params: unknown[] = []
    ) => {
      if (config.text.includes('from "participant_alias"')) return { rows: [] };
      if (/^(begin|commit|rollback)/i.test(config.text)) {
        transactionCommands.push(config.text.toLowerCase());
        return { rows: [] };
      }
      calls.push({ text: config.text, params });
      const response = responses.shift() ?? [];
      if (response instanceof Error) throw response;
      return { rows: response };
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
    transactionCommands,
  };
};

const request = (path: string, init?: RequestInit) =>
  new Request(`${baseUrl}${path}`, {
    ...init,
    headers: init?.body ? { "content-type": "application/json" } : undefined,
  });

const makeExecutionContext = () => {
  const promises: Promise<unknown>[] = [];
  const executionCtx = {
    waitUntil: (promise: Promise<unknown>) => promises.push(promise),
    passThroughOnException: () => undefined,
  } as unknown as ExecutionContext;
  return { executionCtx, promises };
};

afterEach(() => vi.restoreAllMocks());

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

  it("opinion/delete를 domain transition과 CAS 저장으로 연결한다", async () => {
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

  it("confirm을 TripRoom CAS와 itinerary revision 1의 단일 transaction으로 저장한다", async () => {
    const { app, calls } = makeApp([
      [rowValues(roomWithPlan)],
      [[4]],
      [],
      [],
    ]);

    const response = await app.fetch(
      request("/api/trips/trip-1/plans/plan-1/confirm", {
        method: "POST",
        body: JSON.stringify({ expectedRevision: 3 }),
      }),
      env
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: "CONFIRMED",
      itinerary: {
        tripId: "trip-1",
        sourcePlanId: "plan-1",
        sourcePlanRevision: 1,
        currentRevision: 1,
      },
    });
    expect(calls.map(({ text }) => text.split(" ", 1)[0])).toEqual([
      "select",
      "update",
      "insert",
      "insert",
    ]);
  });

  it("itinerary 조회가 미확정과 legacy snapshot 누락을 구분한다", async () => {
    for (const [initial, status] of [
      [room, "UNCONFIRMED"],
      [{ ...roomWithPlan, confirmedPlanId: plan.id }, "MISSING"],
    ] as const) {
      const { app } = makeApp([[rowValues(initial)], []]);
      const response = await app.fetch(
        request("/api/trips/trip-1/itinerary"),
        env
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ status });
    }
  });

  it("일정 수정과 참여자 확인을 독립 revision transaction으로 저장한다", async () => {
    const revised = makeApp([
      [rowValues(confirmedRoom)],
      [itineraryRowValues()],
      [[2]],
      [],
    ]);
    const reviseResponse = await revised.app.fetch(
      request("/api/trips/trip-1/itinerary", {
        method: "PATCH",
        body: JSON.stringify({
          expectedRevision: 1,
          patches: [
            {
              type: "STAY",
              itemId: "stay-osaka",
              date: "2026-09-01",
              endDate: "2026-09-05",
              hotelName: "새 오사카 호텔",
              memo: "체크인 15시",
            },
            {
              type: "TRANSPORT",
              itemId: "return-osaka",
              date: "2026-09-05",
              fromCity: "오사카",
              toCity: "인천",
              mode: "항공",
            },
          ],
        }),
      }),
      env
    );

    expect(reviseResponse.status).toBe(200);
    await expect(reviseResponse.json()).resolves.toMatchObject({
      currentRevision: 2,
      changes: [
        { itemId: "stay-osaka" },
        { itemId: "return-osaka" },
      ],
    });
    expect(revised.calls.map(({ text }) => text.split(" ", 1)[0])).toEqual([
      "select",
      "select",
      "update",
      "insert",
    ]);
    expect(revised.transactionCommands).toEqual(["begin", "commit"]);

    const memberId = UserIdSchema.make("member-1");
    const memberRoom = {
      ...confirmedRoom,
      members: [...confirmedRoom.members, { id: memberId, name: "Member", role: "MEMBER" as const }],
    };
    const acknowledged = makeApp([
      [rowValues(memberRoom)],
      [itineraryRowValues(2)],
      [[2]],
      [["itinerary-1", memberId, 2, "2026-08-25T00:00:00.000Z"]],
    ], { id: memberId, name: "Member" });
    const ackResponse = await acknowledged.app.fetch(
      request("/api/trips/trip-1/itinerary/acknowledgements", {
        method: "POST",
        body: JSON.stringify({ expectedRevision: 2 }),
      }),
      env
    );
    expect(ackResponse.status).toBe(200);
    await expect(ackResponse.json()).resolves.toMatchObject({
      participantId: memberId,
      acknowledgedRevision: 2,
    });
  });

  it("일정 수정 DTO의 서버 소유 revision과 변경자를 거부한다", async () => {
    const { app, calls } = makeApp([]);
    const response = await app.fetch(
      request("/api/trips/trip-1/itinerary", {
        method: "PATCH",
        body: JSON.stringify({
          expectedRevision: 1,
          changedBy: "attacker",
          currentRevision: 99,
          patches: [{
            type: "TRANSPORT",
            itemId: "outbound-osaka",
            date: "2026-09-01",
            fromCity: "인천",
            toCity: "오사카",
            mode: "항공",
          }],
        }),
      }),
      env
    );

    expect(response.status).toBe(400);
    expect(calls).toEqual([]);
  });

  it("NBA next-action API가 rule recommendation만 반환하고 draft 원문을 거부한다", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const valid = makeApp([[rowValues(room)]]);
    const response = await valid.app.fetch(
      request("/api/trips/trip-1/recommendations/next", {
        method: "POST",
        body: JSON.stringify({
          surface: "FIRST_PLAN",
          draft: {
            basic: true,
            route: false,
            accommodation: false,
            transport: false,
          },
        }),
      }),
      env
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      primary: {
        actionId: "DEFINE_ROUTE",
        reasonCode: "DEFINE_TRAVEL_ROUTE",
      },
      source: "RULE",
      policyVersion: "nba-rule-v1",
      tripRevision: 3,
    });
    expect(valid.calls.map(({ text }) => text.split(" ", 1)[0])).toEqual([
      "select",
    ]);
    expect(log).toHaveBeenCalledWith(expect.objectContaining({
      message: "nba_recommendation_generated",
      annotations: expect.objectContaining({
        eventName: "nba_recommendation_generated",
        source: "RULE",
        actionId: "DEFINE_ROUTE",
        reasonCode: "DEFINE_TRAVEL_ROUTE",
        surface: "FIRST_PLAN",
        policyVersion: "nba-rule-v1",
        requestId: expect.any(String),
      }),
    }));

    log.mockRestore();

    const conflicting = makeApp([[rowValues(room)]]);
    const conflictResponse = await conflicting.app.fetch(
      request("/api/trips/trip-1/recommendations/next", {
        method: "POST",
        body: JSON.stringify({
          surface: "FIRST_PLAN",
          draft: {
            basic: true,
            route: true,
            accommodation: true,
            transport: true,
            conflict: "DRAFT",
          },
        }),
      }),
      env
    );

    expect(conflictResponse.status).toBe(409);
    await expect(conflictResponse.json()).resolves.toMatchObject({
      error: { code: "STATE_CONFLICT" },
    });

    const invalid = makeApp([]);
    const invalidResponse = await invalid.app.fetch(
      request("/api/trips/trip-1/recommendations/next", {
        method: "POST",
        body: JSON.stringify({
          surface: "FIRST_PLAN",
          draft: {
            basic: true,
            route: false,
            accommodation: false,
            transport: false,
            title: "서버로 전송하면 안 되는 원문",
          },
        }),
      }),
      env
    );

    expect(invalidResponse.status).toBe(400);
    expect(invalid.calls).toEqual([]);
  });

  it("NBA lifecycle 이벤트는 여행 참여자만 기록하고 입력을 strict validation한다", async () => {
    const event = {
      eventName: "nba_accept",
      recommendationId: "recommendation-1",
      source: "RULE",
      actionId: "DEFINE_ROUTE",
      reasonCode: "DEFINE_TRAVEL_ROUTE",
      surface: "FIRST_PLAN",
      policyVersion: "nba-rule-v1",
      contextFingerprint: "fingerprint",
    };
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const member = makeApp([[rowValues(room)]]);

    const response = await member.app.fetch(
      request("/api/trips/trip-1/recommendations/events", {
        method: "POST",
        body: JSON.stringify(event),
      }),
      env,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ accepted: true });
    expect(member.calls).toHaveLength(1);
    expect(log).toHaveBeenCalledWith(expect.objectContaining({
      message: "nba_accept",
      annotations: expect.objectContaining({
        recommendationId: "recommendation-1",
        actionId: "DEFINE_ROUTE",
        requestId: expect.any(String),
      }),
    }));

    const logCount = log.mock.calls.length;
    const mismatched = makeApp([[rowValues(room)]]);
    const mismatchedResponse = await mismatched.app.fetch(
      request("/api/trips/trip-1/recommendations/events", {
        method: "POST",
        body: JSON.stringify({
          ...event,
          eventName: "nba_alternative_selected",
          actionId: "COMPARE_PLANS",
        }),
      }),
      env,
    );
    expect(mismatchedResponse.status).toBe(422);
    expect(log.mock.calls).toHaveLength(logCount);
    log.mockRestore();

    const invalid = makeApp([]);
    const invalidResponse = await invalid.app.fetch(
      request("/api/trips/trip-1/recommendations/events", {
        method: "POST",
        body: JSON.stringify({ ...event, model: "must-not-be-recorded" }),
      }),
      env,
    );
    expect(invalidResponse.status).toBe(400);
    expect(invalid.calls).toEqual([]);

    const stranger = makeApp(
      [[rowValues(room)]],
      { id: "stranger-1", name: "Stranger" },
    );
    const strangerResponse = await stranger.app.fetch(
      request("/api/trips/trip-1/recommendations/events", {
        method: "POST",
        body: JSON.stringify(event),
      }),
      env,
    );
    expect(strangerResponse.status).toBe(404);
  });

  it("active mode는 ambiguous Trip Room action에만 AI ranking을 적용한다", async () => {
    const providerFetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({
        output: [{
          content: [{
            type: "output_text",
            text: JSON.stringify({
              primaryActionId: "INVITE_MEMBER",
              alternativeActionIds: [
                "PROPOSE_ALTERNATIVE",
                "GIVE_OPINION",
              ],
              reasonCode: "INVITE_TRAVEL_COMPANION",
            }),
          }],
        }],
        usage: { input_tokens: 12, output_tokens: 8, total_tokens: 20 },
      })
    );
    const { app } = makeApp([[rowValues(roomWithPlan)]]);

    const response = await app.fetch(
      request("/api/trips/trip-1/recommendations/next", {
        method: "POST",
        body: JSON.stringify({ surface: "PLAN_HOME" }),
      }),
      activeEnv
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      primary: { actionId: "INVITE_MEMBER" },
      alternatives: [
        { actionId: "PROPOSE_ALTERNATIVE" },
        { actionId: "GIVE_OPINION" },
      ],
      source: "AI",
      policyVersion: "nba-ai-test-v1",
      tripRevision: 3,
    });
    expect(providerFetch).toHaveBeenCalledOnce();
  });

  it("active rollout 승인 없이는 AI를 호출하지 않고 RULE을 반환한다", async () => {
    const providerFetch = vi.spyOn(globalThis, "fetch");
    const { app } = makeApp([[rowValues(roomWithPlan)]]);

    const response = await app.fetch(
      request("/api/trips/trip-1/recommendations/next", {
        method: "POST",
        body: JSON.stringify({ surface: "PLAN_HOME" }),
      }),
      { ...activeEnv, AI_RECOMMENDATION_ACTIVE_APPROVED_POLICY_VERSION: undefined }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      primary: { actionId: "PROPOSE_ALTERNATIVE" },
      source: "RULE",
    });
    expect(providerFetch).not.toHaveBeenCalled();
  });

  it("active mode에서도 deterministic first-plan은 provider 없이 RULE을 반환한다", async () => {
    const providerFetch = vi.spyOn(globalThis, "fetch");
    const { app } = makeApp([[rowValues(room)]]);

    const response = await app.fetch(
      request("/api/trips/trip-1/recommendations/next", {
        method: "POST",
        body: JSON.stringify({
          surface: "FIRST_PLAN",
          draft: {
            basic: true,
            route: false,
            accommodation: false,
            transport: false,
          },
        }),
      }),
      activeEnv
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      primary: { actionId: "DEFINE_ROUTE" },
      source: "RULE",
    });
    expect(providerFetch).not.toHaveBeenCalled();
  });

  it("shadow ranking은 RULE 응답 뒤 waitUntil에서만 실행한다", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    let resolveProvider: ((response: Response) => void) | undefined;
    const providerFetch = vi.spyOn(globalThis, "fetch").mockImplementation(
      () => new Promise<Response>((resolve) => {
        resolveProvider = resolve;
      })
    );
    const { app } = makeApp([[rowValues(room)]]);
    const { executionCtx, promises } = makeExecutionContext();

    const response = await app.fetch(
      request("/api/trips/trip-1/recommendations/next", {
        method: "POST",
        body: JSON.stringify({
          surface: "FIRST_PLAN",
          draft: {
            basic: true,
            route: false,
            accommodation: false,
            transport: false,
          },
        }),
      }),
      shadowEnv,
      executionCtx
    );

    expect(response.status).toBe(200);
    const responseBody = await response.json();
    expect(responseBody).toMatchObject({
      primary: { actionId: "DEFINE_ROUTE" },
      source: "RULE",
    });
    expect(responseBody).not.toHaveProperty("rankingInput");
    expect(promises).toHaveLength(1);
    await vi.waitFor(() => expect(providerFetch).toHaveBeenCalledOnce());
    resolveProvider?.(Response.json({
      output: [{
        content: [{
          type: "output_text",
          text: JSON.stringify({
            primaryActionId: "INVITE_MEMBER",
            alternativeActionIds: ["DEFINE_ROUTE"],
            reasonCode: "INVITE_TRAVEL_COMPANION",
          }),
        }],
      }],
      usage: { input_tokens: 12, output_tokens: 8, total_tokens: 20 },
    }));
    await Promise.all(promises);

    expect(log).toHaveBeenCalledWith(expect.objectContaining({
      message: "nba_shadow_completed",
      annotations: expect.objectContaining({
        ruleActionId: "DEFINE_ROUTE",
        shadowActionId: "INVITE_MEMBER",
        disagreed: true,
      }),
    }));
    providerFetch.mockRestore();
    log.mockRestore();
  });

  it("shadow provider 실패가 recommendation 성공을 바꾸지 않는다", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const providerFetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 503 })
    );
    const { app } = makeApp([[rowValues(room)]]);
    const { executionCtx, promises } = makeExecutionContext();

    const response = await app.fetch(
      request("/api/trips/trip-1/recommendations/next", {
        method: "POST",
        body: JSON.stringify({
          surface: "FIRST_PLAN",
          draft: {
            basic: true,
            route: false,
            accommodation: false,
            transport: false,
          },
        }),
      }),
      shadowEnv,
      executionCtx
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      primary: { actionId: "DEFINE_ROUTE" },
      source: "RULE",
    });
    await Promise.all(promises);
    expect(log).toHaveBeenCalledWith(expect.objectContaining({
      message: "nba_shadow_failed",
      annotations: expect.objectContaining({ failure: "PROVIDER_ERROR" }),
    }));
    providerFetch.mockRestore();
    log.mockRestore();
  });

  it("revision insert 실패 시 itinerary CAS를 rollback한다", async () => {
    const failed = makeApp([
      [rowValues(confirmedRoom)],
      [itineraryRowValues()],
      [[2]],
      new Error("revision insert failed"),
    ]);
    const response = await failed.app.fetch(
      request("/api/trips/trip-1/itinerary", {
        method: "PATCH",
        body: JSON.stringify({
          expectedRevision: 1,
          patches: [{
            type: "TRANSPORT",
            itemId: "outbound-osaka",
            date: "2026-09-01",
            fromCity: "인천",
            toCity: "오사카",
            mode: "항공",
          }],
        }),
      }),
      env
    );

    expect(response.status).toBe(503);
    expect(failed.transactionCommands).toEqual(["begin", "rollback"]);
  });
});
