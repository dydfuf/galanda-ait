import { getConfirmedPlan, getPlanDateRange, getPlanNightCount, getStayNightCount, getTripRoomDisplayDate, type TripRoom } from "../../core/domain/room.ts";
import {
  hasResolvablePlanAuthor,
  isPlanAuthor,
  canManagePlan,
  isPlanConfirmed as isDomainPlanConfirmed,
  isRoomConfirmed as isDomainRoomConfirmed,
  type RoomActor,
  type ParticipantIdentity,
} from "../../core/domain/auth-guards.ts";
import { resolveEligibleTripActions } from "../../core/domain/trip-action-resolver.ts";
import type { TripActionId } from "../../core/domain/trip-action.ts";
import { toTripRoomDecisionContext } from "../../core/domain/trip-decision.ts";
import { tripActionPresentation } from "../common/trip-action-presentation.ts";
import {
  calculatePlanCost,
  formatCostRangeText,
  type PlanCostSummary,
} from "../../core/calculations/plan-cost.ts";

export interface PlanOpinionCounts {
  readonly likeCount: number;
  readonly okayCount: number;
  readonly hardCount: number;
}

export interface PlanSummaryData {
  readonly id: string;
  readonly title: string;
  readonly planTag: "BASIC" | "ALTERNATIVE" | "CONFIRMED";
  readonly planTagLabel: string;
  readonly period: string;
  readonly nights: number;
  readonly days: number;
  readonly differenceSummary?: string;
  readonly authorId?: string;
  readonly authorName: string;
  readonly isAuthor?: boolean;
  readonly canManage?: boolean;
  readonly opinions: PlanOpinionCounts;
  readonly myReaction?: "LIKE" | "OKAY" | "HARD";
  readonly isConfirmed: boolean;
}

/**
 * DEC-1: 후보별 응답·비용·예약 위험을 카드에서 바로 판단할 수 있게
 * 현재 room/plan 데이터에서만 파생한다. 새 DB/API를 만들지 않는다.
 */
export interface PlanHomeCandidateMeta {
  /** 핵심 경로. 입력된 route만 투영하고 legacy places에서 만들지 않는다. */
  readonly routeText: string;
  readonly costSummary: PlanCostSummary;
  /**
   * 1인 예상 비용. 비용 미입력은 0원이 아니라 `비용 미정`으로 표시한다.
   * 명시적 0원(known zero)은 `0원`으로 구분한다.
   */
  readonly perPersonCostText: string;
  /** AVAILABLE이 아닌 숙소·교통(찾는 중 포함)의 수. plan-detail 집계와 동일한 의미다. */
  readonly bookingNeedCheckCount: number;
  readonly hasBookingDetails: boolean;
  /** `확인 필요 N건` / `예약 확인 완료` / `예약 정보 없음` 중 하나다. */
  readonly bookingRiskText: string;
  /** 해당 여행안에 반응한 고유 회원 수 (stable participant 기준, 현재 멤버만). */
  readonly respondentCount: number;
  /** 응답 가능한 회원 수 (현재 방 멤버 수). */
  readonly eligibleResponseCount: number;
  /** `이 여행안에 5/6명 응답` 형태. 의미를 숨기지 않는다. */
  readonly responseText: string;
  /** 해당 여행안에 아직 반응하지 않은 현재 멤버 이름. */
  readonly nonRespondentNames: ReadonlyArray<string>;
  /** `준호님은 아직 의견이 없어요` 형태. 없으면 undefined. */
  readonly nonRespondentText?: string;
}

/** Plan Home은 optional 차이 요약도 누락시키지 않고 명시적인 미정 문구로 투영한다. */
export interface PlanHomePlanSummaryData extends PlanSummaryData, PlanHomeCandidateMeta {
  readonly differenceSummaryText: string;
}

export const formatNonRespondentText = (
  names: ReadonlyArray<string>,
): string | undefined => {
  if (names.length === 0) return undefined;
  if (names.length === 1) return `${names[0]}님은 아직 의견이 없어요`;
  if (names.length <= 3) return `${names.join(", ")}님은 아직 의견이 없어요`;
  return `${names.slice(0, 2).join(", ")}님 외 ${names.length - 2}명은 아직 의견이 없어요`;
};

