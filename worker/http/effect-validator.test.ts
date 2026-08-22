import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { Schema } from "effect";
import { createApp } from "../app.ts";
import { effectValidator } from "./effect-validator.ts";
import type { AppEnv } from "../app.ts";

describe("effectValidator", () => {
  it("validates and parses valid JSON input", async () => {
    const TestSchema = Schema.Struct({
      name: Schema.String,
      age: Schema.Number,
    });

    const app = new Hono<AppEnv>();
    app.post("/test", effectValidator("json", TestSchema), (c) => {
      const data = c.req.valid("json");
      return c.json({ received: data });
    });

    const res = await app.fetch(
      new Request("https://example.com/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Alice", age: 30 }),
      })
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { received: { name: string; age: number } };
    expect(body.received).toEqual({ name: "Alice", age: 30 });
  });

  it("returns 400 INVALID_REQUEST without reflecting invalid input", async () => {
    const TestSchema = Schema.Struct({
      password: Schema.Number,
    });

    const app = createApp();
    app.post("/test", effectValidator("json", TestSchema), (c) => {
      const data = c.req.valid("json");
      return c.json({ received: data });
    });

    const res = await app.fetch(
      new Request("https://example.com/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-request-id": "req-val-1",
        },
        body: JSON.stringify({ password: "secret-value" }),
      })
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as {
      error: { code: string; message: string; requestId: string; details?: unknown };
    };
    expect(body.error.code).toBe("INVALID_REQUEST");
    expect(body.error.message).toBe("요청 형식이 올바르지 않습니다.");
    expect(body.error.requestId).toBe("req-val-1");
    expect(body.error.details).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain("secret-value");
  });

  it("returns 400 INVALID_REQUEST for malformed JSON", async () => {
    const app = createApp();
    app.post(
      "/test",
      effectValidator("json", Schema.Struct({ name: Schema.String })),
      (c) => c.json(c.req.valid("json"))
    );

    const res = await app.fetch(
      new Request("https://example.com/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-request-id": "req-malformed-1",
        },
        body: "{broken",
      })
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as {
      error: { code: string; message: string; requestId: string };
    };
    expect(body.error.code).toBe("INVALID_REQUEST");
    expect(body.error.requestId).toBe("req-malformed-1");
    expect(res.headers.get("x-request-id")).toBe(body.error.requestId);
  });

  it("validates and parses valid param input", async () => {
    const ParamSchema = Schema.Struct({
      id: Schema.String.check(Schema.isMinLength(3)),
    });

    const app = new Hono<AppEnv>();
    app.get("/items/:id", effectValidator("param", ParamSchema), (c) => {
      const param = c.req.valid("param");
      return c.json({ id: param.id });
    });

    const res = await app.fetch(new Request("https://example.com/items/abc"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string };
    expect(body.id).toBe("abc");
  });

  it("returns 400 INVALID_REQUEST on invalid param input", async () => {
    const ParamSchema = Schema.Struct({
      id: Schema.String.check(Schema.isMinLength(5)),
    });

    const app = new Hono<AppEnv>();
    app.get("/items/:id", effectValidator("param", ParamSchema), (c) => {
      const param = c.req.valid("param");
      return c.json({ id: param.id });
    });

    const res = await app.fetch(new Request("https://example.com/items/ab"));
    expect(res.status).toBe(400);
    const body = (await res.json()) as {
      error: { code: string; message: string; requestId: string };
    };
    expect(body.error.code).toBe("INVALID_REQUEST");
    expect(body.error.requestId).toBeDefined();
  });

  it("validates and parses valid query input", async () => {
    const QuerySchema = Schema.Struct({
      page: Schema.NumberFromString,
    });

    const app = new Hono<AppEnv>();
    app.get("/list", effectValidator("query", QuerySchema), (c) => {
      const query = c.req.valid("query");
      return c.json({ page: query.page });
    });

    const res = await app.fetch(new Request("https://example.com/list?page=2"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { page: number };
    expect(body.page).toBe(2);
  });
});
