import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../../app.ts";
import { makeBetterAuth, type BetterAuthEnv } from "./better-auth.ts";
import {
  normalizeBetterAuthSession,
  type BetterAuthSession,
} from "../../../src/infrastructure/auth/better-auth/session.ts";
import { ensureParticipantIdentity } from "../../../src/infrastructure/auth/better-auth/participant-identity.ts";

export type ResolveParticipantIdentity = typeof ensureParticipantIdentity;

export const createAuthSessionMiddleware = (
  createAuth: typeof makeBetterAuth = makeBetterAuth,
  resolveParticipantIdentity: ResolveParticipantIdentity =
    ensureParticipantIdentity
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
        session
          ? normalizeBetterAuthSession(
              session as BetterAuthSession,
              await resolveParticipantIdentity(c.var.database, session.user.id)
            )
          : null
      );
    } catch (error) {
      c.set("authSession", null);
      c.set("authSessionError", error);
    }

    await next();
  });

export const authSessionMiddleware = createAuthSessionMiddleware();