export const getPlanRouteText = (
  plan: Pick<TripRoom["plans"][number], "routes">,
): string => {
  const routes = plan.routes ?? [];
  if (routes.length === 0) return "경로 미정";
  return routes
    .map((stay) => {
      const nights = getStayNightCount(stay);
      return nights > 0 ? `${stay.city} ${nights}박` : `${stay.city} 당일`;
    })
    .join(" · ");
};

export const getPlanBookingNeedCheckCount = (
  plan: Pick<TripRoom["plans"][number], "accommodations" | "transports">,
): number => {
  let count = 0;
  for (const acc of plan.accommodations ?? []) {
    if (!(acc.bookingStatus === "AVAILABLE" && !acc.isSearching)) count += 1;
  }
  for (const transport of plan.transports ?? []) {
    if (transport.bookingStatus !== "AVAILABLE") count += 1;
  }
  return count;
};

export const getBookingRiskText = (
  needCheckCount: number,
  hasDetails: boolean,
): string => {
  if (!hasDetails) return "예약 정보 없음";
  if (needCheckCount > 0) return `확인 필요 ${needCheckCount}건`;
  return "예약 확인 완료";
};

export interface TripRoomViewModel {
  readonly id: string;
  readonly title: string;
  readonly destination: string;
  readonly displayStartDate?: string;
  readonly displayEndDate?: string;
  readonly period: string;
  readonly memberCount: number;
  /** 참가자 identity를 표시 문자열로 합치지 않고 구조화된 순서로 유지한다. */
  readonly memberNames: ReadonlyArray<string>;
  readonly revision: number;
  readonly confirmedPlanId?: string;
  readonly confirmedPlanTitle?: string;
  readonly decisionStatusText: string;
  readonly decisionSubText: string;
  readonly decisionBadgeText: string;
  readonly decisionBadgeVariant: "success" | "info" | "warning";
  readonly candidateCount: number;
  readonly totalOpinionCount: number;
  /**
   * 하나 이상의 여행안에 반응한 고유 회원 수.
   * stable participant identity(현재 멤버) 기준으로만 계산한다.
   * 레거시 voteCount·탈퇴 멤버 의견은 제외한다.
   */
  readonly participatedMemberCount: number;
  /** `6명 중 5명이 한 번 이상 의견을 남겼어요` 형태. 합집합임을 숨기지 않는다. */
  readonly overallParticipationText: string;
  /** 어떤 후보에도 반응하지 않은 현재 멤버 이름. */
  readonly overallNonRespondentNames: ReadonlyArray<string>;
  /** `준호님은 아직 의견이 없어요` 형태. 없으면 undefined. */
  readonly overallNonRespondentText?: string;
  /** 전체 `어려워요` 수 (구조화 의견만). */
  readonly totalHardCount: number;
  /** `어려워요`가 1개 이상인 후보 수. */
  readonly hardAffectedCandidateCount: number;
  /** `어려워요 2개 · 1개 여행안에서 확인 필요` 형태. 없으면 undefined. */
  readonly hardSummaryText?: string;
  /** 모든 후보의 미해결 예약 확인 건수 합. */
  readonly totalUnresolvedBookingCount: number;
  /** `예약 확인 필요 3건` 형태. 없으면 undefined. */
  readonly bookingSummaryText?: string;
  /** legacy voteCount처럼 참여자 identity를 복원할 수 없는 의견이 하나라도 있는지 나타낸다. */
  readonly hasUnattributedOpinions: boolean;
  /** 회원과 연결되지 않아 응답률에서 제외한 의견 수. */
  readonly unattributedOpinionCount: number;
  /** `과거 의견 2개는 ... 응답률에서 제외했어요` 형태. 없으면 undefined. */
  readonly unattributedNoticeText?: string;
  readonly isConfirmed: boolean;
  readonly plans: ReadonlyArray<PlanHomePlanSummaryData>;
}

export const getTripListStatusText = (
  room: Pick<TripRoomViewModel, "confirmedPlanId" | "confirmedPlanTitle" | "plans">
): string => {
  if (room.confirmedPlanId) {
    return room.confirmedPlanTitle
      ? `일정 확정 · ${room.confirmedPlanTitle}`
      : "일정 확정";
  }
  if (room.plans.length === 0) return "첫 여행안을 만들어보세요";
  if (room.plans.length === 1) return "여행안 1개 · 의견을 모으는 중";
  return `여행안 ${room.plans.length}개 · 비교 중`;
};

