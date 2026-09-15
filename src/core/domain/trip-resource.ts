import { Schema } from "effect";
import { ParticipantIdSchema, RevisionSchema, TripIdSchema } from "./ids.ts";

export const RESOURCE_LIMIT = 200;
export const RESOURCE_NOTE_LIMIT = 20_000;
export const RESOURCE_PLACE_LIMIT = 20;

export const PlaceCategorySchema = Schema.Literals(["STAY", "FOOD", "SIGHT", "ACTIVITY", "OTHER"]);
export const PLACE_CATEGORY_LABELS: Record<typeof PlaceCategorySchema.Type, string> = {
  STAY: "숙소", FOOD: "맛집", SIGHT: "관광", ACTIVITY: "액티비티", OTHER: "기타",
};
export const ResourceText = (max: number) => Schema.String.check(Schema.isMaxLength(max));
export const PlaceNameSchema = ResourceText(120).check(
  Schema.makeFilter((text) => Boolean(text.trim()), { message: "장소명을 입력해주세요." }),
);
export const PlaceCardFieldsSchema = Schema.Struct({
  name: PlaceNameSchema,
  category: PlaceCategorySchema,
  location: ResourceText(200),
  summary: ResourceText(700),
});
export const ExtractedPlaceSchema = Schema.Struct({
  ...PlaceCardFieldsSchema.fields,
  evidence: Schema.Struct({
    source: Schema.Literals(["LINK", "NOTE"]),
    text: ResourceText(500).check(Schema.isMinLength(1)),
  }),
});
export type ExtractedPlace = typeof ExtractedPlaceSchema.Type;
export const PlaceCardSchema = Schema.Struct({
  ...ExtractedPlaceSchema.fields,
  edited: Schema.Boolean,
});
export type PlaceCard = typeof PlaceCardSchema.Type;

export const ResourceSourceSchema = Schema.Struct({
  url: ResourceText(2048).check(Schema.makeFilter((value) => {
    if (!value) return true;
    try {
      const url = new URL(value);
      return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password;
    } catch { return false; }
  }, { message: "http 또는 https 링크를 입력해주세요." })),
  note: ResourceText(RESOURCE_NOTE_LIMIT),
}).check(Schema.makeFilter(
  ({ url, note }) => Boolean(url.trim() || note.trim()),
  { message: "링크나 메모를 입력해주세요." },
));
export type ResourceSource = typeof ResourceSourceSchema.Type;

export const TripResourceSchema = Schema.Struct({
  id: Schema.String.check(Schema.isUUID()),
  tripId: TripIdSchema,
  createdBy: ParticipantIdSchema,
  createdByName: Schema.String,
  createdAt: Schema.String,
  updatedAt: Schema.String,
  revision: RevisionSchema,
  url: Schema.String,
  note: Schema.String,
  places: Schema.NullOr(Schema.Array(PlaceCardSchema).check(Schema.isMaxLength(RESOURCE_PLACE_LIMIT))),
  processedAt: Schema.NullOr(Schema.String),
  linkStatus: Schema.Literals(["NOT_READ", "READ", "UNAVAILABLE"]),
});
export type TripResource = typeof TripResourceSchema.Type;

export class ResourceExtractionError extends Schema.TaggedError<ResourceExtractionError>()(
  "ResourceExtractionError", {
    reason: Schema.Literals(["UNAVAILABLE", "SOURCE_UNREADABLE", "INVALID_OUTPUT"]),
  },
) {}
