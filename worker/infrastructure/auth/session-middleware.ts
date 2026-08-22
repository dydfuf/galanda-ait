import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../../app.ts";
import {
  withBetterAuth,
  type BetterAuthEnv,
} from "./better-auth.ts";
import type { BetterAuthSession } from "../../../src/infrastructure/auth/better-auth/session.ts";

export const authSessionMiddleware = createMiddleware<AppEnv>(
  async (c, next) => {
    if (
      c.req.path === "/api/health" ||
      c.req.path === "/api/auth" ||
      c.req.path.startsWith("/api/auth/")
    ) {
      await next();
      return;
    }

    try {
      const session = await withBetterAuth(
        c.env as BetterAuthEnv,
        (auth) => auth.api.getSession({ headers: c.req.raw.headers })
      );
      c.set("authSession", session as BetterAuthSession | null);
    } catch (error) {
      c.set("authSession", null);
      c.set("authSessionError", error);
    }

    await next();
  }
);
