import { Effect } from "effect";
import { requireRoomMember } from "../domain/auth-guards.ts";
import type { TripId } from "../domain/ids.ts";
import { mergeParticipantIdentityInRoom } from "../domain/room-transitions.ts";
import { requireAuthSession } from "../ports/session.ts";
import { TripActivityRepository } from "../ports/trip-activity-repository.ts";
import { TripRoomRepository } from "../ports/trip-room-repository.ts";

export interface MarkTripActivityReadInput {
  readonly tripId: TripId;
  readonly throughSequence: bigint;
}

export const markTripActivityRead = Effect.fn("markTripActivityRead")(
  function* (input: MarkTripActivityReadInput) {
    const session = yield* requireAuthSession(
      "읽음 상태를 저장하려면 로그인이 필요합니다."
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
      "여행방 참여자만 활동 읽음 상태를 변경할 수 있습니다."
    );

    const activityRepo = yield* TripActivityRepository;
    return yield* activityRepo.markRead({
      tripId: input.tripId,
      canonicalParticipantId: session.participantId,
      actorParticipantIds: session.participantIds,
      throughSequence: input.throughSequence,
    });
  }
);
