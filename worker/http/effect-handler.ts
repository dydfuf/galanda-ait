import type { Context as HonoContext } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { Effect, Exit } from "effect";
import type { Context, Layer } from "effect";
import type { AppEnv } from "../app.ts";
import { type RequestScope, RequestScopeService } from "./request-scope.ts";
import { mapErrorToResponse } from "./api-error.ts";
import type { UserSession } from "../../src/core/domain/room.ts";

export interface RunEffectOptions<A, R = never> {
  readonly status?: ContentfulStatusCode;
  readonly session?: UserSession | null;
  readonly context?: Context.Context<R>;
  readonly layer?: Layer.Layer<R, any, any>;
  readonly mapSuccess?: (
    value: A,
    c: HonoContext<AppEnv>
  ) => Response | Promise<Response>;
}

export async function runEffect<A, E, R = never>(
  c: HonoContext<AppEnv>,
  effect: Effect.Effect<A, E, R>,
  options?: RunEffectOptions<A, R>
): Promise<Response> {
  const requestId = c.var.requestId ?? crypto.randomUUID();
  const requestScope: RequestScope = {
    requestId,
    session: options?.session,
  };

  let program: Effect.Effect<A, E, any> = effect.pipe(
    Effect.provideService(RequestScopeService, requestScope)
  );

  if (options?.context) {
    program = program.pipe(Effect.provide(options.context));
  }
  if (options?.layer) {
    program = program.pipe(Effect.provide(options.layer));
  }

  const exit = await Effect.runPromiseExit(
    program as Effect.Effect<A, E, never>
  );

  if (Exit.isSuccess(exit)) {
    if (options?.mapSuccess) {
      return options.mapSuccess(exit.value, c);
    }
    const status = options?.status ?? 200;
    return c.json(exit.value, status);
  }

  return mapErrorToResponse(c, exit.cause, requestId);
}
