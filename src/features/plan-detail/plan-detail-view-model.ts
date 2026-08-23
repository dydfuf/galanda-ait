import {
  getConfirmedPlan,
  getPlanDateRange,
  getPlanNightCount,
  getStayNightCount,
  getTripRoomDisplayDate,
  type BookingStatus,
  type PublicPlanMemberOpinion,
  type TripRoom,
} from "../../core/domain/room.ts";
import {
  isPlanAuthor,
  canManagePlan,
  getRoomActor,
  type ParticipantIdentity,
  type RoomRole,
} from "../../core/domain/auth-guards.ts";
import type { BookingRiskItem } from "./components/BookingRiskSummary.tsx";
import type { TimelineItem } from "./components/DetailTimeline.tsx";
import type { ReactionType } from "./components/OpinionBottomSheet.tsx";
import type { PlanSummaryData } from "../plan-home/plan-home-view-model.ts";
import {
  calculatePlanCost,
  formatCostRangeText,
  type PlanCostSummary,
} from "../../core/calculations/plan-cost.ts";

export interface PlanMemberOpinionViewModel {
  readonly userId: string;
  readonly userName: string;
  readonly reaction: ReactionType;
}

export interface DetailedPlanViewModel extends PlanSummaryData {
  readonly route: ReadonlyArray<{ readonly city: string; readonly nights: number }>;
  readonly costSummary: PlanCostSummary;
  readonly groupCostText: string;
  readonly perPersonCostText: string;
  readonly bookingAlert?: string;
  /** 세션 사용자가 남긴 "어려워요" 사유 등 본인 의견 내용 (비로그인 시 undefined) */
  readonly myOpinionReason?: string;
  readonly proposalReason: string;
  readonly bookingRisks: ReadonlyArray<BookingRiskItem>;
  readonly timelineItems: ReadonlyArray<TimelineItem>;
  readonly memberOpinions: ReadonlyArray<PlanMemberOpinionViewModel>;
}

export interface PlanDetailViewModel {
  readonly id: string;
  readonly title: string;
  readonly destination: string;
  readonly period: string;
  readonly memberCount: number;
  readonly memberNames: string;
  readonly revision: number;
  /** 세션 사용자의 방 내 역할. 방장 전용 동작(확정 등) 노출 판단에 사용해요. */
  readonly viewerRole: RoomRole;
  readonly isViewerHost: boolean;
  readonly confirmedPlanId?: string;
  readonly confirmedPlanTitle?: string;
  readonly decisionStatusText: string;
  readonly decisionSubText: string;
  readonly plans: ReadonlyArray<DetailedPlanViewModel>;
}

