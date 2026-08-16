import type { CityStay, TripPlan } from "../domain/room.ts";
import { calculatePlanCost, formatCostText } from "./plan-cost.ts";

export interface PlanDifference {
  readonly routeChanges: ReadonlyArray<string>;
  readonly isAccommodationChanged: boolean;
  readonly isTransportChanged: boolean;
  readonly costDifferenceText?: string;
  readonly summaryText: string;
  readonly hasChanges: boolean;
}

export function calculatePlanDifference(
  originalPlan: TripPlan,
  current: {
    readonly title?: string;
    readonly routes?: ReadonlyArray<CityStay>;
    readonly accommodations?: TripPlan["accommodations"];
    readonly transports?: TripPlan["transports"];
    readonly baseHeadcount?: number;
  }
): PlanDifference {
  const routeChanges: string[] = [];

  const originalRoutes = originalPlan.routes ?? [];
  const currentRoutes = current.routes ?? [];

  const originalMap = new Map<string, number>();
  for (const r of originalRoutes) {
    originalMap.set(r.city, (originalMap.get(r.city) ?? 0) + r.nights);
  }

  const currentMap = new Map<string, number>();
  for (const r of currentRoutes) {
    currentMap.set(r.city, (currentMap.get(r.city) ?? 0) + r.nights);
  }

  // 도시별 박수 차이 계산
  for (const [city, currentNights] of currentMap.entries()) {
    const origNights = originalMap.get(city);
    if (origNights === undefined) {
      routeChanges.push(`${city} ${currentNights}박 추가`);
    } else if (currentNights > origNights) {
      routeChanges.push(`${city} +${currentNights - origNights}박`);
    } else if (currentNights < origNights) {
      routeChanges.push(`${city} -${origNights - currentNights}박`);
    }
  }

  for (const [city] of originalMap.entries()) {
    if (!currentMap.has(city)) {
      routeChanges.push(`${city} 제외`);
    }
  }

  // 숙소 변경 여부
  const origAcc = originalPlan.accommodations ?? [];
  const currAcc = current.accommodations ?? [];
  let isAccommodationChanged = origAcc.length !== currAcc.length;
  if (!isAccommodationChanged) {
    for (let i = 0; i < origAcc.length; i++) {
      if (
        origAcc[i]?.hotelName !== currAcc[i]?.hotelName ||
        origAcc[i]?.priceRange?.min !== currAcc[i]?.priceRange?.min ||
        origAcc[i]?.priceRange?.max !== currAcc[i]?.priceRange?.max
      ) {
        isAccommodationChanged = true;
        break;
      }
    }
  }

  // 교통 변경 여부
  const origTrans = originalPlan.transports ?? [];
  const currTrans = current.transports ?? [];
  let isTransportChanged = origTrans.length !== currTrans.length;
  if (!isTransportChanged) {
    for (let i = 0; i < origTrans.length; i++) {
      if (
        origTrans[i]?.mode !== currTrans[i]?.mode ||
        origTrans[i]?.hasTransfer !== currTrans[i]?.hasTransfer ||
        origTrans[i]?.priceRange?.min !== currTrans[i]?.priceRange?.min ||
        origTrans[i]?.priceRange?.max !== currTrans[i]?.priceRange?.max
      ) {
        isTransportChanged = true;
        break;
      }
    }
  }

  // 비용 차이 계산
  const origCost = calculatePlanCost(originalPlan.accommodations, originalPlan.transports, originalPlan.baseHeadcount ?? 4);
  const currCost = calculatePlanCost(current.accommodations, current.transports, current.baseHeadcount ?? 4);

  let costDifferenceText: string | undefined;
  if (origCost.hasCost && currCost.hasCost) {
    const diffMin = currCost.minTotal - origCost.minTotal;
    const diffMax = currCost.maxTotal - origCost.maxTotal;
    if (diffMin !== 0 || diffMax !== 0) {
      if (diffMin === diffMax) {
        const sign = diffMin > 0 ? "+" : "-";
        costDifferenceText = `그룹 총액 ${sign}${formatCostText(Math.abs(diffMin))}`;
      } else {
        const sign = diffMin >= 0 ? "+" : "-";
        costDifferenceText = `그룹 총액 ${sign}${formatCostText(Math.abs(diffMin))} ~ ${diffMax >= 0 ? "+" : "-"}${formatCostText(Math.abs(diffMax))}`;
      }
    }
  }

  const parts: string[] = [...routeChanges];
  if (isAccommodationChanged && routeChanges.length === 0) {
    parts.push("숙소 변경");
  }
  if (isTransportChanged && routeChanges.length === 0 && !isAccommodationChanged) {
    parts.push("교통편 변경");
  }
  if (costDifferenceText) {
    parts.push(costDifferenceText);
  }

  const hasChanges =
    routeChanges.length > 0 ||
    isAccommodationChanged ||
    isTransportChanged ||
    Boolean(costDifferenceText) ||
    current.title !== originalPlan.title;

  const summaryText = parts.length > 0 ? parts.join(" · ") : "원본 여행안과 동일한 구성";

  return {
    routeChanges,
    isAccommodationChanged,
    isTransportChanged,
    costDifferenceText,
    summaryText,
    hasChanges,
  };
}
