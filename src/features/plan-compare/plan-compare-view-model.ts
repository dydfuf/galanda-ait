import type { DetailedPlanViewModel } from "../plan-detail/plan-detail-view-model.ts";
import { formatCostRangeText, formatCostText } from "../../core/calculations/plan-cost.ts";

export type CompareDifferenceKind = "SCHEDULE" | "BOOKING" | "COST" | "OPINIONS";

export interface PlanCompareDifference {
  readonly kind: CompareDifferenceKind;
  readonly label: string;
  readonly leftPlanLabel: string;
  readonly leftValue: string;
  readonly rightPlanLabel: string;
  readonly rightValue: string;
  readonly deltaText?: string;
}

const areRoutesEqual = (
  left: DetailedPlanViewModel["route"],
  right: DetailedPlanViewModel["route"]
): boolean =>
  left.length === right.length &&
  left.every((segment, index) => {
    const other = right[index];
    return other?.city === segment.city && other?.nights === segment.nights;
  });

const formatRoute = (plan: DetailedPlanViewModel): string =>
  plan.route.length > 0
    ? plan.route
        .map((segment) => `${segment.city} ${segment.nights > 0 ? `${segment.nights}박` : "당일"}`)
        .join(" · ")
    : "경로 미정";

const formatSchedule = (plan: DetailedPlanViewModel): string =>
  `${plan.period} · ${plan.nights}박 ${plan.days}일 · ${formatRoute(plan)}`;

const formatBooking = (plan: DetailedPlanViewModel): string => {
  if (plan.bookingRisks.length === 0) return "확인 필요 0건";
  if (plan.timelineItems.length === 0) return "예약 정보 없음";

  const hasDanger = plan.bookingRisks.some((risk) => risk.level === "DANGER");
  const riskDetails = plan.bookingRisks.map((risk) => risk.message).join(" · ");
  return `${plan.bookingRisks.length}건 확인 필요${hasDanger ? " · 예약 불가 포함" : ""} · ${riskDetails}`;
};

const bookingItemSignature = (
  item: DetailedPlanViewModel["timelineItems"][number]
): string | undefined => {
  if (item.type === "STAY" && item.stay) {
    if (item.stay.bookingStatus === "AVAILABLE") return undefined;
    return JSON.stringify([
      "STAY",
      item.stay.id,
      item.stay.city,
      item.stay.period,
      item.stay.nights,
      item.stay.hotelName,
      item.stay.bookingStatus,
    ]);
  }

  if (item.type === "TRANSPORT" && item.transport) {
    if (item.transport.bookingStatus === "AVAILABLE") return undefined;
    return JSON.stringify([
      "TRANSPORT",
      item.transport.id,
      item.transport.fromCity,
      item.transport.toCity,
      item.transport.mode,
      item.transport.hasTransfer,
      item.transport.durationText,
      item.transport.bookingStatus,
    ]);
  }

  return undefined;
};

const bookingSignature = (plan: DetailedPlanViewModel): string =>
  JSON.stringify({
    risks: plan.bookingRisks.map((risk) => [risk.level, risk.message]),
    items:
      plan.bookingRisks.length === 0
        ? []
        : plan.timelineItems
            .map(bookingItemSignature)
            .filter((signature): signature is string => signature !== undefined),
  });

const formatOpinions = (plan: DetailedPlanViewModel): string => {
  const total = plan.opinions.likeCount + plan.opinions.okayCount + plan.opinions.hardCount;
  if (total === 0) return "아직 의견 없음";

  return `좋아요 ${plan.opinions.likeCount} · 괜찮아요 ${plan.opinions.okayCount} · 어려워요 ${plan.opinions.hardCount}`;
};

const opinionSignature = (plan: DetailedPlanViewModel): string =>
  [plan.opinions.likeCount, plan.opinions.okayCount, plan.opinions.hardCount].join("|");

const formatCost = (plan: DetailedPlanViewModel): string =>
  plan.costSummary.hasCost
    ? `1인 ${formatCostRangeText(plan.costSummary.minPerPerson, plan.costSummary.maxPerPerson)}`
    : "예상 경비 미정";

const formatSignedCost = (amount: number): string =>
  `${amount > 0 ? "+" : amount < 0 ? "-" : ""}${formatCostText(Math.abs(amount))}`;

const formatCostDelta = (
  left: DetailedPlanViewModel["costSummary"],
  right: DetailedPlanViewModel["costSummary"]
): string | undefined => {
  if (!left.hasCost || !right.hasCost) return undefined;

  const minDelta = right.minPerPerson - left.minPerPerson;
  const maxDelta = right.maxPerPerson - left.maxPerPerson;
  if (minDelta === 0 && maxDelta === 0) return undefined;

  const delta =
    minDelta === maxDelta
      ? formatSignedCost(minDelta)
      : `${formatSignedCost(minDelta)} ~ ${formatSignedCost(maxDelta)}`;
  return `1인 기준 ${delta}`;
};

const makeDifference = ({
  kind,
  label,
  left,
  right,
  leftValue,
  rightValue,
  isChanged,
  deltaText,
}: {
  readonly kind: CompareDifferenceKind;
  readonly label: string;
  readonly left: DetailedPlanViewModel;
  readonly right: DetailedPlanViewModel;
  readonly leftValue: string;
  readonly rightValue: string;
  readonly isChanged: boolean;
  readonly deltaText?: string;
}): PlanCompareDifference | undefined =>
  isChanged
    ? {
        kind,
        label,
        leftPlanLabel: left.planTagLabel,
        leftValue,
        rightPlanLabel: right.planTagLabel,
        rightValue,
        deltaText,
      }
    : undefined;

