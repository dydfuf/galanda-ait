import type { TripRoom } from "../../core/domain/room.ts";
import type { PlanCardData } from "./components/PlanCard.tsx";

export interface TripRoomViewModel {
  readonly id: string;
  readonly title: string;
  readonly destination: string;
  readonly period: string;
  readonly memberCount: number;
  readonly memberNames: string;
  readonly revision: number;
  readonly confirmedPlanId?: string;
  readonly confirmedPlanTitle?: string;
  readonly decisionStatusText: string;
  readonly decisionSubText: string;
  readonly plans: ReadonlyArray<PlanCardData>;
}

export const toTripRoomViewModel = (room: TripRoom): TripRoomViewModel => {
  const confirmed = room.plans.find((p) => p.id === room.confirmedPlanId);
  const isConfirmed = Boolean(room.confirmedPlanId);

  // 결정 상태 문구 결정 (기획 문서 PL-01 명세)
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

  const plans: ReadonlyArray<PlanCardData> = room.plans.map((p, idx) => {
    const isPlanConfirmed = p.id === room.confirmedPlanId;
    const isBasic = idx === 0;
    const authorName =
      p.authorName ??
      room.members.find((m) => m.id === p.authorId)?.name ??
      (room.members[0]?.name ?? "작성자");
    const headcount = p.baseHeadcount ?? baseMembers;

    const route =
      p.routes && p.routes.length > 0
        ? p.routes.map((r) => ({ city: r.city, nights: r.nights }))
        : p.places.length > 0
          ? p.places.slice(0, 3).map((place, pIdx) => ({
              city: place.name.split(" ")[0] || room.destination,
              nights: pIdx === 0 ? 1 : 2,
            }))
          : [{ city: room.destination, nights: 1 }];

    const nights = route.reduce((acc, curr) => acc + curr.nights, 0) || 1;
    const days = nights + 1;

    let minTotal = 0;
    let maxTotal = 0;
    let hasCost = false;

    if (p.accommodations) {
      for (const a of p.accommodations) {
        if (a.priceRange && (a.priceRange.min > 0 || a.priceRange.max > 0)) {
          minTotal += a.priceRange.min;
          maxTotal += a.priceRange.max;
          hasCost = true;
        }
      }
    }
    if (p.transports) {
      for (const t of p.transports) {
        if (t.priceRange && (t.priceRange.min > 0 || t.priceRange.max > 0)) {
          minTotal += t.priceRange.min;
          maxTotal += t.priceRange.max;
          hasCost = true;
        }
      }
    }

    const groupCostText = hasCost
      ? minTotal === maxTotal
        ? `그룹 총액 약 ${Math.round(minTotal / 10000)}만원`
        : `그룹 총액 약 ${Math.round(minTotal / 10000)}~${Math.round(maxTotal / 10000)}만원`
      : "예상 경비 미정";

    const perPersonCostText = hasCost
      ? minTotal === maxTotal
        ? `${headcount}명 기준 1인 ${Math.round(minTotal / headcount / 10000)}만원`
        : `${headcount}명 기준 1인 ${Math.round(minTotal / headcount / 10000)}~${Math.round(maxTotal / headcount / 10000)}만원`
      : "비용 미정";

    // 예약 경고 상태 계산
    let bookingAlert: string | undefined = undefined;
    if (p.accommodations) {
      const fullStay = p.accommodations.find((a) => a.bookingStatus === "FULL");
      const checkStay = p.accommodations.find(
        (a) => a.bookingStatus === "NEED_CHECK"
      );
      if (fullStay) {
        bookingAlert = `${fullStay.city} 숙소 만실 확인 필요`;
      } else if (checkStay) {
        bookingAlert = `${checkStay.city} 숙소 잔여 객실 확인 필요`;
      }
    }

    const likeCount = p.memberOpinions
      ? p.memberOpinions.filter((m) => m.reaction === "LIKE").length
      : p.voteCount;
    const okayCount = p.memberOpinions
      ? p.memberOpinions.filter((m) => m.reaction === "OKAY").length
      : 0;
    const hardCount = p.memberOpinions
      ? p.memberOpinions.filter((m) => m.reaction === "HARD").length
      : 0;

    const myOpinion = p.memberOpinions?.find(
      (m) => m.userId === "user-local-me" || m.userId === "user-local-host"
    );

    return {
      id: p.id,
      title: p.title,
      planTag: isPlanConfirmed ? "CONFIRMED" : isBasic ? "BASIC" : "ALTERNATIVE",
      planTagLabel: isBasic ? "기본안" : `대안 ${idx}`,
      period: `${room.startDate} ~ ${room.endDate}`,
      nights,
      days,
      route,
      differenceSummary: p.differenceSummary,
      groupCostText,
      perPersonCostText,
      bookingAlert,
      authorName,
      opinions: {
        likeCount,
        okayCount,
        hardCount,
      },
      myReaction: myOpinion?.reaction,
      isConfirmed: isPlanConfirmed,
    };
  });

  return {
    id: room.id,
    title: room.title,
    destination: room.destination,
    period: `${room.startDate} ~ ${room.endDate}`,
    memberCount: room.members.length,
    memberNames: room.members.map((m) => m.name).join(", "),
    revision: room.revision,
    confirmedPlanId: room.confirmedPlanId,
    confirmedPlanTitle: confirmed?.title,
    decisionStatusText,
    decisionSubText,
    plans,
  };
};
