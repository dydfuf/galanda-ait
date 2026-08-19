import type { DetailedPlanViewModel } from "../plan-detail/plan-detail-view-model.ts";

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
