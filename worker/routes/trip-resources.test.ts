import { drizzle, type NodePgClient } from "drizzle-orm/node-postgres";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ParticipantIdSchema } from "../../src/core/domain/ids.ts";
import * as schema from "../../src/infrastructure/persistence/drizzle/schema/index.ts";
import { createApp, type AppDependencies, type AppEnv } from "../app.ts";

const env = {} as AppEnv["Bindings"];
const providerRun = vi.fn<AiGateway["run"]>();
const configuredEnv = {
  AI: { gateway: () => ({ run: providerRun }) } as unknown as Ai,
  AI_GATEWAY_ID: "test-gateway",
  AI_RESOURCE_MODEL: "test-model",
} as AppEnv["Bindings"];
const collection = "/api/trips/trip-1/resources";
const resourceId = "ed8bab53-ff72-401b-ae38-491be7690547";
const resourcePath = `${collection}/${resourceId}`;
const now = "2026-09-16T00:00:00.000Z";
const memberId = ParticipantIdSchema.make("member-1");
const roomRow = (tripId = "trip-1") => [
  tripId, "서울 여행", "서울", 1,
  [{ id: "host-1", name: "방장", role: "HOST" }, { id: memberId, name: "멤버", role: "MEMBER" }],
  [], null, now, now,
];
const resourceRow = (url = "", note = "경복궁에 가자"): unknown[] => [
  resourceId, "trip-1", memberId, "세션 이름", now, now, 1, url, note, null, null, "NOT_READ",
];

const makeApp = (responses: Array<unknown[][]>, actor: string | null = memberId) => {
  const calls: Array<{ text: string; params: unknown[] }> = [];
  const client = {
    query: async (config: { text: string }, params: unknown[] = []) => {
      if (config.text.includes('from "participant_alias"') || /^(begin|commit|rollback)/i.test(config.text)) {
        return { rows: [] };
      }
      calls.push({ text: config.text, params });
      return { rows: responses.shift() ?? [] };
    },
  };
  const db = drizzle(client as unknown as NodePgClient, { schema });
  const makeAuth = (() => ({
    handler: () => new Response(),
    api: { getSession: async () => actor ? {
      user: { id: "auth-user-1", name: "세션 이름", email: "test@example.invalid" },
    } : null },
  })) as unknown as NonNullable<AppDependencies["makeAuth"]>;
  return {
    calls,
    app: createApp({
      makeAuth,
      withDatabase: async (_env, run) => run(db),
      resolveParticipantIdentity: async () => {
        const participantId = ParticipantIdSchema.make(actor ?? memberId);
        return { participantId, participantIds: [participantId] };
      },
    }),
  };
};

