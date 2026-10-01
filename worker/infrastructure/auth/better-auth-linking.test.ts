import { memoryAdapter } from "@better-auth/memory-adapter";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { drizzle, type NodePgClient } from "drizzle-orm/node-postgres";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DatabaseHandle } from "../../../src/infrastructure/persistence/drizzle/database.ts";
import * as schema from "../../../src/infrastructure/persistence/drizzle/schema/index.ts";
import { ensureParticipantIdentity } from "../../../src/infrastructure/auth/better-auth/participant-identity.ts";
import { makeBetterAuth } from "./better-auth.ts";
import type { TossLoginFetcher } from "./toss-login.ts";

// Exercise the production plugin composition; replace only its auth persistence.
vi.mock("@better-auth/drizzle-adapter", () => ({ drizzleAdapter: vi.fn() }));

const baseURL = "https://galanda.test";
const cookieFrom = (response: Response) => response.headers.getSetCookie()
  .map((cookie) => cookie.split(";")[0]).join("; ");

// Stateful SQL fixture: real participant adapter queries and transaction rollback,
// without a database server, real accounts, or external provider requests.
function participantDatabase() {
  let participants = new Map<string, string | null>();
  let aliases = new Map<string, string>();
  let snapshot = { participants: new Map(participants), aliases: new Map(aliases) };
  let failUpdate = false;
  const statements: string[] = [];
  const client = {
    async query(config: { text: string }, params: unknown[] = []) {
      const sql = config.text;
      statements.push(sql);
      const values = params as Array<string | null>;
      if (sql === "begin") snapshot = { participants: new Map(participants), aliases: new Map(aliases) };
      else if (sql === "rollback") ({ participants, aliases } = snapshot);
      else if (sql === "commit") { /* State is already committed. */ }
      else if (sql.startsWith('select "id" from "participant"')) {
        return { rows: [...participants].filter(([, user]) => user === values[0]).map(([id]) => [id]) };
      } else if (sql.startsWith('select "alias_participant_id" from "participant_alias"')) {
        return { rows: [...aliases].filter(([, canonical]) => canonical === values[0]).map(([id]) => [id]) };
      } else if (sql.startsWith('insert into "participant"')) {
        if (!participants.has(values[0]!)) participants.set(values[0]!, values[1]!);
      } else if (sql.startsWith('update "participant"')) {
        if (failUpdate && values[0] !== null) {
          failUpdate = false;
          throw new Error("synthetic participant write failure");
        }
        const returning = sql.includes('returning "id"');
        const id = values.at(returning ? -2 : -1)!;
        if (returning && participants.get(id) !== values.at(-1)) return { rows: [] };
        participants.set(id, values[0]!);
        if (returning) return { rows: [[id]] };
      } else if (sql.startsWith('update "participant_alias"')) {
        for (const [id, canonical] of aliases) if (canonical === values[1]) aliases.set(id, values[0]!);
      } else if (sql.startsWith('insert into "participant_alias"')) {
        aliases.set(values[0]!, values[1]!);
      } else throw new Error(`Unexpected participant fixture query: ${sql}`);
      return { rows: [] };
    },
  };
  return {
    db: drizzle(client as unknown as NodePgClient, { schema }) as DatabaseHandle,
    seed(id: string, userId: string | null, aliasOf?: string) {
      participants.set(id, userId);
      if (aliasOf) aliases.set(id, aliasOf);
    },
    failNextLink() { failUpdate = true; },
    state: () => ({ participants: [...participants], aliases: [...aliases] }),
    transactions: () => statements.filter((sql) => sql === "begin").length,
    rollbacks: () => statements.filter((sql) => sql === "rollback").length,
  };
}

