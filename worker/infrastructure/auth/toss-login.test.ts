import { memoryAdapter } from "@better-auth/memory-adapter";
import { betterAuth } from "better-auth/minimal";
import { describe, expect, it, vi } from "vitest";
import type { DatabaseHandle } from "../../../src/infrastructure/persistence/drizzle/database.ts";
import { tossLogin, type TossLoginFetcher } from "./toss-login.ts";

const createAuth = (fetcher?: TossLoginFetcher) =>
  betterAuth({
    database: memoryAdapter({ user: [], session: [], account: [], verification: [] }),
    baseURL: "https://galanda.test",
    secret: "test-secret-that-is-long-enough-for-better-auth",
    plugins: [tossLogin({ db: {} as DatabaseHandle, fetcher })],
  });

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
});
