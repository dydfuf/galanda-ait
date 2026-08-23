import { drizzle, type NodePgClient } from "drizzle-orm/node-postgres";
import { describe, expect, it } from "vitest";
import {
  ParticipantIdSchema,
  PlanIdSchema,
  RevisionSchema,
  TripIdSchema,
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
const hostId = ParticipantIdSchema.make("host-1");
const room: TripRoom = {
  id: TripIdSchema.make("trip-1"),
  title: "오사카 여행",
  destination: "오사카",
  revision: RevisionSchema.make(2),
  members: [{ id: hostId, name: "Host", role: "HOST" }],
  plans: [
    {
      id: PlanIdSchema.make("plan-1"),
      title: "확정안",
      status: "CONFIRMED",
      authorId: hostId,
      routes: [
        {
          city: "오사카",
          arrivalDate: "2026-09-01",
          departureDate: "2026-09-04",
        },
      ],
      places: [{ id: "secret", name: "비공개", category: "숙소", address: "비공개" }],
      voteCount: 0,
    },
  ],
  confirmedPlanId: PlanIdSchema.make("plan-1"),
};

const rowValues = (value: TripRoom): Array<unknown> => [
  value.id,
  value.title,
  value.destination,
  value.revision,
  value.members,
  value.plans,
  value.confirmedPlanId ?? null,
  "2026-08-24T00:00:00.000Z",
  "2026-08-24T00:00:00.000Z",
];

const request = (path: string, init?: RequestInit) =>
  new Request(`${baseUrl}${path}`, {
    ...init,
    headers: init?.body ? { "content-type": "application/json" } : undefined,
  });

const makeApp = (options?: {
  readonly inviteExists?: boolean;
  readonly failInviteLookup?: boolean;
  readonly user?: { readonly id: string; readonly name: string } | null;
}) => {
  const calls: Array<{ readonly text: string; readonly params: unknown[] }> = [];
  const client = {
    query: async (
      config: { readonly text: string },
      params: unknown[] = []
    ) => {
      calls.push({ text: config.text, params });
      if (config.text.includes('from "participant_alias"')) return { rows: [] };
      if (config.text.startsWith("insert") && config.text.includes('"trip_invite"')) {
        return { rows: [] };
      }
      if (config.text.includes('from "trip_invite"')) {
        if (options?.failInviteLookup) throw new Error("database unavailable");
        return {
          rows: options?.inviteExists
            ? [[room.id, "Host"]]
            : [],
        };
      }
      if (config.text.includes('from "trip_rooms"')) {
        return { rows: [rowValues(room)] };
      }
      return { rows: [] };
    },
  };
  const db = drizzle(client as unknown as NodePgClient, { schema });
  const user = options && "user" in options
    ? options.user
    : null;
  const makeAuth = (() => ({
    handler: () => new Response(),
    api: {
      getSession: async () =>
        user
          ? { user: { ...user, email: `${user.id}@example.com` } }
          : null,
    },
  })) as unknown as NonNullable<AppDependencies["makeAuth"]>;

  return {
    app: createApp({
      makeAuth,
      withDatabase: async (_requestEnv, run) => run(db as DatabaseHandle),
      resolveParticipantIdentity: async (_db, authUserId) => {
        const participantId = ParticipantIdSchema.make(authUserId);
        return { participantId, participantIds: [participantId] };
      },
    }),
    calls,
  };
};

describe("Invite API", () => {
  it("로그인 없이 allowlist summary만 반환한다", async () => {
    const token = "00000000-0000-4000-8000-000000000001";
    const { app } = makeApp({ inviteExists: true });
    const response = await app.fetch(request(`/api/invites/${token}`), env);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      title: "오사카 여행",
      inviterName: "Host",
      participantCount: 1,
      destination: "오사카",
      startDate: "2026-09-01",
      endDate: "2026-09-04",
      alreadyJoined: false,
    });
  });

  it("malformed·만료·폐기·미존재를 같은 404로 숨기고 token을 오류에 넣지 않는다", async () => {
    for (const token of [
      "invite-trip-1",
      "00000000-0000-4000-8000-000000000002",
    ]) {
      const { app } = makeApp();
      const response = await app.fetch(request(`/api/invites/${token}`), env);
      const body = await response.text();

      expect(response.status).toBe(404);
      expect(JSON.parse(body)).toMatchObject({ error: { code: "INVITE_INVALID" } });
      expect(body).not.toContain(token);
      expect(body).not.toContain(room.id);
    }
  });

  it("초대 저장소 장애는 token 비노출 503으로 반환한다", async () => {
    const token = "00000000-0000-4000-8000-000000000003";
    const { app } = makeApp({ failInviteLookup: true });
    const response = await app.fetch(request(`/api/invites/${token}`), env);
    const body = await response.text();

    expect(response.status).toBe(503);
    expect(JSON.parse(body)).toMatchObject({ error: { code: "SERVICE_UNAVAILABLE" } });
    expect(body).not.toContain(token);
  });

  it("방장만 opaque token을 발급하고 폐기하며 DB에는 hash만 전달한다", async () => {
    const { app, calls } = makeApp({ user: { id: hostId, name: "Host" } });
    const issuedResponse = await app.fetch(
      request(`/api/trips/${room.id}/invites`, { method: "POST" }),
      env
    );
    expect(issuedResponse.status).toBe(201);
    const issued = (await issuedResponse.json()) as { token: string; expiresAt: string };
    expect(issued.token).toMatch(/^[0-9a-f-]{36}$/);

    const revokedResponse = await app.fetch(
      request(`/api/trips/${room.id}/invites`, { method: "DELETE" }),
      env
    );
    expect(revokedResponse.status).toBe(200);
    await expect(revokedResponse.json()).resolves.toEqual({ revoked: true });

    const inviteWrites = calls.filter(({ text }) =>
      text.includes('"trip_invite"')
    );
    expect(inviteWrites.map(({ text }) => text.split(" ", 1)[0])).toEqual([
      "insert",
      "update",
    ]);
    expect(JSON.stringify(inviteWrites)).not.toContain(issued.token);
    expect(inviteWrites[0].params).toContainEqual(
      expect.stringMatching(/^[a-f0-9]{64}$/)
    );
  });
});
