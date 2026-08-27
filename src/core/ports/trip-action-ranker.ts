import { Context, Schema, type Effect } from "effect";
import type { TripDecision } from "../domain/trip-decision.ts";
import type {
  RecommendationSurface,
  TripAction,
  TripActionRanking,
} from "../domain/trip-action.ts";

export const TripActionRankingFailureSchema = Schema.Literals([
  "TIMEOUT",
  "PROVIDER_ERROR",
  "INVALID_OUTPUT",
]);

export class TripActionRankingError extends Schema.TaggedError<TripActionRankingError>()(
  "TripActionRankingError",
  {
    reason: TripActionRankingFailureSchema,
    statusCode: Schema.optional(Schema.Number),
  }
) {}

export interface TripActionRankingInput {
  readonly surface: RecommendationSurface;
  readonly decisions: ReadonlyArray<TripDecision>;
  readonly eligibleActions: ReadonlyArray<TripAction>;
}

export interface TripActionRankerService {
  readonly policyVersion: string;
  readonly rank: (
    input: TripActionRankingInput
  ) => Effect.Effect<TripActionRanking, TripActionRankingError>;
}

export class TripActionRanker extends Context.Service<
  TripActionRanker,
  TripActionRankerService
>()("galanda/ports/TripActionRanker") {}
