import { describe, expect, it } from "vitest";

import worker from "./index.ts";

describe("Worker API", () => {
  it("serves health without falling through to the SPA", async () => {
    const response = await worker.fetch(
      new Request("https://galanda.app/api/health")
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(response.headers.get("x-request-id")).toBeDefined();
  });

  it("does not fall through unknown API routes to the SPA", async () => {
    const response = await worker.fetch(
      new Request("https://galanda.app/api/missing")
    );

    expect(response.status).toBe(404);
    const body = (await response.json()) as {
      error: { code: string; message: string; requestId: string };
    };
    expect(body.error.code).toBe("NOT_FOUND");
    expect(body.error.requestId).toBeDefined();
    expect(response.headers.get("x-request-id")).toBe(body.error.requestId);
  });

  it("preserves upstream request ID if provided", async () => {
    const upstreamId = "test-upstream-request-id-123";
    const response = await worker.fetch(
      new Request("https://galanda.app/api/health", {
        headers: { "x-request-id": upstreamId },
      })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toBe(upstreamId);
  });
});
