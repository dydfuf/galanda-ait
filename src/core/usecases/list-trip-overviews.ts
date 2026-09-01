import { Effect } from "effect";
import type { TripOverviewDto, TripOverviewListResponse } from "../../contracts/trip-overview.ts";
import type { TripActivitySummaryDto } from "../../contracts/trip-activity.ts";
import type { TripActivitySummary } from "../domain/trip-activity.ts";
import { TripRoomRepository, type TripOverviewSourceRecord } from "../ports/trip-room-repository.ts";
import { TripActivityRepository } from "../ports/trip-activity-repository.ts";
import { requireAuthSession } from "../ports/session.ts";
import { mergeParticipantIdentityInRoom } from "../domain/room-transitions.ts";
import { getRoomActor, isRoomConfirmed } from "../domain/auth-guards.ts";
import { toTripRoomDecisionContext } from "../domain/trip-decision.ts";
import { resolveEligibleTripActions } from "../domain/trip-action-resolver.ts";
import { getConfirmedPlan } from "../domain/room.ts";
import type { ParticipantId } from "../domain/ids.ts";

export const toTripOverviewDto = (
  record: TripOverviewSourceRecord,
  sessionParticipantIds: ReadonlyArray<ParticipantId>,
  activitySummary?: TripActivitySummary | null
): TripOverviewDto => {
  const { room, roomCreatedAt, roomUpdatedAt, currentItinerary } = record;
  const isConfirmed = isRoomConfirmed(room);
  const confirmed = getConfirmedPlan(room);

  // Authoritative confirmed period resolution
  let confirmedPeriod: { startDate: string; endDate: string } | null = null;
  if (isConfirmed) {
    if (
      currentItinerary?.snapshot.routes &&
      currentItinerary.snapshot.routes.length > 0
    ) {
      const routes = currentItinerary.snapshot.routes;
      const start = routes[0]?.arrivalDate;
      const end = routes[routes.length - 1]?.departureDate;
      if (start && end && start <= end) {
        confirmedPeriod = { startDate: start, endDate: end };
      }
    } else if (confirmed?.routes && confirmed.routes.length > 0) {
      const routes = confirmed.routes;
      const start = routes[0]?.arrivalDate;
      const end = routes[routes.length - 1]?.departureDate;
      if (start && end && start <= end) {
        confirmedPeriod = { startDate: start, endDate: end };
      }
    }
  }

  // Authoritative effective updatedAt: GREATEST(roomUpdatedAt, currentItinerary?.changedAt, currentItinerary?.createdAt)
  let effectiveUpdatedAt = roomUpdatedAt;
  const itineraryUpdatedAt =
    currentItinerary?.changedAt ?? currentItinerary?.createdAt;
  if (itineraryUpdatedAt && itineraryUpdatedAt > effectiveUpdatedAt) {
    effectiveUpdatedAt = itineraryUpdatedAt;
  }

  // Opinion participant count (unique participant IDs) & unattributed check
  const opinionParticipantIds = new Set<string>();
  let hasUnattributedOpinions = false;
  for (const plan of room.plans) {
    if (plan.memberOpinions === undefined && plan.voteCount > 0) {
      hasUnattributedOpinions = true;
    }
    for (const opinion of plan.memberOpinions ?? []) {
      opinionParticipantIds.add(opinion.userId);
    }
  }

  // Eligible actions
  const actor = getRoomActor(room, sessionParticipantIds);
  const decisionContext = toTripRoomDecisionContext(room, actor);
  const eligibleActions = resolveEligibleTripActions(decisionContext, actor);
  const eligibleActionIds = eligibleActions.map((a) => a.actionId);

  const summaryDto: TripActivitySummaryDto | null = activitySummary
    ? {
        tripId: activitySummary.tripId,
        unreadCount: activitySummary.unreadCount,
        latestUnreadSummary: activitySummary.latestUnreadSummary
          ? {
              type: activitySummary.latestUnreadSummary.type,
              actorDisplayName:
                activitySummary.latestUnreadSummary.actorDisplayName ?? null,
              subjectTitle:
                activitySummary.latestUnreadSummary.subjectTitle ?? null,
              createdAt: activitySummary.latestUnreadSummary.createdAt,
            }
          : null,
        lastSeenSequence:
          activitySummary.lastSeenSequence !== undefined
            ? activitySummary.lastSeenSequence.toString()
            : null,
      }
    : null;

  return {
    id: room.id,
    title: room.title,
    destination: room.destination,
    revision: room.revision,
    isConfirmed,
    confirmedPeriod,
    memberCount: room.members.length,
    memberNames: room.members.map((m) => m.name),
    candidateCount: room.plans.length,
    opinionParticipantCount: opinionParticipantIds.size,
    hasUnattributedOpinions,
    createdAt: roomCreatedAt,
    updatedAt: effectiveUpdatedAt,
    eligibleActionIds,
    activitySummary: summaryDto,
  };
};

export const listTripOverviews = Effect.fn("listTripOverviews")(function* () {
  const session = yield* requireAuthSession();
  const repo = yield* TripRoomRepository;
  const records = yield* repo.getRoomOverviewRecords(session.participantIds);

  const activityRepo = yield* TripActivityRepository;
  const roomIds = records.map((r) => r.room.id);
  const summaries = yield* activityRepo.getSummariesForTrips({
    tripIds: roomIds,
    actorParticipantIds: session.participantIds,
  });

  const items = records.map((record) => {
    const mergedRoom = mergeParticipantIdentityInRoom(
      record.room,
      session.participantId,
      session.participantIds
    );
    const summary = summaries.get(record.room.id) ?? null;
    return toTripOverviewDto(
      { ...record, room: mergedRoom },
      session.participantIds,
      summary
    );
  });

  // Default list sort: updatedAt DESC, createdAt DESC, id ASC
  items.sort((a, b) => {
    if (b.updatedAt !== a.updatedAt) return b.updatedAt.localeCompare(a.updatedAt);
    if (b.createdAt !== a.createdAt) return b.createdAt.localeCompare(a.createdAt);
    return a.id.localeCompare(b.id);
  });

  return { items } satisfies TripOverviewListResponse;
});
