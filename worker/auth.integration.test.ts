import { memoryAdapter } from "@better-auth/memory-adapter";
import { betterAuth } from "better-auth/minimal";
import { anonymous } from "better-auth/plugins";
import { describe, expect, it } from "vitest";
import { requireAuthSession } from "../src/core/ports/session.ts";
import { ParticipantIdSchema } from "../src/core/domain/ids.ts";
import type { DatabaseHandle } from "../src/infrastructure/persistence/drizzle/database.ts";
import { runEffect } from "./http/effect-handler.ts";
import { makeBetterAuth, type BetterAuthEnv } from "./infrastructure/auth/better-auth.ts";
import {
  createApp,
  type AppDependencies,
  type AppEnv,
} from "./app.ts";

const baseURL = "https://galanda.test";
const env = {} as AppEnv["Bindings"];

const createAuthFixture = (authEnv: BetterAuthEnv = {}) =>
  betterAuth({
    // Better Auth skips origin checks under NODE_ENV=test unless explicitly enabled.
    advanced: { disableOriginCheck: false },
    ...makeBetterAuth({} as DatabaseHandle, {
      ...authEnv,
      BETTER_AUTH_URL: baseURL,
      BETTER_AUTH_SECRET: "test-secret-that-is-long-enough-for-better-auth",
    }).options,
    database: memoryAdapter({
      user: [],
      session: [],
      account: [],
      verification: [],
    }),
    baseURL,
    secret: "test-secret-that-is-long-enough-for-better-auth",
    plugins: [anonymous()],
  });

const createTestApp = (authEnv: BetterAuthEnv = {}) => {
  const auth = createAuthFixture(authEnv);
  let sessionLookups = 0;
  const databaseHandle = {} as DatabaseHandle;
  const authDatabaseHandles: DatabaseHandle[] = [];
  const getSession = auth.api.getSession;
  const trackedAuth = {
    ...auth,
    api: {
      ...auth.api,
      getSession: async (
        ...args: Parameters<typeof auth.api.getSession>
      ): ReturnType<typeof auth.api.getSession> => {
        sessionLookups += 1;
        return getSession(...args);
      },
    },
  };
  const makeAuth = ((db: DatabaseHandle) => {
    authDatabaseHandles.push(db);
    return trackedAuth;
  }) as unknown as NonNullable<
    AppDependencies["makeAuth"]
  >;
  const withDatabase: NonNullable<AppDependencies["withDatabase"]> = async (
    _requestEnv,
    run
  ) => run(databaseHandle);
  const app = createApp({
    makeAuth,
    withDatabase,
    resolveParticipantIdentity: async (_db, authUserId) => {
      const participantId = ParticipantIdSchema.make(authUserId);
      return { participantId, participantIds: [participantId] };
    },
  });

  app.get("/api/protected", (c) =>
    runEffect(c, requireAuthSession())
  );

  return {
    app,
    getSessionLookups: () => sessionLookups,
    getAuthDatabaseHandles: () => authDatabaseHandles,
    databaseHandle,
  };
};

const request = (
  path: string,
  init?: RequestInit,
  cookie?: string
): Request => {
  const headers = new Headers(init?.headers);
  headers.set("content-type", "application/json");
  if (!headers.has("origin")) headers.set("origin", baseURL);
  if (cookie) headers.set("cookie", cookie);
  return new Request(`${baseURL}${path}`, { ...init, headers });
};

