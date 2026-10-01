import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "../../../src/infrastructure/persistence/drizzle/schema/index.ts";
import { ensureParticipantIdentity } from "../../../src/infrastructure/auth/better-auth/participant-identity.ts";
import { makeBetterAuth } from "./better-auth.ts";
import type { TossLoginFetcher } from "./toss-login.ts";

// Never read DATABASE_URL, MIGRATION_DATABASE_URL, .dev.vars, or real credentials.
// Fixed host/database/credentials intentionally only match the disposable CI service.
const port = Number(process.env.GALANDA_TEST_PG_PORT);
if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error("Set GALANDA_TEST_PG_PORT to the fresh synthetic PostgreSQL service's loopback port");
}
const connection = {
  host: "127.0.0.1", port, database: "galanda_auth_test",
  password: "synthetic-postgres-test-only", connectionTimeoutMillis: 3_000,
};
const admin = new Pool({ ...connection, user: "postgres", max: 3 });
const runtime = new Pool({ ...connection, user: "galanda_worker", max: 8, application_name: "galanda-auth-postgres-test" });
const db = drizzle(runtime, { schema });
const baseURL = "https://galanda.test";
const cookieFrom = (response: Response) => response.headers.getSetCookie()
  .map((cookie) => cookie.split(";")[0]).join("; ");

beforeAll(async () => {
  const { rows: [server] } = await admin.query<{ version: string; database: string; empty: boolean }>(`
    SELECT current_setting('server_version_num') AS version, current_database() AS database,
      NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public') AS empty
  `);
  assert.equal(server?.database, "galanda_auth_test");
  assert.ok(Number(server?.version) >= 150000);
  assert.ok(Number(server?.version) < 160000);
  // Refuse reused/nonempty databases before any schema changes or cleanup.
  assert.equal(server?.empty, true, "Use a fresh disposable PostgreSQL container");
  await admin.query("CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN");
  await migrate(drizzle(admin), { migrationsFolder: "./drizzle" });
  const privileges = await readFile("scripts/verify-database-privileges.sql", "utf8");
  await admin.query(privileges.replace(/^\\set .*$/m, ""));
  await admin.query("ALTER ROLE galanda_worker LOGIN PASSWORD 'synthetic-postgres-test-only'");
  assert.deepEqual((await runtime.query("SELECT current_user")).rows[0], { current_user: "galanda_worker" });
});

beforeEach(async () => {
  await admin.query('TRUNCATE public."user", public.participant, public.trip_rooms CASCADE');
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("External network is forbidden in PostgreSQL tests"); }));
});
afterEach(async () => {
  await admin.query("DROP TRIGGER IF EXISTS synthetic_link_failure ON participant; DROP FUNCTION IF EXISTS synthetic_link_failure()");
  vi.unstubAllGlobals();
});
afterAll(async () => { await Promise.all([runtime.end(), admin.end()]); });

