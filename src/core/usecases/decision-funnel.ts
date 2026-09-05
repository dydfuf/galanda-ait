import { Effect } from "effect";
import { getRoomActor } from "../domain/auth-guards.ts";
import { ValidationError } from "../domain/errors.ts";
import type { ParticipantId, PlanId, TripId } from "../domain/ids.ts";
import type { TripRoom } from "../domain/room.ts";
import { requireAuthSession } from "../ports/session.ts";
import { getTripRoom } from "./get-room.ts";

type DecisionFunnelEvent =
  | "invite_opened"
  | "invite_joined"
  | "first_opinion_submitted"
  | "compare_opened"
  | "plan_confirmed";

/** Aggregate-only telemetry: never annotate a room, identity, token or opinion. */
export const logDecisionFunnelEvent = (
  eventName: DecisionFunnelEvent,
  room: TripRoom,
  participantIds: ReadonlyArray<ParticipantId> = [],
) => Effect.logInfo(eventName).pipe(Effect.annotateLogs({
  eventName,
  role: getRoomActor(room, participantIds).role,
  groupSize: room.members.length,
  candidateCount: room.plans.filter((plan) => plan.status !== "DRAFT").length,
  entrySource: eventName.startsWith("invite_") ? "INVITE"
    : eventName === "first_opinion_submitted" ? "PLAN_DETAIL" : "COMPARE",
}));

export const recordCompareOpened = Effect.fn("recordCompareOpened")(function* (
  tripId: TripId,
  left: PlanId,
  right: PlanId,
) {
  const room = yield* getTripRoom(tripId);
  const session = yield* requireAuthSession();
  if (left === right || ![left, right].every((id) =>
    room.plans.some((plan) => plan.id === id && plan.status !== "DRAFT"))) {
    return yield* Effect.fail(new ValidationError({ message: "비교할 두 게시 여행안이 필요합니다." }));
  }
  yield* logDecisionFunnelEvent("compare_opened", room, session.participantIds);
  return { accepted: true as const };
});
