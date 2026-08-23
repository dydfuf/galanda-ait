import { Effect, Option } from "effect";
import type { ParticipantId, TripId } from "../domain/ids.ts";
import type { TripRoom } from "../domain/room.ts";
import { TripRoomRepository } from "../ports/trip-room-repository.ts";
import { requireAuthSession } from "../ports/session.ts";
import { mergeParticipantIdentityInRoom } from "../domain/room-transitions.ts";
import { requireRoomMember } from "../domain/auth-guards.ts";
import { NotFoundError } from "../domain/errors.ts";

const toViewerRoom = (
  room: TripRoom,
  viewerIds: ReadonlyArray<ParticipantId> = []
): TripRoom => ({
  ...room,
  plans: room.plans.map((plan) => ({
    ...plan,
    memberOpinions: plan.memberOpinions?.map((opinion) =>
      viewerIds.includes(opinion.userId) &&
      opinion.reaction === "HARD" &&
      opinion.reason
        ? opinion
        : {
            userId: opinion.userId,
            userName: opinion.userName,
            reaction: opinion.reaction,
          }
    ),
  })),
});

export const getTripRoom = Effect.fn("getTripRoom")(function* (roomId: TripId) {
  const session = yield* requireAuthSession();
  const repo = yield* TripRoomRepository;
  const room = yield* repo.getRoom(roomId);
  const merged = mergeParticipantIdentityInRoom(
    room,
    session.participantId,
    session.participantIds
  );
  yield* requireRoomMember(merged, session.participantIds).pipe(
    Effect.mapError(
      () => new NotFoundError({ entity: "TripRoom", id: roomId })
    )
  );
  return toViewerRoom(merged, session.participantIds);
});

export const findTripRoom = Effect.fn("findTripRoom")(function* (roomId: TripId) {
  return yield* getTripRoom(roomId).pipe(
    Effect.map(Option.some),
    Effect.catchTag("NotFoundError", () => Effect.succeed(Option.none()))
  );
});

export const getTripRooms = Effect.fn("getTripRooms")(function* () {
  const session = yield* requireAuthSession();
  const repo = yield* TripRoomRepository;
  return (yield* repo.getRooms(session.participantIds)).map((room) => {
    const merged = mergeParticipantIdentityInRoom(
      room,
      session.participantId,
      session.participantIds
    );
    return toViewerRoom(merged, session.participantIds);
  });
});
