import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { BetterAuthEnv } from "./infrastructure/auth/better-auth.ts";
import { withBetterAuth } from "./infrastructure/auth/better-auth.ts";
import { authSessionMiddleware } from "./infrastructure/auth/session-middleware.ts";
import type { BetterAuthSession } from "../src/infrastructure/auth/better-auth/session.ts";
import { formatApiError } from "./http/api-error.ts";
import { healthRoute } from "./routes/health.ts";

export interface AppVariables {
  requestId: string;
  authSession?: BetterAuthSession | null;
  authSessionError?: unknown;
}

export interface AppEnv {
  Bindings: Env & BetterAuthEnv;
  Variables: AppVariables;
}

export function createApp() {
  const app = new Hono<AppEnv>();

  app.use("*", async (c, next) => {
    const upstreamId =
      c.req.header("x-request-id") ||
      c.req.header("cf-ray") ||
      c.req.header("x-correlation-id");
    const requestId =
      upstreamId && upstreamId.trim().length > 0
        ? upstreamId.trim()
        : crypto.randomUUID();

    c.set("requestId", requestId);
    c.header("x-request-id", requestId);
    await next();
    c.header("x-request-id", requestId);
  });

  app.all("/api/auth/*", (c) =>
    withBetterAuth(c.env, (auth) => auth.handler(c.req.raw))
  );
  app.use("/api/*", authSessionMiddleware);

  app.route("/api/health", healthRoute);

  app.notFound((c) => {
    const requestId = c.var.requestId ?? crypto.randomUUID();
    return c.json(
      formatApiError({
        code: "NOT_FOUND",
        message: "요청한 엔드포인트를 찾을 수 없습니다.",
        requestId,
      }),
      404
    );
  });

  app.onError((err, c) => {
    const requestId = c.var.requestId ?? crypto.randomUUID();
    if (err instanceof HTTPException && err.status === 400) {
      return c.json(
        formatApiError({
          code: "INVALID_REQUEST",
          message: "요청 형식이 올바르지 않습니다.",
          requestId,
        }),
        400
      );
    }

    console.error(`[UnhandledError] requestId=${requestId}:`, err);
    return c.json(
      formatApiError({
        code: "INTERNAL_SERVER_ERROR",
        message: "서버 내부 오류가 발생했습니다.",
        requestId,
      }),
      500
    );
  });

  return app;
}

export const app = createApp();
