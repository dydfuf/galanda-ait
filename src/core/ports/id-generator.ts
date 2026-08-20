import { Context, type Effect } from "effect";
import type { PlanId, TripId } from "../domain/ids.ts";

export interface IdGeneratorService {
  readonly tripId: Effect.Effect<TripId>;
  readonly planId: Effect.Effect<PlanId>;
}

export class IdGenerator extends Context.Service<
  IdGenerator,
  IdGeneratorService
>()("galanda/ports/IdGenerator") {}
