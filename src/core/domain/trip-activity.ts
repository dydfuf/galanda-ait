import { Data, Schema } from "effect";
import type {
  ParticipantId,
  PlanId,
  Revision,
  TripId,
} from "./ids.ts";

export const TripActivityTypeSchema = Schema.Literals([
  "PLAN_CREATED",
  "PLAN_UPDATED",
  "PLAN_DELETED",
  "OPINION_SUBMITTED",
  "OPINION_UPDATED",
  "PLAN_CONFIRMED",
  "ITINERARY_REVISED",
]);
export type TripActivityType = typeof TripActivityTypeSchema.Type;

export class InvalidActivityCursorError extends Data.TaggedError("InvalidActivityCursorError")<{
  readonly message: string;
  readonly tripId: TripId;
  readonly sequence: bigint;
}> {}

export type TripActivityEventDraft =
  | {
      readonly type: "PLAN_CREATED" | "PLAN_UPDATED" | "PLAN_DELETED";
      readonly subjectPlanId: PlanId;
      readonly subjectTitle: string;
      readonly roomRevision: number;
      readonly itineraryRevision: null;
    }
  | {
      readonly type: "OPINION_SUBMITTED" | "OPINION_UPDATED";
      readonly subjectPlanId: PlanId;
      readonly subjectTitle: string;
      readonly roomRevision: number;
      readonly itineraryRevision: null;
    }
  | {
      readonly type: "PLAN_CONFIRMED";
      readonly subjectPlanId: PlanId;
      readonly subjectTitle: string;
      readonly roomRevision: number;
      readonly itineraryRevision: number;
    }
  | {
      readonly type: "ITINERARY_REVISED";
      readonly subjectPlanId: PlanId | null;
      readonly subjectTitle: string | null;
      readonly roomRevision: number | null;
      readonly itineraryRevision: number;
    };

export interface TripActivityWrite {
  readonly actorParticipantId: ParticipantId;
  readonly actorDisplayName?: string;
  readonly event: TripActivityEventDraft;
}

export interface TripActivityEvent {
  readonly sequence: bigint;
  readonly tripId: TripId;
  readonly type: TripActivityType;
  readonly actorParticipantId: ParticipantId;
  readonly actorDisplayName?: string;
  readonly isOwn?: boolean;
  readonly subjectPlanId?: PlanId;
  readonly subjectTitle?: string;
  readonly roomRevision?: Revision;
  readonly itineraryRevision?: number;
  readonly createdAt: string;
}

export interface LatestUnreadActivitySummary {
  readonly type: TripActivityType;
  readonly actorDisplayName?: string;
  readonly subjectTitle?: string;
  readonly createdAt: string;
}

export interface TripActivitySummary {
  readonly tripId: TripId;
  readonly unreadCount: number;
  readonly latestUnreadSummary?: LatestUnreadActivitySummary;
  readonly lastSeenSequence?: bigint;
}

export interface TripActivityPage {
  readonly events: readonly TripActivityEvent[];
  readonly hasMore: boolean;
  readonly nextBeforeSequence?: bigint;
  readonly latestSequence?: bigint;
  readonly lastSeenSequence?: bigint;
  readonly unreadCount: number;
}
