import { Context, type Effect } from "effect";
import type {
  ExploreListingId,
  InviteToken,
  ItineraryId,
  PlanId,
  RecommendationId,
  TripId,
} from "../domain/ids.ts";

export interface IdGeneratorService {
  readonly tripId: Effect.Effect<TripId>;
  readonly planId: Effect.Effect<PlanId>;
  readonly itineraryId: Effect.Effect<ItineraryId>;
  readonly recommendationId: Effect.Effect<RecommendationId>;
  readonly inviteToken: Effect.Effect<InviteToken>;
  readonly exploreListingId: Effect.Effect<ExploreListingId>;
}

export class IdGenerator extends Context.Service<
  IdGenerator,
  IdGeneratorService
>()("galanda/ports/IdGenerator") {}
