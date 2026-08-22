import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../../app.ts";
import { makeBetterAuth, type BetterAuthEnv } from "./better-auth.ts";
import {
  normalizeBetterAuthSession,
  type BetterAuthSession,
} from "../../../src/infrastructure/auth/better-auth/session.ts";

export const createAuthSessionMiddleware = (
  createAuth: typeof makeBetterAuth = makeBetterAuth
) =>
  createMiddleware<AppEnv>(async (c, next) => {
    if (
      c.req.path === "/api/health" ||
      c.req.path === "/api/auth" ||
      c.req.path.startsWith("/api/auth/")
    ) {
      await next();
      return;
    }

    if (!c.var.database) {
      c.set("authSession", null);
      c.set("authSessionError", c.var.databaseError);
      await next();
      return;
    }

    try {
      const session = await createAuth(
        c.var.database,
        c.env as BetterAuthEnv
      ).api.getSession({ headers: c.req.raw.headers });
      c.set(
        "authSession",
        session ? normalizeBetterAuthSession(session as BetterAuthSession) : null
      );
    } catch (error) {
      c.set("authSession", null);
      c.set("authSessionError", error);
    }

    await next();
  });

export const authSessionMiddleware = createAuthSessionMiddleware();
