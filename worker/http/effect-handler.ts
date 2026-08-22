import type { Context as HonoContext } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { Effect, Exit } from "effect";
import type { AppEnv } from "../app.ts";
import { type RequestScope, RequestScopeService } from "./request-scope.ts";
import { mapErrorToResponse } from "./api-error.ts";
import type { UserSession } from "../../src/core/domain/room.ts";

export interface RunEffectOptions<A> {
  readonly status?: ContentfulStatusCode;
  readonly session?: UserSession | null;
  readonly mapSuccess?: (
    value: A,
    c: HonoContext<AppEnv>
  ) => Response | Promise<Response>;
}

export async function runEffect<A, E>(
  c: HonoContext<AppEnv>,
  effect: Effect.Effect<A, E, RequestScopeService>,
  options?: RunEffectOptions<A>
): Promise<Response> {
  const requestId = c.var.requestId ?? crypto.randomUUID();
  const requestScope: RequestScope = {
    requestId,
    session: options?.session,
  };

  const program = effect.pipe(
    Effect.provideService(RequestScopeService, requestScope)
  );

  const exit = await Effect.runPromiseExit(program);

  if (Exit.isSuccess(exit)) {
    if (options?.mapSuccess) {
      return options.mapSuccess(exit.value, c);
    }
    const status = options?.status ?? 200;
    return c.json(exit.value, status);
  }

  return mapErrorToResponse(c, exit.cause, requestId);
}