/**
 * PL-01 상태별 CTA contract (RAON-228).
 *
 * primary는 상태별로 0개 또는 1개만 존재한다.
 * - 후보 0개: 첫 여행안 만들기
 * - 후보 1개: 새 여행안 제안하기 (비교 CTA 없음)
 * - 후보 2개 이상: 여행안 비교하기 (fast compare / selector는 기존 계약 유지)
 * - 확정: 확정 일정 보기 (mutation 진입 없음)
 *
 * RBAC 계약: 공통 eligible action resolver가 HOST/MEMBER에게만 next action을 제공한다.
 * GUEST에게는 mutation과 recommendation CTA를 모두 노출하지 않는다.
 *
 * 후보 추가 진입(`새 여행안 제안하기`)은 비교가 primary가 되는 2개 이상 & 미확정 &
 * plan:create 가능자에서만 후보 section의 secondary로 노출해
 * bottom sticky에서 primary끼리 경쟁하지 않게 한다.
 */
export type PlanHomePrimaryCtaKind =
  | "create-first"
  | "propose-new"
  | "compare"
  | "view-itinerary";

export interface PlanHomeCtaContract {
  /** 노출할 권한 있는 primary가 없으면 null (예: GUEST + 후보 0~1개) */
  readonly primaryKind: PlanHomePrimaryCtaKind | null;
  readonly primaryLabel: string | null;
  readonly showNewProposalEntry: boolean;
}

const planHomeCtaKind: Partial<Record<TripActionId, PlanHomePrimaryCtaKind>> = {
  EDIT_PLAN_BASIC: "create-first",
  PROPOSE_ALTERNATIVE: "propose-new",
  COMPARE_PLANS: "compare",
  VIEW_ITINERARY: "view-itinerary",
};

export const resolvePlanHomeCta = (
  room: TripRoom,
  actor: RoomActor,
): PlanHomeCtaContract => {
  const actionId = resolveEligibleTripActions(
    toTripRoomDecisionContext(room, actor),
    actor,
  )[0]?.actionId;
  const primaryKind = actionId ? (planHomeCtaKind[actionId] ?? null) : null;

  return {
    primaryKind,
    primaryLabel: primaryKind && actionId
      ? tripActionPresentation[actionId].label
      : null,
    showNewProposalEntry:
      primaryKind === "compare" && actor.can("plan:create"),
  };
};

