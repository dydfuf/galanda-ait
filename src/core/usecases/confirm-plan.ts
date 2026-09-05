import { Clock, Effect } from "effect";
import { RevisionSchema, type PlanId, type Revision, type TripId } from "../domain/ids.ts";
import { TripRoomRepository } from "../ports/trip-room-repository.ts";
import { ConfirmedItineraryRepository } from "../ports/confirmed-itinerary-repository.ts";
import { IdGenerator } from "../ports/id-generator.ts";
import { requireAuthSession } from "../ports/session.ts";
import {
  requirePlanInRoom,
  requireRoomHost,
} from "../domain/auth-guards.ts";
import { getPlanConfirmability } from "../domain/confirmed-itinerary.ts";
import {
  confirmPlanInRoom,
  mergeParticipantIdentityInRoom,
} from "../domain/room-transitions.ts";
import { StateConflictError, ValidationError } from "../domain/errors.ts";
import type { TripActivityWrite } from "../domain/trip-activity.ts";
import { logDecisionFunnelEvent } from "./decision-funnel.ts";

export const confirmTripPlan = Effect.fn("confirmTripPlan")(
  function* (
    roomId: TripId,
    planId: PlanId,
    expectedRevision: Revision
  ) {
    // 1. 인증된 세션 확인
    const session = yield* requireAuthSession(
      "여행안을 확정하려면 로그인이 필요합니다."
    );

    // 2. 방 조회
    const repo = yield* TripRoomRepository;
    const room = mergeParticipantIdentityInRoom(
      yield* repo.getRoom(roomId),
      session.participantId,
      session.participantIds
    );

    // 3. RBAC: 확정은 방장만 수행할 수 있다.
    const host = yield* requireRoomHost(
      room,
      session.participantIds,
      "방장만 여행안을 확정할 수 있습니다."
    );

    // 4. 대상 플랜 유효성 검증
    const plan = yield* requirePlanInRoom(room, planId);

    // 5. 확정은 한 번만 가능하며, 실패 시 저장소를 호출하지 않는다.
    const confirmability = getPlanConfirmability(room, plan);
    if (confirmability.kind === "CONFIRMED") {
      return yield* Effect.fail(
        new StateConflictError({
          message: "이미 확정된 여행안이 있어 다시 확정할 수 없습니다.",
        })
      );
    }

    if (confirmability.kind === "INVALID_PUBLISH") {
      return yield* Effect.fail(
        new ValidationError({
          message: confirmability.message,
        })
      );
    }

    if (confirmability.kind === "INVALID_SNAPSHOT") {
      return yield* Effect.fail(
        new ValidationError({ message: "일정 스냅샷을 만들 수 없는 여행안입니다." })
      );
    }
    const sourcePlanRevision = plan.revision;
    if (!sourcePlanRevision) {
      return yield* Effect.fail(
        new ValidationError({ message: "공개된 여행안 revision만 확정할 수 있습니다." })
      );
    }
    const { snapshot } = confirmability;

    const ids = yield* IdGenerator;
    const createdAt = new Date(yield* Clock.currentTimeMillis).toISOString();
    const itinerary = {
      id: yield* ids.itineraryId,
      tripId: room.id,
      sourcePlanId: plan.id,
      sourcePlanRevision,
      currentRevision: RevisionSchema.make(1),
      snapshot,
      createdBy: session.participantId,
      createdAt,
    };

    const itineraries = yield* ConfirmedItineraryRepository;
    const activity: TripActivityWrite = {
      actorParticipantId: session.participantId,
      actorDisplayName: host.name ?? session.name,
      event: {
        type: "PLAN_CONFIRMED",
        subjectPlanId: plan.id,
        subjectTitle: plan.title,
        roomRevision: room.revision + 1,
        itineraryRevision: 1,
      },
    };

    const confirmed = yield* itineraries.confirm({
      room: confirmPlanInRoom(room, plan),
      expectedRoomRevision: expectedRevision,
      itinerary,
      activity,
    });
    yield* logDecisionFunnelEvent("plan_confirmed", room, session.participantIds);
    return confirmed;
  }
);
