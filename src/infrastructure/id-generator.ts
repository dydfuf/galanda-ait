import { Effect, Layer } from "effect";
import { IdGenerator } from "../core/ports/id-generator.ts";
import {
  InviteTokenSchema,
  ItineraryIdSchema,
  PlanIdSchema,
  TripIdSchema,
} from "../core/domain/ids.ts";

export const IdGeneratorLive: Layer.Layer<IdGenerator> = Layer.succeed(
  IdGenerator,
  IdGenerator.of({
    tripId: Effect.sync(() => TripIdSchema.make(crypto.randomUUID())),
    planId: Effect.sync(() => PlanIdSchema.make(crypto.randomUUID())),
    itineraryId: Effect.sync(() => ItineraryIdSchema.make(crypto.randomUUID())),
    inviteToken: Effect.sync(() => InviteTokenSchema.make(crypto.randomUUID())),
  })
);

export const createTestIdGenerator = (overrides?: {
  readonly tripId?: string;
  readonly planId?: string;
  readonly itineraryId?: string;
  readonly inviteToken?: string;
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
      itineraryId: Effect.succeed(
        ItineraryIdSchema.make(overrides?.itineraryId ?? "itinerary-test-001")
      ),
      inviteToken: Effect.succeed(
        InviteTokenSchema.make(
          overrides?.inviteToken ?? "00000000-0000-4000-8000-000000000001"
        )
      ),
    })
  );

export const IdGeneratorTest: Layer.Layer<IdGenerator> = createTestIdGenerator();
