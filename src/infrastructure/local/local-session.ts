import { Effect, Layer } from "effect";
import { SessionService } from "../../core/ports/session.ts";
import { UserIdSchema } from "../../core/domain/ids.ts";
import { UnauthorizedError } from "../../core/domain/errors.ts";
import type { UserSession } from "../../core/domain/room.ts";

export const DEFAULT_LOCAL_USER: UserSession = {
  userId: UserIdSchema.make("user-local-me"),
  name: "나",
  isAuthenticated: true,
};

export const makeLocalSessionService = (
  session: UserSession = DEFAULT_LOCAL_USER
): {
  readonly getCurrentSession: () => Effect.Effect<UserSession, never>;
  readonly getCurrentUser: () => Effect.Effect<UserSession, UnauthorizedError>;
} => ({
  getCurrentSession: (): Effect.Effect<UserSession, never> =>
    Effect.succeed(session),
  getCurrentUser: (): Effect.Effect<UserSession, UnauthorizedError> =>
    session.isAuthenticated
      ? Effect.succeed(session)
      : Effect.fail(new UnauthorizedError({ reason: "로그인이 필요합니다." })),
});

export const createLocalSessionLayer = (
  session: UserSession = DEFAULT_LOCAL_USER
): Layer.Layer<SessionService> =>
  Layer.succeed(SessionService, makeLocalSessionService(session));

export const LocalSessionLayer: Layer.Layer<SessionService> = createLocalSessionLayer();

