import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { Context, Effect } from "effect";
import { runEffect } from "./effect-handler.ts";
import { RequestScopeService } from "./request-scope.ts";
import {
  ForbiddenError,
  NotFoundError,
  RepositoryError,
  RevisionConflictError,
  SessionUnavailableError,
  StateConflictError,
  UnauthorizedError,
  ValidationError,
} from "../../src/core/domain/errors.ts";
import type { AppEnv } from "../app.ts";

class MissingService extends Context.Service<
  MissingService,
  { readonly value: string }
>()("galanda/worker/test/MissingService") {}

describe("runEffect", () => {
  const createTestApp = () => {
    const app = new Hono<AppEnv>();
    app.use("*", async (c, next) => {
      c.set("requestId", "test-request-id-999");
      await next();
    });
    return app;
  };

  it("handles successful effects with default 200 JSON", async () => {
    const app = createTestApp();
    app.get("/success", (c) => runEffect(c, Effect.succeed({ data: "ok" })));
    app.get("/missing", (c) => {
      const effect = Effect.gen(function* () {
        return (yield* MissingService).value;
      });

      // @ts-expect-error runEffect only provides RequestScopeService
      return runEffect(c, effect);
    });

    const res = await app.fetch(new Request("https://example.com/success"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: string };
    expect(body).toEqual({ data: "ok" });
  });

  it("supports custom status codes and mapSuccess", async () => {
    const app = createTestApp();
    app.post("/created", (c) =>
      runEffect(c, Effect.succeed({ id: "123" }), { status: 201 })
    );
    app.get("/mapped", (c) =>
      runEffect(c, Effect.succeed("hello"), {
        mapSuccess: (val, ctx) => ctx.text(`greeting: ${val}`, 200),
      })
    );

    const res1 = await app.fetch(
      new Request("https://example.com/created", { method: "POST" })
    );
    expect(res1.status).toBe(201);
    expect(await res1.json()).toEqual({ id: "123" });

    const res2 = await app.fetch(new Request("https://example.com/mapped"));
    expect(res2.status).toBe(200);
    expect(await res2.text()).toBe("greeting: hello");
  });

  it("injects RequestScope into the effect runtime", async () => {
    const app = createTestApp();
    app.get("/scope", (c) =>
      runEffect(
        c,
        Effect.gen(function* () {
          const scope = yield* RequestScopeService;
          return {
            scopeRequestId: scope.requestId,
            httpMethod: scope.httpMethod,
            httpRoute: scope.httpRoute,
            hasSession: !!scope.session,
          };
        }),
        {
          session: {
            participantId: "user-1" as any,
            participantIds: ["user-1" as any],
            accountType: "REGISTERED",
            name: "Tester",
            isAuthenticated: true,
          },
        }
      )
    );

    const res = await app.fetch(new Request("https://example.com/scope"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      scopeRequestId: string;
      httpMethod: string;
      httpRoute: string;
      hasSession: boolean;
    };
    expect(body.scopeRequestId).toBe("test-request-id-999");
    expect(body.httpMethod).toBe("GET");
    expect(body.httpRoute).toBe("/scope");
    expect(body.hasSession).toBe(true);
  });

  it("maps UnauthorizedError to 401 UNAUTHORIZED", async () => {
    const app = createTestApp();
    app.get("/err", (c) =>
      runEffect(
        c,
        Effect.fail(new UnauthorizedError({ reason: "로그인이 필요합니다." }))
      )
    );

    const res = await app.fetch(new Request("https://example.com/err"));
    expect(res.status).toBe(401);
    const body = (await res.json()) as {
      error: { code: string; message: string; requestId: string };
    };
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(body.error.message).toBe("로그인이 필요합니다.");
    expect(body.error.requestId).toBe("test-request-id-999");
  });

  it("maps NotFoundError to 404 NOT_FOUND with safe details", async () => {
    const app = createTestApp();
    app.get("/err", (c) =>
      runEffect(
        c,
        Effect.fail(new NotFoundError({ entity: "TripRoom", id: "room-404" }))
      )
    );

    const res = await app.fetch(new Request("https://example.com/err"));
    expect(res.status).toBe(404);
    const body = (await res.json()) as {
      error: {
        code: string;
        message: string;
        requestId: string;
        details?: { entity: string; id: string };
      };
    };
    expect(body.error.code).toBe("NOT_FOUND");
    expect(body.error.message).toBe("요청한 리소스를 찾을 수 없습니다.");
    expect(body.error.details).toEqual({ entity: "TripRoom", id: "room-404" });
    expect(body.error.requestId).toBe("test-request-id-999");
  });

  it("maps RevisionConflictError to 409 REVISION_CONFLICT with revision details", async () => {
    const app = createTestApp();
    app.get("/err", (c) =>
      runEffect(
        c,
        Effect.fail(
          new RevisionConflictError({
            message: "버전이 충돌했습니다.",
            expectedRevision: 1,
            actualRevision: 2,
          })
        )
      )
    );

    const res = await app.fetch(new Request("https://example.com/err"));
    expect(res.status).toBe(409);
    const body = (await res.json()) as {
      error: {
        code: string;
        message: string;
        requestId: string;
        details?: { expectedRevision: number; actualRevision: number };
      };
    };
    expect(body.error.code).toBe("REVISION_CONFLICT");
    expect(body.error.message).toBe("버전이 충돌했습니다.");
    expect(body.error.details).toEqual({
      expectedRevision: 1,
      actualRevision: 2,
    });
  });

  it("keeps authorization and state conflicts distinct", async () => {
    const app = createTestApp();
    app.get("/forbidden", (c) =>
      runEffect(c, Effect.fail(new ForbiddenError({ reason: "권한이 없습니다." })))
    );
    app.get("/state-conflict", (c) =>
      runEffect(
        c,
        Effect.fail(new StateConflictError({ message: "이미 확정되었습니다." }))
      )
    );

    const forbidden = await app.fetch(new Request("https://example.com/forbidden"));
    const stateConflict = await app.fetch(
      new Request("https://example.com/state-conflict")
    );

    expect(forbidden.status).toBe(403);
    await expect(forbidden.json()).resolves.toMatchObject({
      error: { code: "FORBIDDEN" },
    });
    expect(stateConflict.status).toBe(409);
    await expect(stateConflict.json()).resolves.toMatchObject({
      error: { code: "STATE_CONFLICT" },
    });
  });

  it("maps ValidationError to 422 VALIDATION_FAILED", async () => {
    const app = createTestApp();
    app.get("/err", (c) =>
      runEffect(
        c,
        Effect.fail(new ValidationError({ message: "제목은 필수입니다." }))
      )
    );

    const res = await app.fetch(new Request("https://example.com/err"));
    expect(res.status).toBe(422);
    const body = (await res.json()) as {
      error: { code: string; message: string; requestId: string };
    };
    expect(body.error.code).toBe("VALIDATION_FAILED");
    expect(body.error.message).toBe("제목은 필수입니다.");
  });

  it("maps SessionUnavailableError to 503 AUTH_SERVICE_UNAVAILABLE", async () => {
    const app = createTestApp();
    app.get("/err", (c) =>
      runEffect(
        c,
        Effect.fail(
          new SessionUnavailableError({ reason: "Auth provider down" })
        )
      )
    );

    const res = await app.fetch(new Request("https://example.com/err"));
    expect(res.status).toBe(503);
    const body = (await res.json()) as {
      error: { code: string; message: string; requestId: string };
    };
    expect(body.error.code).toBe("AUTH_SERVICE_UNAVAILABLE");
    expect(body.error.message).toBe("인증 서비스를 일시적으로 사용할 수 없습니다.");
  });

  it("maps RepositoryError to 503 SERVICE_UNAVAILABLE without leaking internal SQL/DB details", async () => {
    const app = createTestApp();
    app.get("/err", (c) =>
      runEffect(
        c,
        Effect.fail(
          new RepositoryError({
            operation: "SELECT * FROM secrets",
            message: "psql: connection refused to internal-db.private:5432",
          })
        )
      )
    );

    const res = await app.fetch(new Request("https://example.com/err"));
    expect(res.status).toBe(503);
    const body = (await res.json()) as {
      error: { code: string; message: string; requestId: string; details?: unknown };
    };
    expect(body.error.code).toBe("SERVICE_UNAVAILABLE");
    expect(body.error.message).toBe("데이터베이스 서비스를 일시적으로 사용할 수 없습니다.");
    // Ensure no sensitive detail is exposed
    expect(body.error.details).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain("secrets");
    expect(JSON.stringify(body)).not.toContain("internal-db.private");
  });

  it("maps unexpected defects to 500 INTERNAL_SERVER_ERROR without leaking defect message or stack", async () => {
    const app = createTestApp();
    app.get("/defect", (c) =>
      runEffect(
        c,
        Effect.die(new Error("critical internal failure: file /etc/passwd error"))
      )
    );

    const res = await app.fetch(new Request("https://example.com/defect"));
    expect(res.status).toBe(500);
    const body = (await res.json()) as {
      error: { code: string; message: string; requestId: string; details?: unknown };
    };
    expect(body.error.code).toBe("INTERNAL_SERVER_ERROR");
    expect(body.error.message).toBe("서버 내부 오류가 발생했습니다.");
    expect(body.error.requestId).toBe("test-request-id-999");
    expect(body.error.details).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain("/etc/passwd");
    expect(JSON.stringify(body)).not.toContain("critical internal failure");
  });
});
