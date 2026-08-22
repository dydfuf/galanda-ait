import { Effect, Layer } from "effect";
import { SessionService, type SessionLookupError } from "../../../core/ports/session.ts";
import { UserIdSchema } from "../../../core/domain/ids.ts";
import {
  SessionUnavailableError,
  UnauthorizedError,
} from "../../../core/domain/errors.ts";
import type { UserSession } from "../../../core/domain/room.ts";

export interface BetterAuthSession {
  readonly user: {
    readonly id: string;
    readonly name?: string | null;
    readonly email?: string | null;
  };
}

export const normalizeBetterAuthSession = (
  session: BetterAuthSession
): UserSession => ({
  userId: UserIdSchema.make(session.user.id),
  name: session.user.name ?? session.user.email ?? "사용자",
  isAuthenticated: true,
});

const sessionLookup = (
  session: UserSession | null,
  lookupError?: unknown
): Effect.Effect<UserSession, SessionLookupError> => {
  if (lookupError !== undefined) {
    return Effect.fail(
      new SessionUnavailableError({
        reason:
          lookupError instanceof Error
            ? `로그인 정보를 확인하지 못했습니다: ${lookupError.message}`
            : "로그인 정보를 확인하지 못했습니다.",
      })
    );
  }

  return session
    ? Effect.succeed(session)
    : Effect.fail(new UnauthorizedError({ reason: "로그인이 필요합니다." }));
};

export const SessionServiceLiveFromUserSession = (
  session: UserSession | null,
  lookupError?: unknown
): Layer.Layer<SessionService> =>
  Layer.succeed(SessionService, {
    getCurrentSession: () => sessionLookup(session, lookupError),
    getCurrentUser: () => sessionLookup(session, lookupError),
  });

/** Request-scoped adapter: the Hono middleware resolves Better Auth once. */
export const SessionServiceLive = (
  session: BetterAuthSession | null,
  lookupError?: unknown
): Layer.Layer<SessionService> =>
  SessionServiceLiveFromUserSession(
    session ? normalizeBetterAuthSession(session) : null,
    lookupError
  );
