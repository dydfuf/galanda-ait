import { memoryAdapter } from "@better-auth/memory-adapter";
import { betterAuth } from "better-auth/minimal";
import { anonymous } from "better-auth/plugins";
import { describe, expect, it, vi } from "vitest";
import type { DatabaseHandle } from "../../../src/infrastructure/persistence/drizzle/database.ts";
import { tossLogin, type TossLoginFetcher } from "./toss-login.ts";

const createAuth = (
  fetcher?: TossLoginFetcher,
  options: {
    readonly db?: DatabaseHandle;
    readonly failSessionCreate?: boolean;
  } = {}
) =>
  {
    let sessionCreates = 0;
    return betterAuth({
    database: memoryAdapter({ user: [], session: [], account: [], verification: [] }),
    baseURL: "https://galanda.test",
    secret: "test-secret-that-is-long-enough-for-better-auth",
    databaseHooks: options.failSessionCreate
      ? {
          session: {
            create: {
              before: async () => {
                sessionCreates += 1;
                if (sessionCreates > 1) throw new Error("session create failed");
              },
            },
          },
        }
      : undefined,
    plugins: [
      anonymous(),
      tossLogin({ db: options.db ?? ({} as DatabaseHandle), fetcher }),
    ],
    });
  };

describe("Toss Login", () => {
  it("exchanges the authorization code and creates a session without profile data", async () => {
    const fetch = vi
      .fn<TossLoginFetcher["fetch"]>()
      .mockResolvedValueOnce(Response.json({ resultType: "SUCCESS", success: { accessToken: "token" } }))
      .mockResolvedValueOnce(Response.json({ resultType: "SUCCESS", success: { userKey: 1234 } }));
    const auth = createAuth({ fetch });

    const response = await auth.handler(
      new Request("https://galanda.test/api/auth/sign-in/toss", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ authorizationCode: "code", referrer: "SANDBOX" }),
      })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("better-auth");
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[0]?.[1]?.body).toBe(
      JSON.stringify({ authorizationCode: "code", referrer: "SANDBOX" })
    );
    expect(fetch.mock.calls[1]?.[1]?.headers).toEqual({ authorization: "Bearer token" });
  });

  it("returns 503 when the mTLS binding is absent", async () => {
    const response = await createAuth().handler(
      new Request("https://galanda.test/api/auth/sign-in/toss", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ authorizationCode: "code", referrer: "DEFAULT" }),
      })
    );

    expect(response.status).toBe(503);
  });

  it("keeps the Guest session and participant mapping when registered session creation fails", async () => {
    const fetch = vi
      .fn<TossLoginFetcher["fetch"]>()
      .mockResolvedValueOnce(Response.json({ resultType: "SUCCESS", success: { accessToken: "token" } }))
      .mockResolvedValueOnce(Response.json({ resultType: "SUCCESS", success: { userKey: 1234 } }));
    const transaction = vi.fn<() => Promise<void>>();
    const auth = createAuth({ fetch }, {
      db: { transaction } as unknown as DatabaseHandle,
      failSessionCreate: true,
    });
    const guestSignIn = await auth.handler(
      new Request("https://galanda.test/api/auth/sign-in/anonymous", {
        method: "POST",
      })
    );
    const guestCookie = guestSignIn.headers.get("set-cookie")?.split(";")[0];
    expect(guestCookie).toBeTruthy();

    const response = await auth.handler(
      new Request("https://galanda.test/api/auth/sign-in/toss", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: guestCookie ?? "",
        },
        body: JSON.stringify({ authorizationCode: "code", referrer: "SANDBOX" }),
      })
    );
    const guestSession = await auth.handler(
      new Request("https://galanda.test/api/auth/get-session", {
        headers: { cookie: guestCookie ?? "" },
      })
    );

    expect(response.status).toBe(500);
    expect(transaction).not.toHaveBeenCalled();
    await expect(guestSession.json()).resolves.toMatchObject({
      user: { isAnonymous: true },
    });
  });
});
