import { Effect, Option } from "effect";
import type { ParticipantId, TripId } from "../domain/ids.ts";
import type { TripRoom } from "../domain/room.ts";
import { TripRoomRepository } from "../ports/trip-room-repository.ts";
import { getOptionalSession } from "../ports/session.ts";

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

const getViewerIds = Effect.gen(function* () {
  const session = yield* getOptionalSession;
  return Option.isSome(session) ? session.value.participantIds : [];
});

export const getTripRoom = Effect.fn("getTripRoom")(function* (roomId: TripId) {
  const repo = yield* TripRoomRepository;
  const room = yield* repo.getRoom(roomId);
  return toViewerRoom(room, yield* getViewerIds);
});

export const findTripRoom = Effect.fn("findTripRoom")(function* (roomId: TripId) {
  return yield* getTripRoom(roomId).pipe(
    Effect.map(Option.some),
    Effect.catchTag("NotFoundError", () => Effect.succeed(Option.none()))
  );
});

export const getTripRooms = Effect.fn("getTripRooms")(function* () {
  const repo = yield* TripRoomRepository;
  const viewerIds = yield* getViewerIds;
  return (yield* repo.getRooms()).map((room) => toViewerRoom(room, viewerIds));
});