const request = (path: string, method = "GET", body?: unknown) => new Request(`https://galanda.test${path}`, {
  method,
  ...(body === undefined ? {} : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
});

afterEach(() => {
  providerRun.mockReset();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Trip resources HTTP boundary", () => {
  it("멤버 목록에는 원본과 미정리 상태, 관리 권한, AI 가용 상태를 반환한다", async () => {
    const fetcher = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetcher);
    const { app, calls } = makeApp([[roomRow()], [resourceRow()]]);
    const response = await app.fetch(request(collection), env);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      items: [{ id: resourceId, createdBy: memberId, note: "경복궁에 가자", places: null, canManage: true }],
      extractionAvailable: false,
    });
    expect(calls[1].params).toEqual(["trip-1", 200]);
    expect(fetcher).not.toHaveBeenCalled();
    expect(providerRun).not.toHaveBeenCalled();
  });

  it("생성 작성자는 인증 provider ID가 아닌 서버 participant와 세션 이름을 사용한다", async () => {
    const { app, calls } = makeApp([[roomRow()], [["trip-1"]], [[0]], [resourceRow()]]);
    const response = await app.fetch(request(collection, "POST", { url: "", note: "경복궁에 가자" }), env);
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ createdBy: memberId, createdByName: "세션 이름", canManage: true });
    const insert = calls.find((call) => call.text.startsWith("insert"));
    expect(insert?.params).toEqual(["trip-1", memberId, "세션 이름", "", "경복궁에 가자"]);
  });

  it.each(["createdBy", "role"])("생성 DTO의 %s 위조는 DB 접근 전에 거부한다", async (field) => {
    const { app, calls } = makeApp([]);
    const response = await app.fetch(request(collection, "POST", { url: "", note: "경복궁", [field]: "host-1" }), env);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "INVALID_REQUEST" } });
    expect(calls).toEqual([]);
  });

  it("잘못된 resource UUID는 DB 접근 전에 거부한다", async () => {
    const { app, calls } = makeApp([]);
    const response = await app.fetch(request(`${collection}/invalid-id/organize`, "POST", { expectedRevision: 1 }), env);
    expect(response.status).toBe(400);
    expect(calls).toEqual([]);
  });

  it.each([0, -1, 1.5, "1", undefined])("잘못된 expectedRevision %s는 쓰기 없이 거부한다", async (expectedRevision) => {
    const { app, calls } = makeApp([]);
    const response = await app.fetch(request(resourcePath, "DELETE", { expectedRevision }), env);
    expect(response.status).toBe(400);
    expect(calls).toEqual([]);
  });

  it.each(["GET", "POST"])("%s는 비로그인 401, 비멤버 404로 자료 접근을 차단한다", async (method) => {
    for (const actor of [null, "outsider-1"]) {
      const { app, calls } = makeApp([[roomRow()]], actor);
      const response = await app.fetch(request(collection, method, method === "POST" ? { url: "", note: "경복궁" } : undefined), env);
      expect(response.status).toBe(actor === null ? 401 : 404);
      expect(await response.json()).toMatchObject({ error: { code: actor === null ? "UNAUTHORIZED" : "NOT_FOUND" } });
      expect(calls.some((call) => call.text.includes('"trip_resources"'))).toBe(false);
    }
  });

  it("다른 여행 경로에서 기존 resource ID로 정리할 수 없다", async () => {
    const fetcher = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetcher);
    const { app, calls } = makeApp([[roomRow("trip-2")], []]);
    const response = await app.fetch(request(`/api/trips/trip-2/resources/${resourceId}/organize`, "POST", { expectedRevision: 1 }), configuredEnv);
    expect(response.status).toBe(404);
    expect(calls[1].params).toEqual(["trip-2", resourceId, 1]);
    expect(fetcher).not.toHaveBeenCalled();
    expect(calls.some((call) => /^(insert|update|delete)/.test(call.text))).toBe(false);
  });

  it.each([collection, `${resourcePath}/organize`])("%s는 100KB 초과 body를 JSON 검증과 DB 쓰기 전에 차단한다", async (path) => {
    const { app, calls } = makeApp([]);
    const body = JSON.stringify(path === collection ? { url: "", note: "경복궁" } : { expectedRevision: 1 }) + " ".repeat(100_000);
    const response = await app.fetch(new Request(`https://galanda.test${path}`, {
      method: "POST", headers: { "content-type": "application/json" }, body,
    }), env);
    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({ error: { code: "INVALID_REQUEST" } });
    expect(calls).toEqual([]);
  });

  it("정리는 출처가 검증된 장소 카드를 원문 보존과 revision CAS를 거쳐 반환한다", async () => {
    const place = { name: "경복궁", category: "SIGHT", location: "", summary: "멤버가 방문을 제안했어요.", evidence: { source: "NOTE", text: "경복궁에 가자" } };
    providerRun.mockResolvedValue(Response.json({
      choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ linkUsable: false, places: [place] }) } }],
    }));
    const updated = resourceRow();
    updated[6] = 2;
    updated[9] = [{ ...place, edited: false }];
    updated[10] = now;
    const { app, calls } = makeApp([[roomRow()], [resourceRow()], [roomRow()], [updated]]);
    const response = await app.fetch(request(`${resourcePath}/organize`, "POST", { expectedRevision: 1 }), configuredEnv);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      id: resourceId, revision: 2, note: "경복궁에 가자", places: [{ ...place, edited: false }],
    });
    expect(providerRun).toHaveBeenCalledOnce();
    const update = calls.find((call) => call.text.startsWith("update"));
    expect(update?.params.slice(-3)).toEqual(["trip-1", resourceId, 1]);
    expect(update?.text).not.toContain('"note" =');
    expect(update?.text).not.toContain('"url" =');
  });

  it.each([
    { note: "", status: 422, body: { error: { code: "RESOURCE_EXTRACTION_FAILED" } }, writes: [] },
    { note: "경복궁에 가자", status: 200, body: { note: "경복궁에 가자", linkStatus: "UNAVAILABLE", places: [{ evidence: { source: "NOTE" } }] }, writes: ["UNAVAILABLE"] },
  ])("HTTP 200 로그인 페이지는 메모 '$note'에 따라 $status를 반환한다", async ({ note, status, body, writes }) => {
    const url = "https://www.booking.com/hotel";
    const places = note ? [{ name: "경복궁", category: "SIGHT", location: "", summary: "멤버가 방문을 제안했어요.", evidence: { source: "NOTE", text: note } }] : [];
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("로그인이 필요합니다", { headers: { "content-type": "text/plain" } }));
    providerRun.mockResolvedValue(Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ linkUsable: false, places }) } }] }));
    vi.stubGlobal("fetch", fetcher);
    const updated = resourceRow(url, note);
    updated[6] = 2;
    updated[9] = places.map((place) => ({ ...place, edited: false }));
    updated[10] = now;
    updated[11] = "UNAVAILABLE";
    const { app, calls } = makeApp([[roomRow()], [resourceRow(url, note)], [roomRow()], [updated]]);
    const response = await app.fetch(request(`${resourcePath}/organize`, "POST", { expectedRevision: 1 }), configuredEnv);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(providerRun).toHaveBeenCalledOnce();
    expect(response.status).toBe(status);
    expect(await response.json()).toMatchObject(body);
    // Without a note, no write may turn places:null into a completed empty result.
    const mutations = calls.filter((call) => /^(insert|update|delete)/.test(call.text));
    expect(mutations.map((call) => call.params.find((param) => param === "UNAVAILABLE"))).toEqual(writes);
    expect(mutations.some((call) => /"(note|url)" =/.test(call.text))).toBe(false);
  });

  it.each([
    { reason: "UNAVAILABLE", status: 503, bindings: env, url: "", note: "경복궁에 가자", fetchCalls: 0 },
    { reason: "SOURCE_UNREADABLE", status: 422, bindings: configuredEnv, url: "https://example.invalid/article", note: "", fetchCalls: 0 },
    { reason: "INVALID_OUTPUT", status: 502, bindings: configuredEnv, url: "", note: "경복궁에 가자", fetchCalls: 1 },
  ])("정리 $reason 오류는 $status이고 원본을 변경하지 않는다", async ({ status, bindings, url, note, fetchCalls }) => {
    providerRun.mockResolvedValue(Response.json({ choices: [{ finish_reason: "stop", message: { content: "invalid JSON" } }] }));
    const { app, calls } = makeApp([[roomRow()], [resourceRow(url, note)]]);
    const response = await app.fetch(request(`${resourcePath}/organize`, "POST", { expectedRevision: 1 }), bindings);
    expect(response.status).toBe(status);
    expect(await response.json()).toMatchObject({ error: { code: "RESOURCE_EXTRACTION_FAILED" } });
    expect(providerRun).toHaveBeenCalledTimes(fetchCalls);
    expect(calls.some((call) => /^(insert|update|delete)/.test(call.text))).toBe(false);
  });
});
