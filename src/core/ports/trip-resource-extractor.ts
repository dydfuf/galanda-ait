import { Context, type Effect } from "effect";
import type { ExtractedPlace, ResourceExtractionError, ResourceSource } from "../domain/trip-resource.ts";

export class TripResourceExtractor extends Context.Service<TripResourceExtractor, {
  readonly available: boolean;
  readonly extract: (source: ResourceSource) => Effect.Effect<{
    readonly places: ReadonlyArray<ExtractedPlace>;
    readonly linkStatus: "NOT_READ" | "READ" | "UNAVAILABLE";
  }, ResourceExtractionError>;
}>()("galanda/ports/TripResourceExtractor") {}