export const buildPlanCompareDifferences = (
  left: DetailedPlanViewModel,
  right: DetailedPlanViewModel
): ReadonlyArray<PlanCompareDifference> => {
  const schedule = makeDifference({
    kind: "SCHEDULE",
    label: "일정 구조",
    left,
    right,
    leftValue: formatSchedule(left),
    rightValue: formatSchedule(right),
    isChanged:
      left.period !== right.period ||
      left.nights !== right.nights ||
      left.days !== right.days ||
      !areRoutesEqual(left.route, right.route),
  });
  const booking = makeDifference({
    kind: "BOOKING",
    label: "예약 확인",
    left,
    right,
    leftValue: formatBooking(left),
    rightValue: formatBooking(right),
    isChanged: bookingSignature(left) !== bookingSignature(right),
  });
  const cost = makeDifference({
    kind: "COST",
    label: "예상 경비",
    left,
    right,
    leftValue: formatCost(left),
    rightValue: formatCost(right),
    isChanged:
      left.costSummary.hasCost !== right.costSummary.hasCost ||
      left.costSummary.minPerPerson !== right.costSummary.minPerPerson ||
      left.costSummary.maxPerPerson !== right.costSummary.maxPerPerson,
    deltaText: formatCostDelta(left.costSummary, right.costSummary),
  });
  const opinions = makeDifference({
    kind: "OPINIONS",
    label: "멤버 의견",
    left,
    right,
    leftValue: formatOpinions(left),
    rightValue: formatOpinions(right),
    isChanged: opinionSignature(left) !== opinionSignature(right),
  });

  return [schedule, booking, cost, opinions].filter(
    (difference): difference is PlanCompareDifference => difference !== undefined
  );
};

/**
 * 비교 화면에서 확정 동작을 어떻게 노출할지 결정한 결과예요.
 *
 * - `CONFIRMABLE`: 방장이면서 아직 확정 전 → 확정 CTA 노출
 * - `LOCKED`: 이미 확정된 방 → 선택과 확정을 잠그고 일정 보기만 제공
 * - `VIEW_ONLY`: 방장이 아니면서 확정 전 → 확정 CTA 없이 비교만 제공
 *
 * 확정은 방장만 수행할 수 있다는 규칙을 화면 여러 곳에서 반복해 계산하지 않도록
 * 한 곳에서 판단해요.
 */
export type CompareConfirmState =
  | { readonly kind: "CONFIRMABLE" }
  | { readonly kind: "LOCKED"; readonly confirmedPlanTitle?: string }
  | { readonly kind: "VIEW_ONLY" };

export interface CompareConfirmStateInput {
  /** 세션 사용자가 방장인지 여부 */
  readonly isViewerHost: boolean;
  /** 방에 이미 확정된 여행안이 있는지 여부 */
  readonly isRoomConfirmed: boolean;
  readonly confirmedPlanTitle?: string;
}

export const getCompareConfirmState = ({
  isViewerHost,
  isRoomConfirmed,
  confirmedPlanTitle,
}: CompareConfirmStateInput): CompareConfirmState => {
  if (isRoomConfirmed) {
    return { kind: "LOCKED", confirmedPlanTitle };
  }
  return isViewerHost ? { kind: "CONFIRMABLE" } : { kind: "VIEW_ONLY" };
};

/**
 * 확정 직전에 다시 확인시킬 여행안 요약이에요.
 * 잘못된 여행안을 실수로 확정하지 않도록 날짜·경로·총액·확인 필요 항목을 모아요.
 */
export interface ConfirmPlanSummary {
  readonly planId: string;
  readonly title: string;
  readonly periodText: string;
  readonly routeText: string;
  readonly groupCostText: string;
  readonly perPersonCostText: string;
  readonly needCheckMessages: ReadonlyArray<string>;
}

export const buildConfirmPlanSummary = (
  plan: DetailedPlanViewModel
): ConfirmPlanSummary => ({
  planId: plan.id,
  title: plan.title,
  periodText: `${plan.period} · ${plan.nights}박 ${plan.days}일`,
  routeText:
    plan.route.length > 0
      ? plan.route
          .map((segment) =>
            segment.nights > 0 ? `${segment.city} ${segment.nights}박` : `${segment.city} 당일`
          )
          .join(" → ")
      : "경로 미정",
  groupCostText: plan.groupCostText,
  perPersonCostText: plan.perPersonCostText,
  needCheckMessages: plan.bookingRisks.map((risk) => risk.message),
});

/**
 * 확정 요청을 실제로 보낼지 판단해요.
 *
 * 확정은 revision 낙관적 락을 사용하므로, 빠른 중복 탭으로 두 요청이 나가면
 * 뒤이은 요청이 ConflictError로 실패해요. 진행 중이거나 이미 확정된 경우 요청을 막아요.
 */
export const canSubmitConfirm = ({
  state,
  isPending,
}: {
  readonly state: CompareConfirmState;
  readonly isPending: boolean;
}): boolean => state.kind === "CONFIRMABLE" && !isPending;
