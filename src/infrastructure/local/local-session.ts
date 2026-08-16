import { Effect, Layer } from "effect";
import { SessionService } from "../../core/ports/session.ts";
import { UserIdSchema } from "../../core/domain/ids.ts";
import type { UserSession } from "../../core/domain/room.ts";

const DEFAULT_LOCAL_USER: UserSession = {
  userId: UserIdSchema.make("user-local-me"),
  name: "나",
  isAuthenticated: true,
};

export const LocalSessionLayer = Layer.succeed(SessionService, {
  getCurrentSession: () => Effect.succeed(DEFAULT_LOCAL_USER),
});
