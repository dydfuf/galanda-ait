import { Context, Effect } from "effect";
import type { UserSession } from "../domain/room.ts";
import type { UnauthorizedError } from "../domain/errors.ts";

export class SessionService extends Context.Service<
  SessionService,
  {
    readonly getCurrentSession: () => Effect.Effect<UserSession, UnauthorizedError>;
  }
>()("galanda/ports/SessionService") {}
