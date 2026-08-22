import { describe, expect, it } from "vitest";

import worker from "./index.ts";

describe("Worker API", () => {
  it("serves health without falling through to the SPA", async () => {
    const response = worker.fetch(new Request("https://galanda.app/api/health"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });
});
