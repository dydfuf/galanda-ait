import { Clock, Effect, Option, Schema } from "effect";
import { getRoomActor, requireRoomHost } from "../domain/auth-guards.ts";
import { InvalidInviteError } from "../domain/errors.ts";
import { INVITE_TTL_MS } from "../domain/invite.ts";
import {
  InviteTokenSchema,
  type TripId,
} from "../domain/ids.ts";
import { getConfirmedPlan, getPlanDateRange } from "../domain/room.ts";
import { mergeParticipantIdentityInRoom } from "../domain/room-transitions.ts";
import { IdGenerator } from "../ports/id-generator.ts";
import { InviteRepository } from "../ports/invite-repository.ts";
import { getOptionalSession, requireAuthSession } from "../ports/session.ts";
import { TripRoomRepository } from "../ports/trip-room-repository.ts";

const requireHostRoom = (roomId: TripId) =>
  Effect.gen(function* () {
    const session = yield* requireAuthSession();
    const rooms = yield* TripRoomRepository;
    const room = mergeParticipantIdentityInRoom(
      yield* rooms.getRoom(roomId),
      session.participantId,
      session.participantIds
    );
    const host = yield* requireRoomHost(room, session.participantIds);
    return { session, host };
  });

export const issueTripInvite = Effect.fn("issueTripInvite")(function* (
  roomId: TripId
) {
  const { session, host } = yield* requireHostRoom(roomId);
  const ids = yield* IdGenerator;
  const invites = yield* InviteRepository;
  const token = yield* ids.inviteToken;
  const now = yield* Clock.currentTimeMillis;
  const expiresAt = new Date(now + INVITE_TTL_MS).toISOString();

  yield* invites.issue({
    token,
    tripId: roomId,
    issuedByParticipantId: session.participantId,
    inviterName: host.name,
    expiresAt,
  });
  return { token, expiresAt };
});

export const revokeTripInvite = Effect.fn("revokeTripInvite")(function* (
  roomId: TripId
) {
  yield* requireHostRoom(roomId);
  const invites = yield* InviteRepository;
  yield* invites.revoke(roomId);
  return { revoked: true as const };
});

const invalidInvite = () => Effect.fail(new InvalidInviteError());

export const getPublicInviteSummary = Effect.fn("getPublicInviteSummary")(
  function* (rawToken: string) {
    if (!Schema.is(InviteTokenSchema)(rawToken)) return yield* invalidInvite();

    const invites = yield* InviteRepository;
    const now = yield* Clock.currentTimeMillis;
    const invite = yield* invites.findValid(rawToken, new Date(now));
    if (!invite) return yield* invalidInvite();

    const rooms = yield* TripRoomRepository;
    const room = yield* rooms.getRoom(invite.tripId).pipe(
      Effect.catchTag("NotFoundError", invalidInvite)
    );
    const optionalSession = yield* getOptionalSession;
    const session = Option.getOrUndefined(optionalSession);
    const visibleRoom = session
      ? mergeParticipantIdentityInRoom(
          room,
          session.participantId,
          session.participantIds
        )
      : room;
    const confirmedPlan = getConfirmedPlan(visibleRoom);
    const dateRange = confirmedPlan
      ? getPlanDateRange(confirmedPlan)
      : undefined;

    return {
      title: visibleRoom.title,
      inviterName: invite.inviterName,
      participantCount: visibleRoom.members.length,
      ...(confirmedPlan ? { destination: visibleRoom.destination } : {}),
      ...(dateRange
        ? { startDate: dateRange.startDate, endDate: dateRange.endDate }
        : {}),
      alreadyJoined: session
        ? getRoomActor(visibleRoom, session.participantIds).isMember
        : false,
    };
  }
);
