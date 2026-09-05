import type { DetailedPlanViewModel } from "../plan-detail/plan-detail-view-model.ts";
import { REACTION_DISPLAY, type ReactionDisplayKey } from "../common/reaction-display.tsx";
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
  readonly explanationText?: string;
}

export interface PlanCompareRow extends PlanCompareDifference {
  readonly isChanged: boolean;
}

export interface CompareParticipant {
  readonly id: string;
  readonly name: string;
}

export interface CompareOpinionSummary {
  readonly bothRespondedCount: number;
  readonly eligibleParticipantCount: number;
  readonly responseText: string;
  readonly nonRespondentNames: ReadonlyArray<string>;
  readonly nonRespondentText: string;
  readonly limitationText?: string;
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

const formatBookingStatus = (
  status: "AVAILABLE" | "NEED_CHECK" | "FULL" | "SEARCHING"
): string => {
  switch (status) {
    case "FULL":
      return "예약 불가";
    case "NEED_CHECK":
      return "확인 필요";
    case "SEARCHING":
      return "아직 확인 전";
    default:
      return "예약 가능";
  }
};

const formatBookingItem = (
  item: DetailedPlanViewModel["timelineItems"][number]
): string | undefined => {
  if (item.type === "STAY" && item.stay) {
    if (item.stay.bookingStatus === "AVAILABLE") return undefined;
    return `숙소 ${item.stay.city} · ${item.stay.period} · ${item.stay.nights}박 · ${item.stay.hotelName} · ${formatBookingStatus(item.stay.bookingStatus)}`;
  }

  if (item.type === "TRANSPORT" && item.transport) {
    if (item.transport.bookingStatus === "AVAILABLE") return undefined;
    return `이동 ${item.transport.fromCity} → ${item.transport.toCity} · ${item.transport.mode} · ${item.transport.hasTransfer ? "환승 필요" : "직통"} · ${item.transport.durationText} · ${formatBookingStatus(item.transport.bookingStatus)}`;
  }

  return undefined;
};

const formatBooking = (plan: DetailedPlanViewModel): string => {
  if (plan.bookingRisks.length === 0) return "확인 필요 0건";

  const hasDanger = plan.bookingRisks.some((risk) => risk.level === "DANGER");
  const riskDetails = plan.bookingRisks.map((risk) => risk.message).join(" · ");
  const bookingDetails = plan.timelineItems
    .map(formatBookingItem)
    .filter((detail): detail is string => detail !== undefined)
    .join(" · ");
  return `${plan.bookingRisks.length}건 확인 필요${hasDanger ? " · 예약 불가 포함" : ""} · ${riskDetails}${bookingDetails ? ` · ${bookingDetails}` : ""}`;
};

const bookingSignature = (plan: DetailedPlanViewModel): string =>
  JSON.stringify({
    risks: plan.bookingRisks.map((risk) => [risk.level, risk.message]),
    items:
      plan.bookingRisks.length === 0
        ? []
        : plan.timelineItems
            .map(formatBookingItem)
            .filter((signature): signature is string => signature !== undefined),
  });

const formatOpinions = (plan: DetailedPlanViewModel): string => {
  const total = plan.opinions.likeCount + plan.opinions.okayCount + plan.opinions.hardCount;
  if (total === 0) return "아직 의견 없음";

  // 표시 순서와 한글 label은 REACTION_DISPLAY가 단일 출처다. 비교 행의 조합 문구는 그대로 유지한다.
  const counts: Record<ReactionDisplayKey, number> = {
    LIKE: plan.opinions.likeCount,
    OKAY: plan.opinions.okayCount,
    HARD: plan.opinions.hardCount,
  };

  return REACTION_DISPLAY.map(({ key, label }) => `${label} ${counts[key]}`).join(" · ");
};

const opinionSignature = (plan: DetailedPlanViewModel): string =>
  JSON.stringify(
    plan.memberOpinions
      .map(({ userId, reaction }) => [userId, reaction])
      .sort(([leftId], [rightId]) => leftId.localeCompare(rightId)),
  );

const formatCost = (plan: DetailedPlanViewModel): string =>
  plan.costSummary.hasCost
    ? `1인 ${formatCostRangeText(plan.costSummary.minPerPerson, plan.costSummary.maxPerPerson, plan.costSummary.unpricedCount)}`
    : "예상 경비 미정";

const formatCostDelta = (
  leftPlanLabel: string,
  rightPlanLabel: string,
  left: DetailedPlanViewModel["costSummary"],
  right: DetailedPlanViewModel["costSummary"]
): string | undefined => {
  if (!left.hasCost || !right.hasCost || left.unpricedCount > 0 || right.unpricedCount > 0) {
    return undefined;
  }

  const minDelta = right.minPerPerson - left.minPerPerson;
  const maxDelta = right.maxPerPerson - left.maxPerPerson;
  if (minDelta === 0 && maxDelta === 0) return undefined;

  if ((minDelta < 0 && maxDelta > 0) || (minDelta > 0 && maxDelta < 0)) {
    return "두 안의 1인 비용 범위가 겹쳐요.";
  }

  const minAmount = Math.min(Math.abs(minDelta), Math.abs(maxDelta));
  const maxAmount = Math.max(Math.abs(minDelta), Math.abs(maxDelta));
  const amount =
    minAmount === maxAmount
      ? formatCostText(minAmount)
      : `${formatCostText(minAmount)} ~ ${formatCostText(maxAmount)}`;
  const cheaperPlanLabel = minDelta > 0 ? leftPlanLabel : rightPlanLabel;
  return `${cheaperPlanLabel}이 1인 기준 ${amount} 저렴해요.`;
};

const formatHardOpinionText = (plan: DetailedPlanViewModel): string =>
  plan.opinions.hardCount > 0
    ? `${plan.planTagLabel}에는 어려워요 의견 ${plan.opinions.hardCount}개가 있어요.`
    : `${plan.planTagLabel}에는 어려워요 의견이 없어요.`;

const formatNonRespondentText = (
  names: ReadonlyArray<string>,
): string =>
  names.length > 0
    ? `비교 쌍 미응답자: ${names.join(", ")}`
    : "비교 쌍 미응답자 없음";

export const buildCompareOpinionSummary = (
  left: DetailedPlanViewModel,
  right: DetailedPlanViewModel,
  participants: ReadonlyArray<CompareParticipant>,
): CompareOpinionSummary => {
  const eligibleIds = new Set(participants.map(({ id }) => id));
  const leftRespondentIds = new Set(
    left.memberOpinions
      .map(({ userId }) => userId)
      .filter((id) => eligibleIds.has(id)),
  );
  const rightRespondentIds = new Set(
    right.memberOpinions
      .map(({ userId }) => userId)
      .filter((id) => eligibleIds.has(id)),
  );
  const bothRespondedIds = new Set(
    [...leftRespondentIds].filter((id) => rightRespondentIds.has(id)),
  );
  const nonRespondentNames = participants
    .filter(({ id }) => !bothRespondedIds.has(id))
    .map(({ name }) => name);
  const unattributedOpinionCount =
    left.unattributedOpinionCount + right.unattributedOpinionCount;

  return {
    bothRespondedCount: bothRespondedIds.size,
    eligibleParticipantCount: participants.length,
    responseText:
      participants.length > 0
        ? `두 안을 모두 평가한 사람 ${bothRespondedIds.size}/${participants.length}명`
        : "응답 가능한 회원이 없어요",
    nonRespondentNames,
    nonRespondentText: formatNonRespondentText(nonRespondentNames),
    limitationText:
      unattributedOpinionCount > 0
        ? `회원과 연결되지 않은 과거 의견 ${unattributedOpinionCount}개는 비교 응답률에서 제외했어요.`
        : undefined,
  };
};

const makeRow = ({
  kind,
  label,
  left,
  right,
  leftValue,
  rightValue,
  isChanged,
  deltaText,
  explanationText,
}: {
  readonly kind: CompareDifferenceKind;
  readonly label: string;
  readonly left: DetailedPlanViewModel;
  readonly right: DetailedPlanViewModel;
  readonly leftValue: string;
  readonly rightValue: string;
  readonly isChanged: boolean;
  readonly deltaText?: string;
  readonly explanationText?: string;
}): PlanCompareRow => ({
  kind,
  label,
  leftPlanLabel: left.planTagLabel,
  leftValue,
  rightPlanLabel: right.planTagLabel,
  rightValue,
  deltaText,
  explanationText,
  isChanged,
});

export const buildPlanCompareRows = (
  left: DetailedPlanViewModel,
  right: DetailedPlanViewModel,
  participants: ReadonlyArray<CompareParticipant> = [],
): ReadonlyArray<PlanCompareRow> => {
  const opinionSummary = buildCompareOpinionSummary(left, right, participants);
  const bookingChanged = bookingSignature(left) !== bookingSignature(right);
  const bookingCountDelta = right.bookingRisks.length - left.bookingRisks.length;
  const bookingExplanation =
    bookingCountDelta === 0
      ? "두 안의 예약 확인 대상이 서로 달라요."
      : `${bookingCountDelta > 0 ? right.planTagLabel : left.planTagLabel}은 예약 ${Math.abs(bookingCountDelta)}건을 더 확인해야 해요.`;

  return [
    makeRow({
      kind: "OPINIONS",
      label: "그룹 의견·어려운 조건",
      left,
      right,
      leftValue: formatOpinions(left),
      rightValue: formatOpinions(right),
      // 비교 쌍 응답률은 집계 수가 같아도 항상 확인할 근거다.
      isChanged:
        participants.length > 0 || opinionSignature(left) !== opinionSignature(right),
      explanationText: [
        `${opinionSummary.responseText}.`,
        opinionSummary.limitationText,
        formatHardOpinionText(left),
        formatHardOpinionText(right),
      ]
        .filter((text): text is string => Boolean(text))
        .join(" "),
    }),
    makeRow({
      kind: "SCHEDULE",
      label: "날짜·경로",
      left,
      right,
      leftValue: formatSchedule(left),
      rightValue: formatSchedule(right),
      isChanged:
        left.period !== right.period ||
        left.nights !== right.nights ||
        left.days !== right.days ||
        !areRoutesEqual(left.route, right.route),
    }),
    makeRow({
      kind: "COST",
      label: "1인 비용",
      left,
      right,
      leftValue: formatCost(left),
      rightValue: formatCost(right),
      isChanged:
        left.costSummary.hasCost !== right.costSummary.hasCost ||
        left.costSummary.unpricedCount !== right.costSummary.unpricedCount ||
        left.costSummary.minPerPerson !== right.costSummary.minPerPerson ||
        left.costSummary.maxPerPerson !== right.costSummary.maxPerPerson,
      deltaText: formatCostDelta(
        left.planTagLabel,
        right.planTagLabel,
        left.costSummary,
        right.costSummary,
      ),
    }),
    makeRow({
      kind: "BOOKING",
      label: "예약 확인",
      left,
      right,
      leftValue: formatBooking(left),
      rightValue: formatBooking(right),
      isChanged: bookingChanged,
      explanationText: bookingChanged ? bookingExplanation : undefined,
    }),
  ];
};

export const buildPlanCompareDifferences = (
  left: DetailedPlanViewModel,
  right: DetailedPlanViewModel,
  participants: ReadonlyArray<CompareParticipant> = [],
): ReadonlyArray<PlanCompareDifference> => {
  return buildPlanCompareRows(left, right, participants)
    .filter(({ isChanged }) => isChanged)
    .map(({ isChanged: _isChanged, ...difference }) => difference);
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
  readonly comparisonResponseText?: string;
  readonly comparisonNonRespondentText?: string;
  readonly comparisonLimitationText?: string;
  readonly hardOpinionText: string;
  readonly needCheckMessages: ReadonlyArray<string>;
}

export const buildConfirmPlanSummary = (
  plan: DetailedPlanViewModel,
  comparison?: CompareOpinionSummary,
): ConfirmPlanSummary => ({
  planId: plan.id,
  title: plan.title,
  periodText: `${plan.period} · ${plan.nights}박 ${plan.days}일`,
  routeText:
    plan.route.length > 0
      ? plan.route
          .map((segment) =>
            segment.nights > 0
              ? `${segment.city} ${segment.nights}박`
              : `${segment.city} 당일`,
          )
          .join(" → ")
      : "경로 미정",
  groupCostText: plan.costSummary.hasCost
    ? plan.groupCostText
    : "예상 경비 미정",
  perPersonCostText: plan.costSummary.hasCost
    ? plan.perPersonCostText
    : "1인 예상 경비 미정",
  comparisonResponseText: comparison?.responseText,
  comparisonNonRespondentText: comparison?.nonRespondentText,
  comparisonLimitationText: comparison?.limitationText,
  hardOpinionText:
    plan.opinions.hardCount > 0
      ? `어려워요 의견 ${plan.opinions.hardCount}개가 있어요.`
      : "어려워요 의견이 없어요.",
  needCheckMessages: plan.bookingRisks.map((risk) => risk.message),
});

/**
 * 확정 요청을 실제로 보낼지 판단해요.
 *
 * 확정 요청은 revision 낙관적 락을 사용해요. 중복 요청은 읽기/저장 타이밍에 따라
 * RevisionConflictError 또는 이미 확정된 상태를 나타내는 StateConflictError로 실패할 수 있어요.
 * UI에서는 진행 중이거나 이미 확정된 경우 요청 자체를 막아요.
 */
export const canSubmitConfirm = ({
  state,
  isPending,
}: {
  readonly state: CompareConfirmState;
  readonly isPending: boolean;
}): boolean => state.kind === "CONFIRMABLE" && !isPending;
