import { Schema } from "effect";
import { RevisionSchema, TripIdSchema } from "../core/domain/ids.ts";
import { PlaceCardFieldsSchema, ResourceSourceSchema, TripResourceSchema } from "../core/domain/trip-resource.ts";

export { PLACE_CATEGORY_LABELS, RESOURCE_LIMIT, RESOURCE_NOTE_LIMIT } from "../core/domain/trip-resource.ts";
export const ResourceParamsSchema = Schema.Struct({
  tripId: TripIdSchema,
  resourceId: Schema.String.check(Schema.isUUID()),
});
export const CreateResourceRequestSchema = ResourceSourceSchema;
export type CreateResourceRequest = typeof CreateResourceRequestSchema.Type;
const ResourceRevisionSchema = RevisionSchema.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(1));
export const ResourceRevisionRequestSchema = Schema.Struct({ expectedRevision: ResourceRevisionSchema });
export const EditResourcePlaceRequestSchema = Schema.Struct({
  ...PlaceCardFieldsSchema.fields,
  expectedRevision: ResourceRevisionSchema,
  index: Schema.Number.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0), Schema.isLessThan(20)),
});
export type EditResourcePlaceRequest = typeof EditResourcePlaceRequestSchema.Type;
export const TripResourceResponseSchema = Schema.Struct({
  ...TripResourceSchema.fields,
  canManage: Schema.Boolean,
});
export type TripResourceResponse = typeof TripResourceResponseSchema.Type;
export const TripResourcesResponseSchema = Schema.Struct({
  items: Schema.Array(TripResourceResponseSchema),
  extractionAvailable: Schema.Boolean,
});
export type TripResourcesResponse = typeof TripResourcesResponseSchema.Type;
