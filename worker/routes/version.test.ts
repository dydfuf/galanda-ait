import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, type AppEnv } from "../app.ts";

afterEach(() => vi.restoreAllMocks());

describe("public Worker version", () => {
  it("returns only the platform version ID without initializing auth or a database", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const makeAuth = vi.fn<() => never>(() => { throw new Error("auth must not run"); });
    const withDatabase = vi.fn<() => never>(() => { throw new Error("database must not run"); });
    const app = createApp({ makeAuth, withDatabase });
    const versionId = "00000000-0000-4000-8000-000000000001";
    const env = {
      CF_VERSION_METADATA: { id: versionId, tag: "private-release-note", timestamp: "2026-01-01" },
      BETTER_AUTH_SECRET: "synthetic-secret",
      DATABASE_URL: "postgres://synthetic-private-url",
    } as unknown as AppEnv["Bindings"];
    const response = await app.request("/api/version", {}, env);

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Content-Type")).toContain("application/json");
    await expect(response.json()).resolves.toEqual({ worker: { versionId } });
    expect(makeAuth).not.toHaveBeenCalled();
    expect(withDatabase).not.toHaveBeenCalled();
  });

  it.each([undefined, {}, { CF_VERSION_METADATA: { id: "private-arbitrary-value" } }])("does not invent a version for unavailable metadata (%j)", async (env) => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const response = await createApp().request("/api/version", {}, env as AppEnv["Bindings"]);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ worker: { versionId: null } });
  });
});