function fixture() {
  const database = participantDatabase();
  const authRows: Record<string, Array<Record<string, unknown>>> = { user: [], session: [], account: [], verification: [] };
  vi.mocked(drizzleAdapter).mockReturnValue(memoryAdapter(authRows));
  const fetch = vi.fn<TossLoginFetcher["fetch"]>(async (input) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url.endsWith("/generate-token")) return Response.json({ resultType: "SUCCESS", success: { accessToken: "synthetic-token" } });
    if (url.endsWith("/login-me")) return Response.json({ resultType: "SUCCESS", success: { userKey: 1234 } });
    throw new Error("Unexpected Toss request");
  });
  const auth = makeBetterAuth(database.db, {
    APP_ENV: "staging",
    BETTER_AUTH_URL: baseURL,
    BETTER_AUTH_SECRET: "synthetic-test-secret-long-enough-for-better-auth",
    KAKAO_CLIENT_ID: "synthetic-kakao-client",
    TOSS_MTLS: { fetch },
  });
  const request = (path: string, body?: unknown, cookie = "") => auth.handler(new Request(`${baseURL}/api/auth${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json", origin: baseURL, cookie },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }));
  const toss = (cookie = "") => request("/sign-in/toss", { authorizationCode: "synthetic-code", referrer: "SANDBOX" }, cookie);
  const session = async (cookie: string) => (await request("/get-session", undefined, cookie)).json() as Promise<{ user: { id: string; isAnonymous?: boolean } } | null>;
  const guest = async () => {
    const response = await request("/sign-in/anonymous", {});
    expect(response.status).toBe(200);
    const { user } = await response.json() as { user: { id: string } };
    database.seed(user.id, user.id);
    database.seed("guest-older", null, user.id);
    return { id: user.id, cookie: cookieFrom(response) };
  };
  const existingToss = async () => {
    const ctx = await auth.$context;
    const user = await ctx.internalAdapter.createUser({ name: "Existing", email: "toss-1234@auth.galanda.invalid", emailVerified: false }, { method: "oauth", oauth: { providerId: "toss", profile: { userKey: 1234 } } });
    await ctx.internalAdapter.createAccount({ issuer: "toss", accountId: "1234", providerId: "toss", userId: user.id });
    database.seed("registered-participant", user.id);
    database.seed("registered-older", null, "registered-participant");
    return user;
  };
  return { ...database, auth, authRows, fetch, request, toss, session, guest, existingToss };
}

afterEach(() => vi.unstubAllGlobals());

describe("production Better Auth Guest linking", () => {
  it.each([false, true])("links a Guest to a Toss account exactly once (existing=%s)", async (existing) => {
    const f = fixture();
    const registered = existing ? await f.existingToss() : undefined;
    const guest = await f.guest();
    const response = await f.toss(guest.cookie);
    expect(response.status).toBe(200);
    expect(f.transactions()).toBe(1);
    const newSession = await f.session(cookieFrom(response));
    expect(newSession?.user.id).not.toBe(guest.id);
    expect(newSession?.user.isAnonymous).toBeFalsy();
    if (registered) expect(newSession?.user.id).toBe(registered.id);
    expect(await f.session(guest.cookie)).toBeNull();
    expect(f.authRows.user.some((user) => user.id === guest.id)).toBe(false);
    const identity = await ensureParticipantIdentity(f.db, newSession!.user.id);
    expect(identity.participantId).toBe(guest.id);
    expect(new Set(identity.participantIds)).toEqual(new Set([
      guest.id, "guest-older", ...(existing ? ["registered-participant", "registered-older"] : []),
    ]));
  });

  it.each([false, true])("rolls back a failed Toss participant transaction and permits retry (existing=%s)", async (existing) => {
    const f = fixture();
    if (existing) await f.existingToss();
    const guest = await f.guest();
    const previousState = f.state();
    f.failNextLink();
    const response = await f.toss(guest.cookie);
    expect(response.status).toBe(500);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(f.transactions()).toBe(1);
    expect(f.rollbacks()).toBe(1);
    expect(f.state()).toEqual(previousState);
    expect(await f.session(guest.cookie)).toMatchObject({ user: { id: guest.id, isAnonymous: true } });
    expect(f.authRows.session).toHaveLength(1);
    expect(f.authRows.session[0]?.userId).toBe(guest.id);
    expect(f.authRows.user.some((user) => user.id === guest.id)).toBe(true);

    const retried = await f.toss(guest.cookie);
    expect(retried.status).toBe(200);
    expect(f.transactions()).toBe(2);
    expect(await f.session(cookieFrom(retried))).toMatchObject({ user: { isAnonymous: false } });
    expect(await f.session(guest.cookie)).toBeNull();
  });

  it("preserves the Guest when registered session creation fails before linking", async () => {
    const f = fixture();
    const guest = await f.guest();
    const previousState = f.state();
    const ctx = await f.auth.$context;
    vi.spyOn(ctx.internalAdapter, "createSession").mockRejectedValueOnce(new Error("synthetic session failure"));
    const response = await f.toss(guest.cookie);
    expect(response.status).toBe(500);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(f.transactions()).toBe(0);
    expect(f.state()).toEqual(previousState);
    expect(await f.session(guest.cookie)).toMatchObject({ user: { id: guest.id, isAnonymous: true } });
    expect(f.authRows.session).toHaveLength(1);
  });

  it("keeps the successful Toss session when the plugin's best-effort Guest cleanup fails", async () => {
    const f = fixture();
    const guest = await f.guest();
    const ctx = await f.auth.$context;
    const cleanup = vi.spyOn(ctx.internalAdapter, "deleteUser").mockRejectedValueOnce(new Error("synthetic cleanup failure"));
    const response = await f.toss(guest.cookie);
    expect(response.status).toBe(200);
    expect(cleanup).toHaveBeenCalledExactlyOnceWith(guest.id);
    expect(f.transactions()).toBe(1);
    const newSession = await f.session(cookieFrom(response));
    expect(newSession?.user.id).not.toBe(guest.id);
    expect(newSession?.user.isAnonymous).toBeFalsy();
    expect(await ensureParticipantIdentity(f.db, newSession!.user.id)).toEqual({ participantId: guest.id, participantIds: [guest.id, "guest-older"] });
  });

  it("does not link or delete users for non-Guest Toss sign-in and repeated login", async () => {
    const f = fixture();
    const response = await f.toss();
    expect(response.status).toBe(200);
    const firstSession = await f.session(cookieFrom(response));
    const repeated = await f.toss(cookieFrom(response));
    expect(repeated.status).toBe(200);
    expect(await f.session(cookieFrom(repeated))).toMatchObject({ user: { id: firstSession!.user.id } });
    expect(f.transactions()).toBe(0);
    expect(f.authRows.user).toHaveLength(1);
    expect(f.authRows.account).toHaveLength(1);
  });

  it.each([false, true])("retains the shared email Guest-link hook (existing=%s)", async (existing) => {
    const f = fixture();
    const credentials = { name: "Synthetic Email User", email: "synthetic@example.test", password: "synthetic-password-only" };
    if (existing) expect((await f.request("/sign-up/email", credentials)).status).toBe(200);
    const guest = await f.guest();
    const response = await f.request(existing ? "/sign-in/email" : "/sign-up/email", credentials, guest.cookie);
    expect(response.status).toBe(200);
    expect(f.transactions()).toBe(1);
    const newSession = await f.session(cookieFrom(response));
    expect(newSession?.user.id).not.toBe(guest.id);
    expect(await ensureParticipantIdentity(f.db, newSession!.user.id)).toEqual({ participantId: guest.id, participantIds: [guest.id, "guest-older"] });
    expect(await f.session(guest.cookie)).toBeNull();
  });

  it("retains the shared Kakao callback Guest-link hook with mocked provider responses", async () => {
    const f = fixture();
    const guest = await f.guest();
    const providerFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url === "https://kauth.kakao.com/oauth/token") return Response.json({ access_token: "synthetic-kakao-token", token_type: "bearer", expires_in: 3600 });
      if (url === "https://kapi.kakao.com/v2/user/me") return Response.json({ id: 9999 });
      throw new Error(`Unexpected mocked provider request: ${url}`);
    });
    vi.stubGlobal("fetch", providerFetch);
    const signIn = await f.request("/sign-in/social", { provider: "kakao", callbackURL: `${baseURL}/home`, disableRedirect: true }, guest.cookie);
    expect(signIn.status).toBe(200);
    const { url } = await signIn.json() as { url: string };
    const state = new URL(url).searchParams.get("state");
    expect(state).toBeTruthy();
    const response = await f.request(`/callback/kakao?code=synthetic-code&state=${encodeURIComponent(state!)}`, undefined, `${guest.cookie}; ${cookieFrom(signIn)}`);
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(`${baseURL}/home`);
    expect(providerFetch).toHaveBeenCalledTimes(2);
    expect(f.transactions()).toBe(1);
    const newSession = await f.session(cookieFrom(response));
    expect(newSession?.user.id).not.toBe(guest.id);
    expect(await ensureParticipantIdentity(f.db, newSession!.user.id)).toEqual({ participantId: guest.id, participantIds: [guest.id, "guest-older"] });
    expect(await f.session(guest.cookie)).toBeNull();
  });
});
