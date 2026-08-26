import {
  isRoomConfirmed,
  type RoomActor,
} from "../../core/domain/auth-guards.ts";
import type { TripActionId } from "../../core/domain/trip-action.ts";
import { isPlanConfirmable } from "../../core/domain/confirmed-itinerary.ts";
import type {
  TripDecisionContext,
  TripRecommendationConflict,
} from "../../core/domain/trip-decision.ts";
import type { PlanPublishInput, TripRoom } from "../../core/domain/room.ts";
import type { PlanEditorSection } from "../plan-editor/plan-editor-section.ts";

export interface TripActionPresentation {
  readonly label: string;
  readonly reason: string;
  readonly section?: PlanEditorSection;
  readonly route: (tripId: string) => string;
}

export const tripActionPresentation: Record<TripActionId, TripActionPresentation> = {
  EDIT_PLAN_BASIC: {
    label: "첫 여행안 만들기",
    reason: "첫 여행안의 이름과 기준 인원을 먼저 정해보세요.",
    section: "basic",
    route: (tripId) => `/trips/${tripId}/plans/new/basic`,
  },
  DEFINE_ROUTE: {
    label: "여행 경로 정하기",
    reason: "방문 도시와 날짜를 정하면 다음 계획을 이어갈 수 있어요.",
    section: "route",
    route: (tripId) => `/trips/${tripId}/plans/new/route`,
  },
  ADD_ACCOMMODATION: {
    label: "숙소 정보 추가하기",
    reason: "방문 도시별 숙소나 찾는 중 상태를 남겨보세요.",
    section: "accommodation",
    route: (tripId) => `/trips/${tripId}/plans/new/accommodation`,
  },
  ADD_TRANSPORT: {
    label: "교통 정보 추가하기",
    reason: "출국부터 귀국까지 이동 구간을 정리해보세요.",
    section: "transport",
    route: (tripId) => `/trips/${tripId}/plans/new/transport`,
  },
  PUBLISH_FIRST_PLAN: {
    label: "첫 여행안 등록하기",
    reason: "필수 정보가 모두 준비되어 첫 여행안을 등록할 수 있어요.",
    route: (tripId) => `/trips/${tripId}/plans/new`,
  },
  INVITE_MEMBER: {
    label: "친구 초대하기",
    reason: "함께 여행할 친구를 초대해 계획을 시작해보세요.",
    route: (tripId) => `/trips/${tripId}/plans`,
  },
  PROPOSE_ALTERNATIVE: {
    label: "새 여행안 제안하기",
    reason: "다른 선택지를 제안해 함께 비교해보세요.",
    route: (tripId) => `/trips/${tripId}/plans/new`,
  },
  GIVE_OPINION: {
    label: "여행안에 의견 남기기",
    reason: "후보 여행안에 의견을 남겨 선택을 도와주세요.",
    route: (tripId) => `/trips/${tripId}/plans`,
  },
  COMPARE_PLANS: {
    label: "여행안 비교하기",
    reason: "후보 여행안의 차이를 비교해보세요.",
    route: (tripId) => `/trips/${tripId}/plans`,
  },
  CONFIRM_PLAN: {
    label: "여행안 확정하기",
    reason: "모인 의견을 확인하고 최종 여행안을 선택해보세요.",
    route: (tripId) => `/trips/${tripId}/plans`,
  },
  VIEW_ITINERARY: {
    label: "확정 일정 보기",
    reason: "확정된 여행 일정을 날짜별로 확인해보세요.",
    route: (tripId) => `/trips/${tripId}/itinerary`,
  },
};

export const toTripRoomDecisionContext = (
  room: TripRoom,
  actor: RoomActor,
): TripDecisionContext => {
  const opinionParticipantIds = new Set(
    room.plans.flatMap((plan) =>
      (plan.memberOpinions ?? []).map(({ userId }) => userId)
    )
  );

  return {
    planCount: room.plans.length,
    memberCount: room.members.length,
    opinionParticipantCount: opinionParticipantIds.size,
    actorHasOpinion: actor.member
      ? opinionParticipantIds.has(actor.member.id)
      : false,
    isConfirmed: isRoomConfirmed(room),
    confirmablePlanCount: room.plans.filter((plan) =>
      isPlanConfirmable(room, plan)
    ).length,
  };
};

export const toFirstPlanDecisionContext = (
  room: TripRoom,
  actor: RoomActor,
  firstPlanDraft: PlanPublishInput,
  conflict?: TripRecommendationConflict,
): TripDecisionContext => ({
  ...toTripRoomDecisionContext(room, actor),
  firstPlanDraft,
  conflict,
});
