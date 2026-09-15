import { Context } from "effect";
import type { ParticipantId, Revision, TripId } from "../domain/ids.ts";
import type { NotFoundError, RevisionConflictError, ValidationError } from "../domain/errors.ts";
import type { PlaceCard, ResourceSource, TripResource } from "../domain/trip-resource.ts";
import type { RepositoryEffect } from "./repository.ts";

export interface ResourceResult {
  readonly places: ReadonlyArray<PlaceCard>;
  readonly processedAt: string;
  readonly linkStatus: TripResource["linkStatus"];
}
export class TripResourceRepository extends Context.Service<TripResourceRepository, {
  readonly list: (tripId: TripId) => RepositoryEffect<ReadonlyArray<TripResource>>;
  readonly get: (tripId: TripId, id: string) => RepositoryEffect<TripResource, NotFoundError>;
  readonly create: (input: ResourceSource & {
    readonly tripId: TripId;
    readonly createdBy: ParticipantId;
    readonly createdByName: string;
  }) => RepositoryEffect<TripResource, NotFoundError | ValidationError>;
  readonly saveResult: (tripId: TripId, id: string, expectedRevision: Revision, result: ResourceResult) => RepositoryEffect<TripResource, NotFoundError | RevisionConflictError>;
  readonly remove: (tripId: TripId, id: string, expectedRevision: Revision) => RepositoryEffect<void, NotFoundError | RevisionConflictError>;
}>()("galanda/ports/TripResourceRepository") {}
