import { Effect, Option } from "effect";
import type { ParticipantId, TripId } from "../domain/ids.ts";
import type { TripRoom } from "../domain/room.ts";
import { TripRoomRepository } from "../ports/trip-room-repository.ts";
import { getOptionalSession } from "../ports/session.ts";
import { mergeParticipantIdentityInRoom } from "../domain/room-transitions.ts";

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

const getViewerIdentity = Effect.gen(function* () {
  const session = yield* getOptionalSession;
  return Option.isSome(session) ? session.value : undefined;
});

export const getTripRoom = Effect.fn("getTripRoom")(function* (roomId: TripId) {
  const repo = yield* TripRoomRepository;
  const room = yield* repo.getRoom(roomId);
  const session = yield* getViewerIdentity;
  const merged = session
    ? mergeParticipantIdentityInRoom(
        room,
        session.participantId,
        session.participantIds
      )
    : room;
  return toViewerRoom(merged, session?.participantIds);
});

export const findTripRoom = Effect.fn("findTripRoom")(function* (roomId: TripId) {
  return yield* getTripRoom(roomId).pipe(
    Effect.map(Option.some),
    Effect.catchTag("NotFoundError", () => Effect.succeed(Option.none()))
  );
});

export const getTripRooms = Effect.fn("getTripRooms")(function* () {
  const repo = yield* TripRoomRepository;
  const session = yield* getViewerIdentity;
  return (yield* repo.getRooms()).map((room) => {
    const merged = session
      ? mergeParticipantIdentityInRoom(
          room,
          session.participantId,
          session.participantIds
        )
      : room;
    return toViewerRoom(merged, session?.participantIds);
  });
});
