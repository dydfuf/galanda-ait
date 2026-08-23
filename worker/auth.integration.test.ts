import { memoryAdapter } from "@better-auth/memory-adapter";
import { betterAuth } from "better-auth/minimal";
import { anonymous } from "better-auth/plugins";
import { describe, expect, it } from "vitest";
import { requireAuthSession } from "../src/core/ports/session.ts";
import { ParticipantIdSchema } from "../src/core/domain/ids.ts";
import type { DatabaseHandle } from "../src/infrastructure/persistence/drizzle/database.ts";
import { runEffect } from "./http/effect-handler.ts";
import {
  createApp,
  type AppDependencies,
  type AppEnv,
} from "./app.ts";

const baseURL = "https://galanda.test";
const env = {} as AppEnv["Bindings"];

const createAuthFixture = () =>
  betterAuth({
    database: memoryAdapter({
      user: [],
      session: [],
      account: [],
      verification: [],
    }),
    baseURL,
    secret: "test-secret-that-is-long-enough-for-better-auth",
    emailAndPassword: { enabled: false },
    plugins: [anonymous()],
  });

const createTestApp = () => {
  const auth = createAuthFixture();
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
  if (cookie) headers.set("cookie", cookie);
  return new Request(`${baseURL}${path}`, { ...init, headers });
};

describe("Better Auth Worker integration", () => {
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
  });
});
