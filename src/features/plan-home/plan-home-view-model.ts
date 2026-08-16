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

  const plans: ReadonlyArray<PlanCardData> = room.plans.map((p, idx) => {
    const isPlanConfirmed = p.id === room.confirmedPlanId;
    const isBasic = idx === 0;

    // 기본 시뮬레이션 데이터 (MVP / 스캐폴딩 presentation 매핑)
    const nights = 3;
    const days = 4;
    const baseMembers = room.members.length > 0 ? room.members.length : 4;
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

    return {
      id: p.id,
      title: p.title,
      planTag: isPlanConfirmed ? "CONFIRMED" : isBasic ? "BASIC" : "ALTERNATIVE",
      planTagLabel: isBasic ? "기본안" : `대안 ${idx}`,
      period: `${room.startDate} ~ ${room.endDate}`,
      nights,
      days,
      route,
      differenceSummary: !isBasic ? "체류 배분 및 추천 코스 변경" : undefined,
      groupCostText: `그룹 총액 약 ${(groupCost / 10000).toLocaleString()}만원`,
      perPersonCostText: `${baseMembers}명 기준 1인 ${(perPersonCost / 10000).toLocaleString()}만원`,
      bookingAlert: idx === 1 ? "숙소 1개 만실 여부 확인 필요" : undefined,
      authorName: room.members[idx % room.members.length]?.name ?? "작성자",
      opinions: {
        likeCount: Math.max(1, p.voteCount),
        okayCount: 1,
        hardCount: idx === 1 ? 1 : 0,
      },
      myReaction: idx === 0 ? "LIKE" : undefined,
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