export const toTripRoomViewModel = (
  room: TripRoom,
  currentUserIds?: ParticipantIdentity
): TripRoomViewModel => {
  const confirmed = getConfirmedPlan(room);
  // 도메인 계약을 따른다: confirmedPlanId가 없어도 plan.status가 CONFIRMED인
  // legacy 데이터에서 확정 상태를 보호한다 (auth-guards isRoomConfirmed).
  const isConfirmed = isDomainRoomConfirmed(room);

  // 결정 상태 문구 결정 (기획 문서 PL-01 명세)
  let decisionStatusText = "여행안을 고르고 있어요";
  let decisionSubText = "후보 여행안을 살펴보고 의견을 남겨보세요.";

  if (isConfirmed) {
    const confirmedTitle =
      confirmed?.title ??
      room.plans.find((p) => p.status === "CONFIRMED")?.title;
    decisionStatusText = confirmedTitle
      ? `'${confirmedTitle}'(으)로 일정을 확정했어요`
      : "일정이 확정되었어요";
    decisionSubText = "확정된 일정은 [일정] 탭에서 날짜별로 확인할 수 있어요.";
  } else if (room.plans.length === 0) {
    decisionStatusText = "아직 등록된 여행안이 없어요";
    decisionSubText = "첫 여행안을 제안해 친구들과 함께 여행을 계획해보세요.";
  } else if (room.plans.length === 1) {
    decisionStatusText = "기본 여행안이 등록되었어요";
    decisionSubText = "의견을 남기거나 새로운 대안을 제안해보세요.";
  } else {
    decisionStatusText = `${room.members.length}명 중 의견을 모으고 있어요`;
    decisionSubText = "마음에 드는 여행안을 비교하고 가장 좋은 안을 골라보세요.";
  }

  const memberIdSet = new Set<string>(room.members.map((m) => m.id));
  const eligibleResponseCount = room.members.length;

  const plans: ReadonlyArray<PlanHomePlanSummaryData> = room.plans.map(
    (p, idx) => {
      const isPlanConfirmed = isDomainPlanConfirmed(room, p);
      const isBasic = idx === 0;
      const resolvable = hasResolvablePlanAuthor(room, p);
      const authorName = resolvable
        ? (p.authorName ??
          room.members.find((m) => m.id === p.authorId)?.name ??
          "작성자 미확인")
        : "작성자 미확인";
      const range = getPlanDateRange(p);
      const nights = getPlanNightCount(p);
      const days = nights > 0 ? nights + 1 : 0;
      const differenceSummaryText = p.differenceSummary?.trim()
        ? p.differenceSummary
        : "핵심 차이 미정";

      const likeCount = p.memberOpinions
        ? p.memberOpinions.filter((m) => m.reaction === "LIKE").length
        : p.voteCount;
      const okayCount = p.memberOpinions
        ? p.memberOpinions.filter((m) => m.reaction === "OKAY").length
        : 0;
      const hardCount = p.memberOpinions
        ? p.memberOpinions.filter((m) => m.reaction === "HARD").length
        : 0;

      const isAuthor = isPlanAuthor(room, p, currentUserIds);
      const canManage = canManagePlan(room, p, currentUserIds);

      // 세션 사용자가 확인되지 않으면 "내 의견"도 존재하지 않는다
      const myOpinion = currentUserIds
        ? p.memberOpinions?.find((opinion) =>
            typeof currentUserIds === "string"
              ? opinion.userId === currentUserIds
              : currentUserIds.includes(opinion.userId),
          )
        : undefined;

      // DEC-1: 후보별 응답은 stable participant(현재 멤버) 기준으로만 계산한다.
      const respondentIds = new Set<string>();
      for (const opinion of p.memberOpinions ?? []) {
        if (memberIdSet.has(opinion.userId)) respondentIds.add(opinion.userId);
      }
      const respondentCount = respondentIds.size;
      const nonRespondentNames = room.members
        .filter((m) => !respondentIds.has(m.id))
        .map((m) => m.name);
      const responseText =
        eligibleResponseCount > 0
          ? `이 여행안에 ${respondentCount}/${eligibleResponseCount}명 응답`
          : "응답 가능한 회원이 없어요";

      // DEC-1: 비용 계산은 plan detail과 동일한 계산을 재사용하고 중복 구현하지 않는다.
      const enteredHeadcount =
        p.baseHeadcount ??
        (room.members.length > 0 ? room.members.length : undefined);
      const costSummary = calculatePlanCost(
        p.accommodations,
        p.transports,
        enteredHeadcount ?? 1,
      );
      const perPersonCostText = !costSummary.hasCost
        ? "비용 미정"
        : enteredHeadcount
          ? `${enteredHeadcount}명 기준 1인 ${formatCostRangeText(
              costSummary.minPerPerson,
              costSummary.maxPerPerson,
              costSummary.unpricedCount,
            )}`
          : "기준 인원 미정";

      const bookingNeedCheckCount = getPlanBookingNeedCheckCount(p);
      const hasBookingDetails =
        (p.accommodations?.length ?? 0) > 0 || (p.transports?.length ?? 0) > 0;

      return {
        id: p.id,
        title: p.title,
        planTag: isPlanConfirmed
          ? "CONFIRMED"
          : isBasic
            ? "BASIC"
            : "ALTERNATIVE",
        planTagLabel: isBasic ? "기본안" : `대안 ${idx}`,
        period: range ? `${range.startDate} ~ ${range.endDate}` : "일정 미정",
        nights,
        days,
        differenceSummary: p.differenceSummary,
        differenceSummaryText,
        authorId: p.authorId,
        authorName,
        isAuthor,
        canManage,
        opinions: {
          likeCount,
          okayCount,
          hardCount,
        },
        myReaction: myOpinion?.reaction,
        isConfirmed: isPlanConfirmed,
        routeText: getPlanRouteText(p),
        costSummary,
        perPersonCostText,
        bookingNeedCheckCount,
        hasBookingDetails,
        bookingRiskText: getBookingRiskText(
          bookingNeedCheckCount,
          hasBookingDetails,
        ),
        respondentCount,
        eligibleResponseCount,
        responseText,
        nonRespondentNames,
        nonRespondentText: formatNonRespondentText(nonRespondentNames),
      };
    },
  );

  const displayDate = getTripRoomDisplayDate(room);
  const candidateCount = room.plans.length;
  const totalOpinionCount = plans.reduce(
    (acc, p) => acc + p.opinions.likeCount + p.opinions.okayCount + p.opinions.hardCount,
    0,
  );
  // DEC-1: 전체 참여는 하나 이상 반응한 고유 회원(현재 멤버)의 합집합이다.
  // 레거시 voteCount·탈퇴 멤버 의견은 총 의견 수에만 포함하고 응답률에서는 제외한다.
  const participatedIds = new Set<string>();
  for (const plan of room.plans) {
    for (const opinion of plan.memberOpinions ?? []) {
      if (memberIdSet.has(opinion.userId)) participatedIds.add(opinion.userId);
    }
  }
  const participatedMemberCount = participatedIds.size;
  let legacyVoteTotal = 0;
  let staleStructuredCount = 0;
  for (const plan of room.plans) {
    if (plan.memberOpinions === undefined) {
      legacyVoteTotal += plan.voteCount;
    } else {
      for (const opinion of plan.memberOpinions) {
        if (!memberIdSet.has(opinion.userId)) staleStructuredCount += 1;
      }
    }
  }
  const unattributedOpinionCount = legacyVoteTotal + staleStructuredCount;
  const hasUnattributedOpinions = unattributedOpinionCount > 0;
  const overallNonRespondentNames = room.members
    .filter((m) => !participatedIds.has(m.id))
    .map((m) => m.name);
  const totalHardCount = plans.reduce((acc, p) => acc + p.opinions.hardCount, 0);
  const hardAffectedCandidateCount = plans.filter(
    (p) => p.opinions.hardCount > 0,
  ).length;
  const totalUnresolvedBookingCount = plans.reduce(
    (acc, p) => acc + p.bookingNeedCheckCount,
    0,
  );
  const decisionBadgeText = isConfirmed
    ? "확정됨"
    : candidateCount === 0
      ? "첫 여행안 필요"
      : "의견 수집 중";
  const decisionBadgeVariant: TripRoomViewModel["decisionBadgeVariant"] = isConfirmed
    ? "success"
    : candidateCount === 0
      ? "warning"
      : "info";
  const overallParticipationText = `${room.members.length}명 중 ${participatedMemberCount}명이 한 번 이상 의견을 남겼어요`;
  const overallNonRespondentText = formatNonRespondentText(
    overallNonRespondentNames,
  );
  const hardSummaryText =
    totalHardCount > 0
      ? `어려워요 ${totalHardCount}개 · ${hardAffectedCandidateCount}개 여행안에서 확인 필요`
      : undefined;
  const bookingSummaryText =
    totalUnresolvedBookingCount > 0
      ? `예약 확인 필요 ${totalUnresolvedBookingCount}건`
      : undefined;
  const unattributedNoticeText =
    unattributedOpinionCount > 0
      ? `과거 의견 ${unattributedOpinionCount}개는 회원과 연결되지 않아 응답률에서 제외했어요`
      : undefined;
  return {
    id: room.id,
    title: room.title,
    destination: room.destination,
    displayStartDate: displayDate?.startDate,
    displayEndDate: displayDate?.endDate,
    period: displayDate ? `${displayDate.startDate} ~ ${displayDate.endDate}` : "일정 미정",
    memberCount: room.members.length,
    memberNames: room.members.map((member) => member.name),
    revision: room.revision,
    confirmedPlanId: room.confirmedPlanId,
    confirmedPlanTitle: confirmed?.title,
    decisionStatusText,
    decisionSubText,
    decisionBadgeText,
    decisionBadgeVariant,
    candidateCount,
    totalOpinionCount,
    participatedMemberCount,
    overallParticipationText,
    overallNonRespondentNames,
    overallNonRespondentText,
    totalHardCount,
    hardAffectedCandidateCount,
    hardSummaryText,
    totalUnresolvedBookingCount,
    bookingSummaryText,
    hasUnattributedOpinions,
    unattributedOpinionCount,
    unattributedNoticeText,
    isConfirmed,
    plans,
  };
};
