import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { makeBetterAuth, type BetterAuthEnv } from "./infrastructure/auth/better-auth.ts";
import {
  authSessionMiddleware,
  createAuthSessionMiddleware,
} from "./infrastructure/auth/session-middleware.ts";
import {
  createRequestDatabaseMiddleware,
  requestDatabaseMiddleware,
  type WithDatabase,
} from "./infrastructure/database/request-database.ts";
import type { DatabaseHandle } from "../src/infrastructure/persistence/drizzle/database.ts";
import type { UserSession } from "../src/core/domain/room.ts";
import { formatApiError } from "./http/api-error.ts";
import { healthRoute } from "./routes/health.ts";
import { tripsRoute } from "./routes/trips.ts";

export interface AppVariables {
  requestId: string;
  database?: DatabaseHandle;
  databaseError?: unknown;
  authSession?: UserSession | null;
  authSessionError?: unknown;
}

export interface AppEnv {
  Bindings: Env & BetterAuthEnv;
  Variables: AppVariables;
}

export interface AppDependencies {
  readonly makeAuth?: typeof makeBetterAuth;
  readonly withDatabase?: WithDatabase;
}

export function createApp(dependencies: AppDependencies = {}) {
  const app = new Hono<AppEnv>();
  const databaseMiddleware = dependencies.withDatabase
    ? createRequestDatabaseMiddleware(dependencies.withDatabase)
    : requestDatabaseMiddleware;
  const sessionMiddleware = dependencies.makeAuth
    ? createAuthSessionMiddleware(dependencies.makeAuth)
    : authSessionMiddleware;

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

  app.use("/api/*", databaseMiddleware);
  app.all("/api/auth/*", (c) => {
    if (!c.var.database) {
      throw c.var.databaseError ?? new Error("Database is unavailable");
    }
    return (dependencies.makeAuth ?? makeBetterAuth)(
      c.var.database,
      c.env as BetterAuthEnv
    ).handler(
      c.req.raw
    );
  });
  app.use("/api/*", sessionMiddleware);

  app.route("/api/health", healthRoute);
  app.route("/api/trips", tripsRoute);

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
