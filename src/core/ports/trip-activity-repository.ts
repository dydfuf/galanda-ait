import { Context, type Effect } from "effect";
import type { ParticipantId, TripId } from "../domain/ids.ts";
import type { RepositoryError } from "../domain/errors.ts";
import type {
  InvalidActivityCursorError,
  TripActivityPage,
  TripActivitySummary,
} from "../domain/trip-activity.ts";

export class TripActivityRepository extends Context.Service<
  TripActivityRepository,
  {
    readonly listForTrip: (input: {
      readonly tripId: TripId;
      readonly actorParticipantIds: readonly ParticipantId[];
      readonly beforeSequence?: bigint;
      readonly limit: number;
    }) => Effect.Effect<TripActivityPage, RepositoryError>;

    readonly getSummariesForTrips: (input: {
      readonly tripIds: readonly TripId[];
      readonly actorParticipantIds: readonly ParticipantId[];
    }) => Effect.Effect<ReadonlyMap<TripId, TripActivitySummary>, RepositoryError>;

    readonly markRead: (input: {
      readonly tripId: TripId;
      readonly canonicalParticipantId: ParticipantId;
      readonly actorParticipantIds: readonly ParticipantId[];
      readonly throughSequence: bigint;
    }) => Effect.Effect<TripActivitySummary, RepositoryError | InvalidActivityCursorError>;

    readonly initializeMemberCursor: (input: {
      readonly tripId: TripId;
      readonly participantId: ParticipantId;
    }) => Effect.Effect<void, RepositoryError>;
  }
>()("galanda/ports/TripActivityRepository") {}
