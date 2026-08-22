import { Hono } from "hono";
import { formatApiError } from "./http/api-error.ts";
import { healthRoute } from "./routes/health.ts";

export interface AppVariables {
  requestId: string;
}

export interface AppEnv {
  Bindings: Env;
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
