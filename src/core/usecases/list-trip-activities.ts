import { Effect } from "effect";
import { requireRoomMember } from "../domain/auth-guards.ts";
import type { TripId } from "../domain/ids.ts";
import { mergeParticipantIdentityInRoom } from "../domain/room-transitions.ts";
import { requireAuthSession } from "../ports/session.ts";
import { TripActivityRepository } from "../ports/trip-activity-repository.ts";
import { TripRoomRepository } from "../ports/trip-room-repository.ts";

export interface ListTripActivitiesInput {
  readonly tripId: TripId;
  readonly beforeSequence?: bigint;
  readonly limit?: number;
}

export const listTripActivities = Effect.fn("listTripActivities")(
  function* (input: ListTripActivitiesInput) {
    const session = yield* requireAuthSession(
      "활동 이력을 조회하려면 로그인이 필요합니다."
    );
    const rooms = yield* TripRoomRepository;
    const room = mergeParticipantIdentityInRoom(
      yield* rooms.getRoom(input.tripId),
      session.participantId,
      session.participantIds
    );
    yield* requireRoomMember(
      room,
      session.participantIds,
      "여행방 참여자만 활동 이력을 조회할 수 있습니다."
    );

    const activityRepo = yield* TripActivityRepository;
    return yield* activityRepo.listForTrip({
      tripId: input.tripId,
      actorParticipantIds: session.participantIds,
      beforeSequence: input.beforeSequence,
      limit: Math.max(1, Math.min(input.limit ?? 20, 50)),
    });
  }
);