describe("Better Auth Worker integration", () => {
  it.each([undefined, "production", "development", "staging"])(
    "exposes email login only for the staging server binding (%s), without opening a database",
    async (APP_ENV) => {
      const app = createApp({ withDatabase: async () => { throw new Error("must not open database"); } });
      const response = await app.fetch(request("/api/auth/config?APP_ENV=staging"), { ...env, APP_ENV });
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(await response.json()).toEqual({ emailAndPassword: APP_ENV === "staging" });
    },
  );

  it.each([undefined, "production", "development"])("rejects direct email sign-up and sign-in outside staging (%s)", async (APP_ENV) => {
    const { app } = createTestApp({ APP_ENV });
    for (const action of ["sign-up", "sign-in"]) {
      const response = await app.fetch(request(`/api/auth/${action}/email`, {
        method: "POST",
        body: JSON.stringify({ name: "Test Agent", email: "agent@example.test", password: "test-password-123" }),
      }), { ...env, APP_ENV });
      expect(response.status).toBe(400);
      expect(response.headers.get("set-cookie")).toBeNull();
    }
  });

  it("signs up a staging account, signs out, rejects a wrong password, and signs back into a registered session", async () => {
    const stagingEnv = { ...env, APP_ENV: "staging" };
    const { app } = createTestApp(stagingEnv);
    const credentials = { email: "agent@example.test", password: "test-password-123" };
    const signUp = await app.fetch(request("/api/auth/sign-up/email", {
      method: "POST", body: JSON.stringify({ ...credentials, name: "Test Agent" }),
    }), stagingEnv);
    expect(signUp.status).toBe(200);
    const cookie = signUp.headers.get("set-cookie")?.split(";")[0];
    expect(cookie).toBeTruthy();
    const session = await app.fetch(request("/api/session", {}, cookie), stagingEnv);
    const registeredSession = await session.json();
    expect(registeredSession).toMatchObject({ isAuthenticated: true, accountType: "REGISTERED", name: "Test Agent" });
    const protectedResponse = await app.fetch(request("/api/protected", {}, cookie), stagingEnv);
    expect(protectedResponse.status).toBe(200);
    const signOut = await app.fetch(request("/api/auth/sign-out", { method: "POST", body: "{}" }, cookie), stagingEnv);
    expect(signOut.status).toBe(200);
    expect((await app.fetch(request("/api/protected", {}, cookie), stagingEnv)).status).toBe(401);

    const wrongPassword = await app.fetch(request("/api/auth/sign-in/email", {
      method: "POST", body: JSON.stringify({ ...credentials, password: "wrong-password" }),
    }), stagingEnv);
    expect(wrongPassword.status).toBe(401);
    expect(wrongPassword.headers.get("set-cookie")).toBeNull();
    const signIn = await app.fetch(request("/api/auth/sign-in/email", {
      method: "POST", body: JSON.stringify(credentials),
    }), stagingEnv);
    expect(signIn.status).toBe(200);
    const newCookie = signIn.headers.get("set-cookie")?.split(";")[0];
    expect(newCookie).toBeTruthy();
    expect(await (await app.fetch(request("/api/session", {}, newCookie), stagingEnv)).json()).toEqual(registeredSession);
  });

  it("keeps staging password validation and origin protection enabled", async () => {
    const stagingEnv = { ...env, APP_ENV: "staging" };
    const { app } = createTestApp(stagingEnv);
    const body = { name: "Test Agent", email: "agent@example.test", password: "short" };
    const shortPassword = await app.fetch(request("/api/auth/sign-up/email", { method: "POST", body: JSON.stringify(body) }), stagingEnv);
    expect(shortPassword.status).toBe(400);
    const foreignOrigin = await app.fetch(request("/api/auth/sign-up/email", {
      method: "POST", headers: { origin: "https://untrusted.test", "sec-fetch-site": "cross-site" }, body: JSON.stringify({ ...body, password: "test-password-123" }),
    }), stagingEnv);
    expect(foreignOrigin.status).toBe(403);
    expect(foreignOrigin.headers.get("set-cookie")).toBeNull();
  });

  it("creates an anonymous Guest session, preserves its cookie, and signs out", async () => {
    const { app } = createTestApp();
    const signIn = await app.fetch(
      request("/api/auth/sign-in/anonymous", { method: "POST" }),
      env
    );

    expect(signIn.status).toBe(200);
    const setCookie = signIn.headers.get("set-cookie");
    expect(setCookie).toContain("better-auth");
    const cookie = setCookie?.split(";")[0];
    expect(cookie).toBeTruthy();

    const session = await app.fetch(request("/api/auth/get-session", {}, cookie), env);
    expect(session.status).toBe(200);
    expect(
      ((await session.json()) as { user?: { isAnonymous?: boolean } }).user
        ?.isAnonymous
    ).toBe(true);

    const signout = await app.fetch(
      request("/api/auth/sign-out", { method: "POST" }, cookie),
      env
    );
    expect(signout.status).toBe(200);

    const afterSignout = await app.fetch(
      request("/api/auth/get-session", {}, cookie),
      env
    );
    await expect(afterSignout.json()).resolves.toBeNull();
  });

  it("resolves the application session once and provides SessionService to Effect", async () => {
    const { app, databaseHandle, getAuthDatabaseHandles, getSessionLookups } =
      createTestApp();
    const signIn = await app.fetch(
      request("/api/auth/sign-in/anonymous", { method: "POST" }),
      env
    );
    const cookie = signIn.headers.get("set-cookie")?.split(";")[0];
    expect(cookie).toBeTruthy();

    const protectedResponse = await app.fetch(
      request("/api/protected", {}, cookie),
      env
    );

    expect(protectedResponse.status).toBe(200);
    await expect(protectedResponse.json()).resolves.toMatchObject({
      participantId: expect.any(String),
      accountType: "GUEST",
      name: "Anonymous",
      isAuthenticated: true,
    });
    expect(getSessionLookups()).toBe(1);
    expect(getAuthDatabaseHandles().length).toBe(2);
    expect(getAuthDatabaseHandles().every((db) => db === databaseHandle)).toBe(
      true
    );
  });

  it("maps no session and auth lookup failure through the Effect boundary", async () => {
    const unauthenticated = createTestApp();
    const unauthenticatedResponse = await unauthenticated.app.fetch(
      request("/api/protected"),
      env
    );
    expect(unauthenticatedResponse.status).toBe(401);
    const optionalSession = await unauthenticated.app.fetch(
      request("/api/session"),
      env
    );
    expect(optionalSession.status).toBe(200);
    await expect(optionalSession.json()).resolves.toBeNull();

    const auth = createAuthFixture();
    const failingAuth = {
      ...auth,
      api: {
        ...auth.api,
        getSession: async () => {
          throw new Error("auth database unavailable");
        },
      },
    };
    const makeFailingAuth = (() => failingAuth) as unknown as NonNullable<
      AppDependencies["makeAuth"]
    >;
    const failingApp = createApp({
      makeAuth: makeFailingAuth,
      withDatabase: async (_requestEnv, run) => run({} as DatabaseHandle),
      resolveParticipantIdentity: async (_db, authUserId) => {
        const participantId = ParticipantIdSchema.make(authUserId);
        return { participantId, participantIds: [participantId] };
      },
    });
    failingApp.get("/api/protected", (c) =>
      runEffect(c, requireAuthSession())
    );

    const failureResponse = await failingApp.fetch(
      request("/api/protected"),
      env
    );
    expect(failureResponse.status).toBe(503);
    const failedOptionalSession = await failingApp.fetch(
      request("/api/session"),
      env
    );
    expect(failedOptionalSession.status).toBe(503);
    await expect(failedOptionalSession.json()).resolves.toMatchObject({
      error: { code: "AUTH_SERVICE_UNAVAILABLE" },
    });
  });
});
