import { Schema, type Result } from "effect";
import {
  TripIdSchema,
  PlanIdSchema,
  InviteTokenSchema,
  ExploreListingIdSchema,
} from "../../core/domain/ids.ts";

export const TripParamsSchema = Schema.Struct({
  tripId: TripIdSchema,
});
export type TripParams = typeof TripParamsSchema.Type;

export const PlanParamsSchema = Schema.Struct({
  tripId: TripIdSchema,
  planId: PlanIdSchema,
});
export type PlanParams = typeof PlanParamsSchema.Type;

export const InviteParamsSchema = Schema.Struct({
  inviteToken: InviteTokenSchema,
});
export type InviteParams = typeof InviteParamsSchema.Type;

export const ExploreListingParamsSchema = Schema.Struct({
  listingId: ExploreListingIdSchema,
});
export type ExploreListingParams = typeof ExploreListingParamsSchema.Type;

export const CompareQuerySchema = Schema.Struct({
  left: PlanIdSchema,
  right: PlanIdSchema,
});
export type CompareQueryParams = typeof CompareQuerySchema.Type;

export function decodeRouteParams<S extends Schema.ConstraintDecoder<unknown>>(
  schema: S,
  input: unknown
): Result.Result<S["Type"], Schema.SchemaError> {
  return Schema.decodeUnknownResult(schema)(input);
}
