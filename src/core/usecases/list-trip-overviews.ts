import { Effect } from "effect";
import type { TripOverviewDto, TripOverviewListResponse } from "../../contracts/trip-overview.ts";
import { TripRoomRepository, type TripOverviewSourceRecord } from "../ports/trip-room-repository.ts";
import { requireAuthSession } from "../ports/session.ts";
import { mergeParticipantIdentityInRoom } from "../domain/room-transitions.ts";
import { getRoomActor, isRoomConfirmed } from "../domain/auth-guards.ts";
import { toTripRoomDecisionContext } from "../domain/trip-decision.ts";
import { resolveEligibleTripActions } from "../domain/trip-action-resolver.ts";
import { getConfirmedPlan } from "../domain/room.ts";
import type { ParticipantId } from "../domain/ids.ts";

export const toTripOverviewDto = (
  record: TripOverviewSourceRecord,
  sessionParticipantIds: ReadonlyArray<ParticipantId>
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
  };
};

export const listTripOverviews = Effect.fn("listTripOverviews")(function* () {
  const session = yield* requireAuthSession();
  const repo = yield* TripRoomRepository;
  const records = yield* repo.getRoomOverviewRecords(session.participantIds);

  const items = records.map((record) => {
    const mergedRoom = mergeParticipantIdentityInRoom(
      record.room,
      session.participantId,
      session.participantIds
    );
    return toTripOverviewDto(
      { ...record, room: mergedRoom },
      session.participantIds
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
