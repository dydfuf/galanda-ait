import { Context } from "effect";
import type { UserSession } from "../../src/core/domain/room.ts";

export interface RequestScope {
  readonly requestId: string;
  readonly session?: UserSession | null;
}

export class RequestScopeService extends Context.Service<
  RequestScopeService,
  RequestScope
>()("galanda/worker/http/RequestScope") {}
