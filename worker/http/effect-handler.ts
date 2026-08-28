import type { Context as HonoContext } from "hono";
import { routePath } from "hono/route";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { Effect, Exit, Logger } from "effect";
import type { AppEnv } from "../app.ts";
import { type RequestScope, RequestScopeService } from "./request-scope.ts";
import { mapErrorToResponse } from "./api-error.ts";
import type { UserSession } from "../../src/core/domain/room.ts";
import type { SessionService } from "../../src/core/ports/session.ts";
import { SessionServiceLiveFromUserSession } from "../../src/infrastructure/auth/better-auth/session.ts";

export interface RunEffectOptions<A> {
  readonly status?: ContentfulStatusCode;
  readonly session?: UserSession | null;
  readonly sessionError?: unknown;
  readonly mapSuccess?: (
    value: A,
    c: HonoContext<AppEnv>
  ) => Response | Promise<Response>;
}

export async function runEffect<A, E>(
  c: HonoContext<AppEnv>,
  effect: Effect.Effect<A, E, RequestScopeService | SessionService>,
  options?: RunEffectOptions<A>
): Promise<Response> {
  const requestId = c.var.requestId ?? crypto.randomUUID();
  const httpMethod = c.req.method;
  const httpRoute = routePath(c, -1);
  const requestScope: RequestScope = {
    requestId,
    httpMethod,
    httpRoute,
    session: options?.session ?? c.var.authSession,
  };

  const program = effect.pipe(
    Effect.annotateLogs({ requestId, httpMethod, httpRoute }),
    Effect.provideService(RequestScopeService, requestScope),
    Effect.provide(
      SessionServiceLiveFromUserSession(
        options?.session ?? c.var.authSession ?? null,
        options?.sessionError ?? c.var.authSessionError
      )
    ),
    Effect.provide(Logger.layer([Logger.consoleStructured]))
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
