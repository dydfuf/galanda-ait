import type { ParticipantId } from "./ids.ts";
import type { TripRoom } from "./room.ts";

// Apply only to responses: private opinion reasons must remain in storage.
export const toViewerRoom = (
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

