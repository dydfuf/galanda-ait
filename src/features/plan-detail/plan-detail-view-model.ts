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
  hasResolvablePlanAuthor,
  isPlanAuthor,
  canMutatePlan,
  isPlanConfirmed as isDomainPlanConfirmed,
  isRoomConfirmed,
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
  readonly canSubmitOpinion: boolean;
  readonly canCreatePlan: boolean;
  readonly isConfirmed: boolean;
  readonly confirmedPlanId?: string;
  readonly confirmedPlanTitle?: string;
  readonly decisionStatusText: string;
  readonly decisionSubText: string;
  readonly plans: ReadonlyArray<DetailedPlanViewModel>;
}

interface BookingConfirmationInput {
  readonly status: BookingStatus;
  readonly confirmedBy?: string;
  readonly confirmedAt?: string;
  readonly isSearching?: boolean;
}

const formatBookingConfirmation = ({
  status,
  confirmedBy,
  confirmedAt,
  isSearching = false,
}: BookingConfirmationInput): string => {
  if (status === "NOT_CHECKED" || isSearching) {
    return "아직 예약 상태를 확인하지 않았어요";
  }

  const confirmation = [confirmedBy, confirmedAt].filter(
    (value): value is string => Boolean(value?.trim()),
  );
  return confirmation.length > 0
    ? `${confirmation.join(" · ")} 확인`
    : "확인 기록 미정";
};

