import { afterEach, describe, expect, it, vi } from "vitest";
import { Cause } from "effect";
import { Hono } from "hono";
import { createApp, type AppEnv } from "../app.ts";
import { mapErrorToResponse } from "./api-error.ts";
import { makeBetterAuth } from "../infrastructure/auth/better-auth.ts";
import type { DatabaseHandle } from "../../src/infrastructure/persistence/drizzle/database.ts";

const sensitive = "private@example.invalid cookie=session-value postgresql://user:password@host/db invite-token";

afterEach(() => vi.restoreAllMocks());

describe("privacy-safe failure logs", () => {
  it("does not serialize raw auth/database errors at the HTTP boundary", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const app = createApp({ withDatabase: async () => { throw new Error(sensitive); } });
    const response = await app.fetch(new Request("https://galanda.test/api/auth/get-session"), {} as AppEnv["Bindings"]);
    expect(response.status).toBe(500);
    expect(JSON.stringify(log.mock.calls)).not.toContain(sensitive);
    expect(log.mock.calls.some(([record]) => JSON.parse(String(record)).event === "unhandled_error")).toBe(true);
    expect(await response.text()).not.toContain(sensitive);
  });

  it.each([Cause.die(new Error(sensitive)), Cause.interrupt()])("does not serialize Effect defects or causes", async (cause) => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const app = new Hono<AppEnv>();
    app.get("/", (c) => mapErrorToResponse(c, cause, "safe-request"));
    const response = await app.request("/");
    expect(response.status).toBe(500);
    expect(JSON.stringify(log.mock.calls)).not.toContain(sensitive);
    expect(JSON.parse(String(log.mock.calls[0]?.[0]))).toEqual({
      event: cause.reasons.some(Cause.isDieReason) ? "effect_defect" : "effect_interrupted",
      requestId: "safe-request",
    });
  });

  it("sanitizes Better Auth diagnostics including arbitrary extra arguments", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const auth = makeBetterAuth({} as DatabaseHandle, {
      BETTER_AUTH_SECRET: "test-secret-that-is-long-enough-for-better-auth",
      BETTER_AUTH_URL: "https://galanda.test",
    });
    auth.options.logger?.log?.("error", sensitive, new Error(sensitive), { token: sensitive });
    expect(log).toHaveBeenCalledWith(JSON.stringify({ event: "auth_diagnostic", level: "error" }));
    expect(JSON.stringify(log.mock.calls)).not.toContain(sensitive);
  });
});
