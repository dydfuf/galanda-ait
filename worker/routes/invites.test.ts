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
  readonly joinResult?: TripRoom;
  readonly user?: { readonly id: string; readonly name: string } | null;
}) => {
  const calls: Array<{ readonly text: string; readonly params: unknown[] }> = [];
  let joined = false;
  const client = {
    query: async (
      config: { readonly text: string } | string,
      params: unknown[] = []
    ) => {
      const text = typeof config === "string" ? config : config.text;
      calls.push({ text, params });
      if (text === "begin" || text === "commit" || text === "rollback") {
        return { rows: [] };
      }
      if (text.includes('from "participant_alias"')) return { rows: [] };
      if (text.startsWith("insert") && text.includes('"trip_invite"')) {
        return { rows: [] };
      }
      if (text.includes('inner join "trip_rooms"')) {
        if (options?.failInviteLookup) throw new Error("database unavailable");
        return {
          rows: options?.inviteExists
            ? [rowValues(joined && options.joinResult ? options.joinResult : room)]
            : [],
        };
      }
      if (text.startsWith("update") && text.includes('"trip_rooms"')) {
        joined = true;
        return { rows: options?.joinResult ? [rowValues(options.joinResult)] : [] };
      }
      if (text.includes('from "trip_invite"')) {
        if (options?.failInviteLookup) throw new Error("database unavailable");
        return {
          rows: options?.inviteExists
            ? [[room.id, "Host"]]
            : [],
        };
      }
      if (text.includes('from "trip_rooms"')) {
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

  it("session 신원과 nickname으로 한 번만 참여하고 같은 요청 재시도는 멱등이다", async () => {
    const token = "00000000-0000-4000-8000-000000000004";
    const guestId = ParticipantIdSchema.make("guest-1");
    const joinedRoom: TripRoom = {
      ...room,
      revision: RevisionSchema.make(3),
      members: [
        ...room.members,
        { id: guestId, name: "Host", role: "MEMBER" },
      ],
    };
    const { app, calls } = makeApp({
      inviteExists: true,
      joinResult: joinedRoom,
      user: { id: guestId, name: "Anonymous" },
    });

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await app.fetch(
        request(`/api/invites/${token}/join`, {
          method: "POST",
          body: JSON.stringify({ nickname: "  Host  " }),
        }),
        env
      );
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual(joinedRoom);
    }

    const roomWrites = calls.filter(
      ({ text }) => text.startsWith("update") && text.includes('"trip_rooms"')
    );
    expect(roomWrites).toHaveLength(1);
    expect(calls.some(({ text }) => text.includes("for update of"))).toBe(true);
    expect(JSON.stringify(calls)).not.toContain(token);
    expect(roomWrites[0].params).toContain(
      JSON.stringify(joinedRoom.members)
    );
  });

  it("비로그인·잘못된 nickname·직접 roomId join을 membership write 전에 거부한다", async () => {
    const token = "00000000-0000-4000-8000-000000000005";
    const unauthenticated = makeApp({ inviteExists: true, user: null });
    const noSession = await unauthenticated.app.fetch(
      request(`/api/invites/${token}/join`, {
        method: "POST",
        body: JSON.stringify({ nickname: "Guest" }),
      }),
      env
    );
    expect(noSession.status).toBe(401);
    expect(unauthenticated.calls).toEqual([]);

    const authenticated = makeApp({
      inviteExists: true,
      user: { id: "guest-1", name: "Anonymous" },
    });
    for (const nickname of ["   ", "가".repeat(21)]) {
      const response = await authenticated.app.fetch(
        request(`/api/invites/${token}/join`, {
          method: "POST",
          body: JSON.stringify({ nickname }),
        }),
        env
      );
      expect(response.status).toBe(422);
    }
    const spoofed = await authenticated.app.fetch(
      request(`/api/invites/${token}/join`, {
        method: "POST",
        body: JSON.stringify({
          nickname: "Guest",
          id: "attacker",
          role: "HOST",
          tripId: room.id,
        }),
      }),
      env
    );
    expect(spoofed.status).toBe(400);
    const bypass = await authenticated.app.fetch(
      request(`/api/trips/${room.id}/join`, {
        method: "POST",
        body: JSON.stringify({ nickname: "Guest" }),
      }),
      env
    );
    expect(bypass.status).toBe(404);
    expect(
      authenticated.calls.some(
        ({ text }) => text.startsWith("update") && text.includes('"trip_rooms"')
      )
    ).toBe(false);
  });

  it("join 저장 실패는 membership 없이 재시도 가능한 503으로 남긴다", async () => {
    const token = "00000000-0000-4000-8000-000000000006";
    const { app, calls } = makeApp({
      inviteExists: true,
      failInviteLookup: true,
      user: { id: "guest-1", name: "Anonymous" },
    });
    const response = await app.fetch(
      request(`/api/invites/${token}/join`, {
        method: "POST",
        body: JSON.stringify({ nickname: "Guest" }),
      }),
      env
    );

    expect(response.status).toBe(503);
    expect(calls.some(({ text }) => text === "rollback")).toBe(true);
    expect(
      calls.some(
        ({ text }) => text.startsWith("update") && text.includes('"trip_rooms"')
      )
    ).toBe(false);
  });
});