export const toPlanDetailViewModel = (
  room: TripRoom,
  currentUserIds?: ParticipantIdentity
): PlanDetailViewModel => {
  const confirmed = getConfirmedPlan(room);
  const roomConfirmed = isRoomConfirmed(room);
  const viewer = getRoomActor(room, currentUserIds);

  let decisionStatusText = "여행안을 고르고 있어요";
  let decisionSubText = "후보 여행안을 살펴보고 의견을 남겨보세요.";

  if (roomConfirmed && confirmed) {
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
    decisionSubText =
      "마음에 드는 여행안을 비교하고 가장 좋은 안을 골라보세요.";
  }

  const plans: ReadonlyArray<DetailedPlanViewModel> = room.plans.map(
    (p, idx) => {
      const isPlanConfirmed = isDomainPlanConfirmed(room, p);
      const isBasic = idx === 0;
      const resolvable = hasResolvablePlanAuthor(room, p);
      const authorName = resolvable
        ? (p.authorName ??
          room.members.find((member) => member.id === p.authorId)?.name ??
          "작성자 미확인")
        : "작성자 미확인";
      const enteredHeadcount =
        p.baseHeadcount ??
        (room.members.length > 0 ? room.members.length : undefined);

      // 입력된 route만 투영한다. legacy places나 여행 목적지에서 임의 숙박 수를 만들지 않는다.
      const route = (p.routes ?? []).map((stay) => ({
        city: stay.city,
        nights: getStayNightCount(stay),
      }));

      const range = getPlanDateRange(p);
      const nights = getPlanNightCount(p);
      const days = nights > 0 ? nights + 1 : 0;

      const costSummary = calculatePlanCost(
        p.accommodations,
        p.transports,
        enteredHeadcount ?? 1,
      );
      const groupCostText = costSummary.hasCost
        ? `${costSummary.unpricedCount > 0 ? "확인된 그룹 금액" : "그룹 총액"} ${formatCostRangeText(
            costSummary.minTotal,
            costSummary.maxTotal,
            costSummary.unpricedCount,
          )}`
        : "가격 미정";
      const perPersonCostText = costSummary.hasCost
        ? enteredHeadcount
          ? `${enteredHeadcount}명 기준 1인 ${formatCostRangeText(
              costSummary.minPerPerson,
              costSummary.maxPerPerson,
              costSummary.unpricedCount,
            )}`
          : "기준 인원 미정"
        : "가격 미정";

      const accommodations = p.accommodations ?? [];
      const transports = p.transports ?? [];

      const bookingRisks: BookingRiskItem[] = [];
      const addBookingRisk = ({
        status,
        message,
        confirmedBy,
        confirmedAt,
        isSearching = false,
      }: BookingConfirmationInput & { readonly message: string }): void => {
        if (status === "AVAILABLE" && !isSearching) return;

        bookingRisks.push({
          level: status === "FULL" ? "DANGER" : "WARNING",
          message,
          snapshotInfo: formatBookingConfirmation({
            status,
            confirmedBy,
            confirmedAt,
            isSearching,
          }),
        });
      };

      for (const accommodation of accommodations) {
        const isUnchecked =
          accommodation.bookingStatus === "NOT_CHECKED" ||
          accommodation.isSearching;
        const hotelName =
          accommodation.hotelName.trim() ||
          (accommodation.isSearching ? "숙소 찾는 중" : "숙소 미정");
        addBookingRisk({
          status: accommodation.bookingStatus,
          isSearching: accommodation.isSearching,
          message:
            accommodation.bookingStatus === "FULL"
              ? `${accommodation.city} 숙소(${hotelName})가 현재 만실 상태예요`
              : isUnchecked
                ? `${accommodation.city} 숙소(${hotelName}) 예약 상태를 아직 확인하지 않았어요`
                : `${accommodation.city} 숙소(${hotelName}) 잔여 객실 확인이 필요해요`,
          confirmedBy: accommodation.confirmedBy,
          confirmedAt: accommodation.confirmedAt,
        });
      }

      for (const transport of transports) {
        addBookingRisk({
          status: transport.bookingStatus,
          message:
            transport.bookingStatus === "FULL"
              ? `${transport.fromCity} → ${transport.toCity} 교통편이 매진/불가 상태예요`
              : transport.bookingStatus === "NOT_CHECKED"
                ? `${transport.fromCity} → ${transport.toCity} 교통 예약 상태를 아직 확인하지 않았어요`
                : `${transport.fromCity} → ${transport.toCity} 교통 예약 확인이 필요해요`,
          confirmedBy: transport.confirmedBy,
          confirmedAt: transport.confirmedAt,
        });
      }

      const timelineItems: TimelineItem[] = [];
      const timelineLength = Math.max(accommodations.length, transports.length);
      for (let index = 0; index < timelineLength; index += 1) {
        const accommodation = accommodations[index];
        if (accommodation) {
          const stayStatus =
            accommodation.bookingStatus === "NOT_CHECKED" ||
            accommodation.isSearching
              ? "SEARCHING"
              : accommodation.bookingStatus;

          timelineItems.push({
            type: "STAY",
            stay: {
              id: accommodation.id,
              city: accommodation.city,
              period: accommodation.period.trim() || "숙박 일정 미정",
              nights: accommodation.nights,
              hotelName:
                accommodation.hotelName.trim() ||
                (accommodation.isSearching ? "숙소 찾는 중" : "숙소 미정"),
              priceText: accommodation.priceRange
                ? `그룹 총액 ${formatCostRangeText(
                    accommodation.priceRange.min,
                    accommodation.priceRange.max,
                  )}${enteredHeadcount ? ` (${enteredHeadcount}명 기준)` : ""}`
                : "가격 미정",
              bookingStatus: stayStatus,
              confirmedInfo: formatBookingConfirmation({
                status: accommodation.bookingStatus,
                confirmedBy: accommodation.confirmedBy,
                confirmedAt: accommodation.confirmedAt,
                isSearching: accommodation.isSearching,
              }),
              bookingUrl: accommodation.bookingUrl,
            },
          });
        }

        const transport = transports[index];
        if (transport) {
          const transportStatus =
            transport.bookingStatus === "NOT_CHECKED"
              ? "SEARCHING"
              : transport.bookingStatus;

          timelineItems.push({
            type: "TRANSPORT",
            transport: {
              id: transport.id,
              fromCity: transport.fromCity,
              toCity: transport.toCity,
              mode: transport.mode.trim() || "교통수단 미정",
              hasTransfer: transport.hasTransfer,
              durationText: transport.durationText.trim() || "소요 시간 미정",
              priceText: transport.priceRange
                ? `그룹 총액 ${formatCostRangeText(
                    transport.priceRange.min,
                    transport.priceRange.max,
                  )}`
                : "가격 미정",
              bookingStatus: transportStatus,
              confirmedInfo: formatBookingConfirmation({
                status: transport.bookingStatus,
                confirmedBy: transport.confirmedBy,
                confirmedAt: transport.confirmedAt,
              }),
              bookingUrl: transport.bookingUrl,
            },
          });
        }
      }

      const privateOpinions = p.memberOpinions ?? [];
      const memberOpinions: ReadonlyArray<PlanMemberOpinionViewModel> =
        privateOpinions.map(
          ({ userId, userName, reaction }: PublicPlanMemberOpinion) => ({
            userId,
            userName,
            reaction,
          }),
        );

      const likeCount = privateOpinions.filter(
        (member) => member.reaction === "LIKE",
      ).length;
      const okayCount = privateOpinions.filter(
        (member) => member.reaction === "OKAY",
      ).length;
      const hardCount = privateOpinions.filter(
        (member) => member.reaction === "HARD",
      ).length;

      const isAuthor = isPlanAuthor(room, p, currentUserIds);
      const canManage = canMutatePlan(room, p, currentUserIds);

      const myOpinion = currentUserIds
        ? privateOpinions.find((opinion) =>
            typeof currentUserIds === "string"
              ? opinion.userId === currentUserIds
              : currentUserIds.includes(opinion.userId),
          )
        : undefined;

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
        myOpinionReason:
          myOpinion?.reaction === "HARD" ? myOpinion.reason : undefined,
        isConfirmed: isPlanConfirmed,
        bookingRisks,
        timelineItems,
        memberOpinions,
      };
    },
  );

  const displayDate = getTripRoomDisplayDate(room);
  return {
    id: room.id,
    title: room.title,
    destination: room.destination,
    period: displayDate
      ? `${displayDate.startDate} ~ ${displayDate.endDate}`
      : "일정 미정",
    memberCount: room.members.length,
    memberNames: room.members.map((member) => member.name).join(", "),
    revision: room.revision,
    viewerRole: viewer.role,
    isViewerHost: viewer.isHost,
    canSubmitOpinion: !roomConfirmed && viewer.can("opinion:submit"),
    canCreatePlan: !roomConfirmed && viewer.can("plan:create"),
    isConfirmed: roomConfirmed,
    confirmedPlanId: room.confirmedPlanId,
    confirmedPlanTitle: confirmed?.title,
    decisionStatusText,
    decisionSubText,
    plans,
  };
};
