import { Effect, Layer } from "effect";
import { IdGenerator } from "../core/ports/id-generator.ts";
import { PlanIdSchema, TripIdSchema } from "../core/domain/ids.ts";

export const IdGeneratorLive: Layer.Layer<IdGenerator> = Layer.succeed(
  IdGenerator,
  IdGenerator.of({
    tripId: Effect.sync(() => TripIdSchema.make(crypto.randomUUID())),
    planId: Effect.sync(() => PlanIdSchema.make(crypto.randomUUID())),
  })
);

export const createTestIdGenerator = (overrides?: {
  readonly tripId?: string;
  readonly planId?: string;
}): Layer.Layer<IdGenerator> =>
  Layer.succeed(
    IdGenerator,
    IdGenerator.of({
      tripId: Effect.succeed(
        TripIdSchema.make(overrides?.tripId ?? "trip-test-001")
      ),
      planId: Effect.succeed(
        PlanIdSchema.make(overrides?.planId ?? "plan-test-001")
      ),
    })
  );

export const IdGeneratorTest: Layer.Layer<IdGenerator> = createTestIdGenerator();
