import type { TripRoom } from "../../core/domain/room.ts";
import type { BookingRiskItem } from "./components/BookingRiskSummary.tsx";
import type { TimelineItem } from "./components/DetailTimeline.tsx";
import type { ReactionType } from "./components/OpinionBottomSheet.tsx";
import type { PlanCardData } from "../plan-home/components/PlanCard.tsx";

export interface PlanMemberOpinionViewModel {
  readonly userId: string;
  readonly userName: string;
  readonly reaction: ReactionType;
  readonly reason?: string;
}

export interface DetailedPlanViewModel extends PlanCardData {
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
  readonly confirmedPlanId?: string;
  readonly confirmedPlanTitle?: string;
  readonly decisionStatusText: string;
  readonly decisionSubText: string;
  readonly plans: ReadonlyArray<DetailedPlanViewModel>;
}

export const toPlanDetailViewModel = (room: TripRoom): PlanDetailViewModel => {
  const confirmed = room.plans.find((p) => p.id === room.confirmedPlanId);
  const isConfirmed = Boolean(room.confirmedPlanId);

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

  const baseMembers = room.members.length > 0 ? room.members.length : 4;

  const plans: ReadonlyArray<DetailedPlanViewModel> = room.plans.map((p, idx) => {
    const isPlanConfirmed = p.id === room.confirmedPlanId;
    const isBasic = idx === 0;
    const author = room.members[idx % room.members.length] ?? { name: "호스트" };

    const nights = 3;
    const days = 4;
    const groupCost = 3200000 + idx * 240000;
    const perPersonCost = Math.round(groupCost / baseMembers);

    const route =
      p.places.length > 0
        ? p.places.slice(0, 3).map((place, pIdx) => ({
            city: place.name.split(" ")[0] || room.destination,
            nights: pIdx === 0 ? 1 : 2,
          }))
        : [
            { city: room.destination, nights: 2 },
            { city: "인근 지역", nights: 1 },
          ];

    // 예약 위험 요약 (PL-02 2번 섹션)
    const bookingRisks: ReadonlyArray<BookingRiskItem> =
      idx === 1
        ? [
            {
              level: "WARNING",
              message: "서귀포 숙소 잔여 객실 확인이 필요해요",
              snapshotInfo: `${author.name} · 3일 전 확인 스냅샷`,
            },
          ]
        : [];

    // 타임라인 아이템 (체류 + 이동 구간 - PL-02 3번 섹션)
    const timelineItems: ReadonlyArray<TimelineItem> = [
      {
        type: "STAY",
        stay: {
          id: `stay-${p.id}-1`,
          city: route[0]?.city ?? room.destination,
          period: "4월 10일~11일",
          nights: route[0]?.nights ?? 1,
          hotelName: idx === 0 ? "그랜드 조선 호텔" : "해비치 리조트 & 호텔",
          priceText: `그룹 총액 ${(1200000 + idx * 100000).toLocaleString()}원 (${baseMembers}명 기준)`,
          bookingStatus: "AVAILABLE",
          confirmedInfo: `${author.name} · 어제 확인`,
          bookingUrl: "https://toss.im",
        },
      },
      {
        type: "TRANSPORT",
        transport: {
          id: `transport-${p.id}-1`,
          fromCity: route[0]?.city ?? room.destination,
          toCity: route[1]?.city ?? "서귀포",
          mode: "렌터카 카니발",
          hasTransfer: false,
          durationText: "약 50분",
          priceText: "그룹 총액 약 240,000원",
          bookingStatus: "AVAILABLE",
          confirmedInfo: "김호스트 · 2일 전 확인",
        },
      },
      {
        type: "STAY",
        stay: {
          id: `stay-${p.id}-2`,
          city: route[1]?.city ?? "서귀포",
          period: "4월 11일~13일",
          nights: route[1]?.nights ?? 2,
          hotelName: idx === 0 ? "파르나스 호텔 제주" : "신라호텔 제주",
          priceText: `그룹 총액 ${(1800000 + idx * 140000).toLocaleString()}원 (${baseMembers}명 기준)`,
          bookingStatus: idx === 1 ? "NEED_CHECK" : "AVAILABLE",
          confirmedInfo: `${author.name} · 3일 전 확인`,
          bookingUrl: "https://toss.im",
        },
      },
    ];

    // 구성원 의견 목록 (PL-02 5번 섹션)
    const memberOpinions: ReadonlyArray<PlanMemberOpinionViewModel> = [
      {
        userId: "user-host",
        userName: room.members[0]?.name ?? "김호스트",
        reaction: "LIKE",
      },
      {
        userId: "user-member-1",
        userName: room.members[1]?.name ?? "이친구",
        reaction: idx === 1 ? "HARD" : "OKAY",
        reason: idx === 1 ? "숙소 이동이 많아 피로할 것 같아요." : undefined,
      },
      {
        userId: "user-member-2",
        userName: room.members[2]?.name ?? "박여행",
        reaction: "LIKE",
      },
    ];

    const likeCount = memberOpinions.filter((m) => m.reaction === "LIKE").length;
    const okayCount = memberOpinions.filter((m) => m.reaction === "OKAY").length;
    const hardCount = memberOpinions.filter((m) => m.reaction === "HARD").length;

    return {
      id: p.id,
      title: p.title,
      planTag: isPlanConfirmed ? "CONFIRMED" : isBasic ? "BASIC" : "ALTERNATIVE",
      planTagLabel: isBasic ? "기본안" : `대안 ${idx}`,
      period: `${room.startDate} ~ ${room.endDate}`,
      nights,
      days,
      route,
      differenceSummary: !isBasic ? "서귀포 체류 중심 코스 및 숙소 변경" : undefined,
      groupCostText: `그룹 총액 약 ${(groupCost / 10000).toLocaleString()}만원`,
      perPersonCostText: `${baseMembers}명 기준 1인 ${(perPersonCost / 10000).toLocaleString()}만원`,
      bookingAlert: idx === 1 ? "서귀포 숙소 잔여 객실 확인 필요" : undefined,
      authorName: author.name,
      proposalReason:
        idx === 0
          ? "첫날은 가볍게 오션뷰 카페를 즐기고 둘째 날부터 서귀포 힐링 코스로 이동하는 기본 일정입니다."
          : "호텔 수영장과 서귀포 휴양림 중심의 여유로운 호캉스 코스입니다.",
      opinions: {
        likeCount,
        okayCount,
        hardCount,
      },
      myReaction: idx === 0 ? "LIKE" : undefined,
      isConfirmed: isPlanConfirmed,
      bookingRisks,
      timelineItems,
      memberOpinions,
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