function fixture() {
  const fetch = vi.fn<TossLoginFetcher["fetch"]>(async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url.endsWith("/generate-token")) {
      if (typeof init?.body !== "string") throw new Error("Expected synthetic JSON request");
      const { authorizationCode } = JSON.parse(init.body) as { authorizationCode: string };
      return Response.json({ resultType: "SUCCESS", success: { accessToken: authorizationCode } });
    }
    if (url.endsWith("/login-me")) {
      const userKey = new Headers(init?.headers).get("authorization")?.replace("Bearer ", "");
      return Response.json({ resultType: "SUCCESS", success: { userKey } });
    }
    throw new Error("Unexpected mocked Toss request");
  });
  const auth = makeBetterAuth(db, {
    APP_ENV: "staging", BETTER_AUTH_URL: baseURL,
    BETTER_AUTH_SECRET: "synthetic-test-secret-long-enough-for-better-auth",
    TOSS_MTLS: { fetch },
  });
  const request = (path: string, body?: unknown, cookie = "") => auth.handler(new Request(`${baseURL}/api/auth${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json", origin: baseURL, cookie },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }));
  const toss = (cookie = "", key = "1234") => request("/sign-in/toss", { authorizationCode: key, referrer: "SANDBOX" }, cookie);
  const session = async (cookie: string) => (await request("/get-session", undefined, cookie)).json() as Promise<{ user: { id: string; isAnonymous: boolean } } | null>;
  const seedAliases = async (id: string, aliases: string[]) => {
    for (const alias of aliases) {
      await db.insert(schema.participants).values({ id: alias });
      await db.insert(schema.participantAliases).values({ aliasParticipantId: alias, canonicalParticipantId: id });
    }
  };
  const guest = async (suffix = "guest") => {
    const response = await request("/sign-in/anonymous", {});
    expect(response.status).toBe(200);
    const { user } = await response.json() as { user: { id: string } };
    await ensureParticipantIdentity(db, user.id);
    await seedAliases(user.id, [`${suffix}-older`]);
    const ctx = await auth.$context;
    // Real dependent rows verify production Guest cleanup, not just adapter calls.
    await ctx.internalAdapter.createSession(user.id);
    await ctx.internalAdapter.createAccount({ issuer: "synthetic-guest", accountId: user.id, providerId: "synthetic-guest", userId: user.id });
    await db.insert(schema.tripRooms).values({ id: suffix, title: "Synthetic trip", destination: "Synthetic" });
    await db.insert(schema.tripInvites).values({ tripId: suffix, tokenHash: suffix, issuedByParticipantId: user.id, inviterName: "Synthetic", expiresAt: new Date(Date.now() + 3600_000) });
    return { id: user.id, cookie: cookieFrom(response), older: `${suffix}-older`, trip: suffix };
  };
  const existingToss = async (key = "1234") => {
    const response = await toss("", key);
    expect(response.status).toBe(200);
    const { user } = (await session(cookieFrom(response)))!;
    const identity = await ensureParticipantIdentity(db, user.id);
    await seedAliases(identity.participantId, [`registered-${key}-older`]);
    return { id: user.id, participant: identity.participantId, older: `registered-${key}-older` };
  };
  return { auth, toss, request, session, guest, existingToss };
}

async function participantState() {
  return {
    participants: await db.select({ id: schema.participants.id, user: schema.participants.authUserId }).from(schema.participants).orderBy(schema.participants.id),
    aliases: await db.select().from(schema.participantAliases).orderBy(schema.participantAliases.aliasParticipantId),
  };
}

async function expectGuestCleaned(id: string, trip: string) {
  expect(await db.select().from(schema.user).where(eq(schema.user.id, id))).toHaveLength(0);
  expect(await db.select().from(schema.session).where(eq(schema.session.userId, id))).toHaveLength(0);
  expect(await db.select().from(schema.account).where(eq(schema.account.userId, id))).toHaveLength(0);
  expect(await db.select().from(schema.participants).where(eq(schema.participants.id, id))).toHaveLength(1);
  expect(await db.select().from(schema.tripInvites).where(eq(schema.tripInvites.tripId, trip))).toHaveLength(1);
}

// Hold the source row until both real HTTP calls have reached a PostgreSQL lock.
// This proves overlap deterministically rather than relying on Promise.all timing.
async function overlapLinks(guestId: string, calls: () => Promise<Response>[]) {
  const lock = await admin.connect();
  const pending: Promise<Response>[] = [];
  try {
    await lock.query("BEGIN");
    await lock.query("SELECT id FROM participant WHERE id = $1 FOR UPDATE", [guestId]);
    pending.push(...calls());
    const deadline = Date.now() + 8_000;
    let blocked = 0;
    while (Date.now() < deadline) {
      const { rows } = await admin.query<{ count: string }>("SELECT count(*) FROM pg_stat_activity WHERE application_name = 'galanda-auth-postgres-test' AND wait_event_type = 'Lock'");
      blocked = Number(rows[0]?.count);
      if (blocked >= 2) break;
      await delay(20);
    }
    expect(blocked, "Both requests must overlap at real database locks").toBeGreaterThanOrEqual(2);
  } finally {
    await lock.query("ROLLBACK");
    lock.release();
    // Drain before teardown even if the barrier assertion fails.
    await Promise.allSettled(pending);
  }
  return Promise.all(pending);
}

describe("production Better Auth on PostgreSQL 15 with galanda_worker privileges", () => {
  it("enforces committed auth/participant unique, foreign-key and no-self-alias constraints", async () => {
    const f = fixture();
    const guest = await f.guest();
    await expect(runtime.query('INSERT INTO participant(id, auth_user_id) VALUES ($1, $2)', ["duplicate", guest.id])).rejects.toMatchObject({ code: "23505", constraint: "participant_auth_user_id_uidx" });
    await expect(runtime.query('INSERT INTO participant(id, auth_user_id) VALUES ($1, $2)', ["missing", "missing-user"])).rejects.toMatchObject({ code: "23503" });
    await expect(runtime.query('INSERT INTO participant_alias(alias_participant_id, canonical_participant_id) VALUES ($1, $1)', [guest.id])).rejects.toMatchObject({ code: "23514", constraint: "participant_alias_not_self" });
    await expect(runtime.query('INSERT INTO participant_alias(alias_participant_id, canonical_participant_id) VALUES ($1, $2)', ["missing-participant", guest.id])).rejects.toMatchObject({ code: "23503" });
    await expect(runtime.query('UPDATE participant_alias SET canonical_participant_id = $1 WHERE alias_participant_id = $2', ["missing-participant", guest.older])).rejects.toMatchObject({ code: "23503" });
    await expect(runtime.query('INSERT INTO account(id, issuer, account_id, provider_id, user_id, updated_at) VALUES ($1, $2, $3, $2, $3, now())', ["duplicate-account", "synthetic-guest", guest.id])).rejects.toMatchObject({ code: "23505", constraint: "account_issuer_accountId_uidx" });
    await expect(runtime.query('CREATE TABLE forbidden_runtime_table (id text)')).rejects.toMatchObject({ code: "42501" });
  });

  it("applies auth SET NULL/cascades and participant alias/domain FK cascades", async () => {
    const f = fixture();
    const guest = await f.guest();
    // Direct DML distinguishes real FK actions from Better Auth's explicit cleanup.
    await db.delete(schema.user).where(eq(schema.user.id, guest.id));
    await expectGuestCleaned(guest.id, guest.trip);
    expect(await db.select({ user: schema.participants.authUserId }).from(schema.participants).where(eq(schema.participants.id, guest.id))).toEqual([{ user: null }]);
    expect(await db.select().from(schema.participantAliases)).toHaveLength(1);
    await db.delete(schema.participants).where(eq(schema.participants.id, guest.older));
    expect(await db.select().from(schema.participantAliases)).toHaveLength(0);
    await db.delete(schema.participants).where(eq(schema.participants.id, guest.id));
    expect(await db.select().from(schema.tripInvites)).toHaveLength(0);
  });

  it.each([false, true])("preserves stable identities and domain FKs while removing Guest auth rows (existing=%s)", async (existing) => {
    const f = fixture();
    const registered = existing ? await f.existingToss() : undefined;
    const guest = await f.guest();
    const response = await f.toss(guest.cookie);
    expect(response.status).toBe(200);
    const session = await f.session(cookieFrom(response));
    expect(session?.user.isAnonymous).toBe(false);
    if (registered) expect(session?.user.id).toBe(registered.id);
    const identity = await ensureParticipantIdentity(db, session!.user.id);
    expect(identity.participantId).toBe(guest.id);
    expect(new Set(identity.participantIds)).toEqual(new Set([guest.id, guest.older, ...(registered ? [registered.participant, registered.older] : [])]));
    await expectGuestCleaned(guest.id, guest.trip);
    expect(await f.session(guest.cookie)).toBeNull();
    const repeated = await f.toss(cookieFrom(response));
    expect(repeated.status).toBe(200);
    expect(await ensureParticipantIdentity(db, session!.user.id)).toEqual(identity);
    expect(await db.select().from(schema.account).where(eq(schema.account.issuer, "toss"))).toHaveLength(1);
  });

  it.each([false, true])("rolls back a PostgreSQL link failure, removes the new session, and retries (existing=%s)", async (existing) => {
    const f = fixture();
    if (existing) await f.existingToss();
    const guest = await f.guest();
    const before = await participantState();
    const sessionsBefore = await db.select().from(schema.session);
    await admin.query(`CREATE FUNCTION synthetic_link_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.auth_user_id IS NOT NULL THEN RAISE EXCEPTION 'synthetic link failure'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER synthetic_link_failure BEFORE UPDATE ON participant FOR EACH ROW EXECUTE FUNCTION synthetic_link_failure()`);
    const response = await f.toss(guest.cookie);
    expect(response.status).toBe(500);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(await participantState()).toEqual(before);
    expect(await db.select().from(schema.session)).toHaveLength(sessionsBefore.length);
    expect(await f.session(guest.cookie)).toMatchObject({ user: { id: guest.id, isAnonymous: true } });
    await admin.query("DROP TRIGGER synthetic_link_failure ON participant; DROP FUNCTION synthetic_link_failure()");
    const retried = await f.toss(guest.cookie);
    expect(retried.status).toBe(200);
    await expectGuestCleaned(guest.id, guest.trip);
  });

  it.each([false, true])("does not transfer one Guest to two concurrent accounts (existing=%s)", async (existing) => {
    const f = fixture();
    const first = existing ? await f.existingToss("1234") : undefined;
    const second = existing ? await f.existingToss("5678") : undefined;
    const guest = await f.guest();
    const responses = await overlapLinks(guest.id, () => [f.toss(guest.cookie, "1234"), f.toss(guest.cookie, "5678")]);
    const users = await db.select().from(schema.user);
    const accounts = [first, second].map((registered, index) => registered ?? {
      id: users.find((user) => user.email === `toss-${["1234", "5678"][index]}@auth.galanda.invalid`)!.id,
      participant: users.find((user) => user.email === `toss-${["1234", "5678"][index]}@auth.galanda.invalid`)!.id,
    });
    expect(responses.filter((r) => r.status === 200)).toHaveLength(1);
    const winner = responses.findIndex((r) => r.status === 200);
    const loser = 1 - winner;
    expect(responses[loser]!.status).toBeGreaterThanOrEqual(400);
    expect(responses[loser]!.headers.get("set-cookie")).toBeNull();
    const winnerIdentity = await ensureParticipantIdentity(db, accounts[winner]!.id);
    expect(winnerIdentity.participantId).toBe(guest.id);
    expect(new Set(winnerIdentity.participantIds)).toEqual(new Set([guest.id, guest.older, ...(existing ? [accounts[winner]!.participant, `registered-${["1234", "5678"][winner]}-older`] : [])]));
    expect(await ensureParticipantIdentity(db, accounts[loser]!.id)).toEqual({ participantId: accounts[loser]!.participant, participantIds: [accounts[loser]!.participant, ...(existing ? [`registered-${["1234", "5678"][loser]}-older`] : [])] });
    expect(await db.select().from(schema.session).where(eq(schema.session.userId, accounts[loser]!.id))).toHaveLength(existing ? 1 : 0);
    await expectGuestCleaned(guest.id, guest.trip);
  });

  it("keeps simultaneous same-account requests safe and permits a subsequent login retry", async () => {
    const f = fixture();
    const registered = await f.existingToss();
    const guest = await f.guest();
    const responses = await overlapLinks(guest.id, () => [f.toss(guest.cookie), f.toss(guest.cookie)]);
    expect(responses.some((r) => r.status === 200)).toBe(true);
    for (const response of responses) if (response.status !== 200) expect(response.headers.get("set-cookie")).toBeNull();
    const identity = await ensureParticipantIdentity(db, registered.id);
    expect(identity.participantId).toBe(guest.id);
    expect(new Set(identity.participantIds)).toEqual(new Set([guest.id, guest.older, registered.participant, registered.older]));
    const retry = await f.toss(guest.cookie);
    expect(retry.status).toBe(200);
    expect(await ensureParticipantIdentity(db, registered.id)).toEqual(identity);
    await expectGuestCleaned(guest.id, guest.trip);
  });
});