export const toPlanDetailViewModel = (
  room: TripRoom,
  currentUserIds?: ParticipantIdentity
): PlanDetailViewModel => {
  const confirmed = getConfirmedPlan(room);
  const isConfirmed = Boolean(room.confirmedPlanId);
  const viewer = getRoomActor(room, currentUserIds);

  let decisionStatusText = "여행안을 고르고 있어요";
  let decisionSubText = "후보 여행안을 살펴보고 의견을 남겨보세요.";

  if (isConfirmed && confirmed) {
    decisionStatusText = `'${confirmed.title}'(으)로 일정을 확정했어요`;
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

  const baseMembers = room.members.length > 0 ? room.members.length : 1;

  const plans: ReadonlyArray<DetailedPlanViewModel> = room.plans.map((p, idx) => {
    const isPlanConfirmed = p.id === room.confirmedPlanId;
    const isBasic = idx === 0;
    const authorName =
      p.authorName ??
      room.members.find((m) => m.id === p.authorId)?.name ??
      (room.members[0]?.name ?? "작성자");
    const headcount = p.baseHeadcount ?? baseMembers;

    const route =
      p.routes && p.routes.length > 0
        ? p.routes.map((r) => ({ city: r.city, nights: getStayNightCount(r) }))
        : p.places.length > 0
          ? p.places.slice(0, 3).map((place, pIdx) => ({
              city: place.name.split(" ")[0] || room.destination,
              nights: pIdx === 0 ? 1 : 2,
            }))
          : [{ city: room.destination, nights: 1 }];

    const range = getPlanDateRange(p);
    const nights = getPlanNightCount(p);
    const days = nights > 0 ? nights + 1 : 0;

    // 비용 계산
    const costSummary = calculatePlanCost(p.accommodations, p.transports, headcount);
    const groupCostText = costSummary.hasCost
      ? `그룹 총액 ${formatCostRangeText(costSummary.minTotal, costSummary.maxTotal)}`
      : "예상 경비 미정";
    const perPersonCostText = costSummary.hasCost
      ? `${headcount}명 기준 1인 ${formatCostRangeText(costSummary.minPerPerson, costSummary.maxPerPerson)}`
      : "비용 미정";

    const accommodations = p.accommodations ?? [];
    const transports = p.transports ?? [];

    // 예약 위험 요약 (PL-02 2번 섹션)
    const bookingRisks: BookingRiskItem[] = [];
    const addBookingRisk = ({
      status,
      message,
      confirmedBy,
      confirmedAt,
      isSearching = false,
    }: {
      readonly status: BookingStatus;
      readonly message: string;
      readonly confirmedBy?: string;
      readonly confirmedAt?: string;
      readonly isSearching?: boolean;
    }): void => {
      if (status === "AVAILABLE" && !isSearching) return;

      const isUnchecked = status === "NOT_CHECKED" || isSearching;
      bookingRisks.push({
        level: status === "FULL" ? "DANGER" : "WARNING",
        message,
        snapshotInfo: isUnchecked
          ? "아직 예약 상태를 확인하지 않았어요"
          : `${confirmedBy ?? authorName} · ${confirmedAt ?? "최근"} 확인`,
      });
    };

    for (const acc of accommodations) {
      const isUnchecked = acc.bookingStatus === "NOT_CHECKED" || acc.isSearching;
      addBookingRisk({
        status: acc.bookingStatus,
        isSearching: acc.isSearching,
        message:
          acc.bookingStatus === "FULL"
            ? `${acc.city} 숙소(${acc.hotelName})가 현재 만실 상태예요`
            : isUnchecked
              ? `${acc.city} 숙소(${acc.hotelName}) 예약 상태를 아직 확인하지 않았어요`
              : `${acc.city} 숙소(${acc.hotelName}) 잔여 객실 확인이 필요해요`,
        confirmedBy: acc.confirmedBy,
        confirmedAt: acc.confirmedAt,
      });
    }

    for (const trans of transports) {
      addBookingRisk({
        status: trans.bookingStatus,
        message:
          trans.bookingStatus === "FULL"
            ? `${trans.fromCity} → ${trans.toCity} 교통편이 매진/불가 상태예요`
            : trans.bookingStatus === "NOT_CHECKED"
              ? `${trans.fromCity} → ${trans.toCity} 교통 예약 상태를 아직 확인하지 않았어요`
              : `${trans.fromCity} → ${trans.toCity} 교통 예약 확인이 필요해요`,
        confirmedBy: trans.confirmedBy,
        confirmedAt: trans.confirmedAt,
      });
    }

    // 타임라인 아이템 (체류 + 이동 구간)
    const timelineItems: TimelineItem[] = [];
    const timelineLength = Math.max(accommodations.length, transports.length);
    for (let i = 0; i < timelineLength; i++) {
      const acc = accommodations[i];
      if (acc) {
        const stayStatus =
          acc.bookingStatus === "NOT_CHECKED" || acc.isSearching
            ? "SEARCHING"
            : acc.bookingStatus;

        timelineItems.push({
          type: "STAY",
          stay: {
            id: acc.id,
            city: acc.city,
            period: acc.period,
            nights: acc.nights,
            hotelName: acc.hotelName,
            priceText: acc.priceRange
              ? `그룹 총액 ${formatCostRangeText(acc.priceRange.min, acc.priceRange.max)} (${headcount}명 기준)`
              : "가격 미정",
            bookingStatus: stayStatus,
            confirmedInfo: `${acc.confirmedBy ?? authorName} · ${acc.confirmedAt ?? "최근 확인"}`,
            bookingUrl: acc.bookingUrl,
          },
        });
      }

      const trans = transports[i];
      if (trans) {
        const transStatus = trans.bookingStatus === "NOT_CHECKED" ? "SEARCHING" : trans.bookingStatus;

        timelineItems.push({
          type: "TRANSPORT",
          transport: {
            id: trans.id,
            fromCity: trans.fromCity,
            toCity: trans.toCity,
            mode: trans.mode,
            hasTransfer: trans.hasTransfer,
            durationText: trans.durationText,
            priceText: trans.priceRange
              ? `그룹 총액 ${formatCostRangeText(trans.priceRange.min, trans.priceRange.max)}`
              : "가격 미정",
            bookingStatus: transStatus,
            confirmedInfo: `${trans.confirmedBy ?? authorName} · ${trans.confirmedAt ?? "최근 확인"}`,
            bookingUrl: trans.bookingUrl,
          },
        });
      }
    }

    // 구성원 의견 목록
    const privateOpinions = p.memberOpinions ?? [];
    const memberOpinions: ReadonlyArray<PlanMemberOpinionViewModel> =
      privateOpinions.map(
        ({ userId, userName, reaction }: PublicPlanMemberOpinion) => ({
          userId,
          userName,
          reaction,
        })
      );

    const likeCount = privateOpinions.filter((m) => m.reaction === "LIKE").length;
    const okayCount = privateOpinions.filter((m) => m.reaction === "OKAY").length;
    const hardCount = privateOpinions.filter((m) => m.reaction === "HARD").length;

    const isAuthor = isPlanAuthor(room, p, currentUserIds);
    const canManage = canManagePlan(room, p, currentUserIds);

    // 세션 사용자가 확인되지 않으면 "내 의견"도 존재하지 않는다
    // (하드코딩된 로컬 사용자 폴백은 남의 의견을 내 것으로 표시하므로 사용하지 않는다)
    const myOpinion = currentUserIds
      ? privateOpinions.find((opinion) =>
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
      route,
      costSummary,
      differenceSummary: p.differenceSummary,
      groupCostText,
      perPersonCostText,
      bookingAlert: bookingRisks[0]?.message,
      authorId: p.authorId,
      authorName,
      isAuthor,
      canManage,
      proposalReason: p.proposalReason ?? "",
      opinions: {
        likeCount,
        okayCount,
        hardCount,
      },
      myReaction: myOpinion?.reaction,
      myOpinionReason: myOpinion?.reaction === "HARD" ? myOpinion.reason : undefined,
      isConfirmed: isPlanConfirmed,
      bookingRisks,
      timelineItems,
      memberOpinions,
    };
  });

  const displayDate = getTripRoomDisplayDate(room);
  return {
    id: room.id,
    title: room.title,
    destination: room.destination,
    period: displayDate ? `${displayDate.startDate} ~ ${displayDate.endDate}` : "일정 미정",
    memberCount: room.members.length,
    memberNames: room.members.map((m) => m.name).join(", "),
    revision: room.revision,
    viewerRole: viewer.role,
    isViewerHost: viewer.isHost,
    confirmedPlanId: room.confirmedPlanId,
    confirmedPlanTitle: confirmed?.title,
    decisionStatusText,
    decisionSubText,
    plans,
  };
};
