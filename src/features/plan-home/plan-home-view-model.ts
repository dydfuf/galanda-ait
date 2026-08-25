import { getConfirmedPlan, getPlanDateRange, getPlanNightCount, getTripRoomDisplayDate, type TripRoom } from "../../core/domain/room.ts";
import {
  hasResolvablePlanAuthor,
  isPlanAuthor,
  canManagePlan,
  isPlanConfirmed as isDomainPlanConfirmed,
  isRoomConfirmed as isDomainRoomConfirmed,
  type ParticipantIdentity,
} from "../../core/domain/auth-guards.ts";

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

export interface TripRoomViewModel {
  readonly id: string;
  readonly title: string;
  readonly destination: string;
  readonly displayStartDate?: string;
  readonly displayEndDate?: string;
  readonly period: string;
  readonly memberCount: number;
  readonly memberNames: string;
  readonly revision: number;
  readonly confirmedPlanId?: string;
  readonly confirmedPlanTitle?: string;
  readonly decisionStatusText: string;
  readonly decisionSubText: string;
  readonly decisionBadgeText: string;
  readonly decisionBadgeVariant: "success" | "info" | "warning";
  readonly candidateCount: number;
  readonly totalOpinionCount: number;
  readonly participatedMemberCount: number;
  readonly isConfirmed: boolean;
  readonly plans: ReadonlyArray<PlanSummaryData>;
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

  const plans: ReadonlyArray<PlanSummaryData> = room.plans.map((p, idx) => {
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
            : currentUserIds.includes(opinion.userId)
        )
      : undefined;

    return {
      id: p.id,
      title: p.title,
      planTag: isPlanConfirmed ? "CONFIRMED" : isBasic ? "BASIC" : "ALTERNATIVE",
      planTagLabel: isBasic ? "기본안" : `대안 ${idx}`,
      period: range ? `${range.startDate} ~ ${range.endDate}` : "일정 미정",
      nights,
      days,
      differenceSummary: p.differenceSummary,
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
    };
  });

  const displayDate = getTripRoomDisplayDate(room);
  const candidateCount = room.plans.length;
  const totalOpinionCount = plans.reduce(
    (acc, p) => acc + p.opinions.likeCount + p.opinions.okayCount + p.opinions.hardCount,
    0,
  );
  const participatedIds = new Set<string>();
  for (const plan of room.plans) {
    for (const opinion of plan.memberOpinions ?? []) {
      participatedIds.add(opinion.userId);
    }
  }
  const participatedMemberCount = participatedIds.size;
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
  return {
    id: room.id,
    title: room.title,
    destination: room.destination,
    displayStartDate: displayDate?.startDate,
    displayEndDate: displayDate?.endDate,
    period: displayDate ? `${displayDate.startDate} ~ ${displayDate.endDate}` : "일정 미정",
    memberCount: room.members.length,
    memberNames: room.members.map((m) => m.name).join(", "),
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
    isConfirmed,
    plans,
  };
};
