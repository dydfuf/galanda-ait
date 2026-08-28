import { afterEach, describe, expect, it, vi } from "vitest";

import worker from "./index.ts";

afterEach(() => {
  vi.restoreAllMocks();
});

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

  it("replaces unsafe upstream request IDs", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    for (const unsafeId of [
      "user@example.com",
      "request id with spaces",
      "x".repeat(129),
    ]) {
      const response = await worker.fetch(
        new Request("https://galanda.app/api/health", {
          headers: { "x-request-id": unsafeId },
        })
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("x-request-id")).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
      );
      expect(response.headers.get("x-request-id")).not.toBe(unsafeId);
    }
  });

  it("logs a structured API completion event with a route template", async () => {
    const requestId = "request-log-1";
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const token = "private-invite-token";
    const response = await worker.fetch(
      new Request(`https://galanda.app/api/invites/${token}`, {
        headers: { "x-request-id": requestId },
      })
    );

    expect(response.status).toBe(503);
    expect(log).toHaveBeenCalledOnce();
    const record = JSON.parse(String(log.mock.calls[0]?.[0])) as {
      event: string;
      requestId: string;
      method: string;
      route: string;
      status: number;
      durationMs: number;
    };
    expect(record).toMatchObject({
      event: "http_request_completed",
      requestId,
      method: "GET",
      route: "/api/invites/:inviteToken",
      status: 503,
    });
    expect(record.durationMs).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(record)).not.toContain(token);
  });

  it("uses the same completion log shape for expected HTTP errors", async () => {
    const log = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const response = await worker.fetch(
      new Request("https://galanda.app/api/missing", {
        headers: { "x-request-id": "request-log-404" },
      })
    );

    expect(response.status).toBe(404);
    const record = JSON.parse(String(log.mock.calls[0]?.[0])) as {
      event: string;
      requestId: string;
      method: string;
      route: string;
      status: number;
      durationMs: number;
    };
    expect(record).toMatchObject({
      event: "http_request_completed",
      requestId: "request-log-404",
      method: "GET",
      status: 404,
    });
    expect(record.route).not.toContain("missing");
  });

  it("does not fail the request when structured logging fails", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {
      throw new Error("log sink unavailable");
    });

    const response = await worker.fetch(
      new Request("https://galanda.app/api/health")
    );

    expect(response.status).toBe(200);
    expect(log).toHaveBeenCalledOnce();
  });
});
