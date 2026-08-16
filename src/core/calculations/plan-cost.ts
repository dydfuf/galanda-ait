import type { AccommodationSnapshot, TransportSnapshot } from "../domain/room.ts";

export interface PlanCostSummary {
  readonly minTotal: number;
  readonly maxTotal: number;
  readonly hasCost: boolean;
  readonly isRange: boolean;
  readonly unpricedCount: number;
  readonly baseHeadcount: number;
  readonly minPerPerson: number;
  readonly maxPerPerson: number;
}

export function calculatePlanCost(
  accommodations: ReadonlyArray<AccommodationSnapshot> | undefined,
  transports: ReadonlyArray<TransportSnapshot> | undefined,
  baseHeadcount: number = 4
): PlanCostSummary {
  const safeHeadcount = Math.max(1, baseHeadcount);
  let minTotal = 0;
  let maxTotal = 0;
  let unpricedCount = 0;
  let hasPricedItem = false;

  if (accommodations) {
    for (const acc of accommodations) {
      if (acc.priceRange && (acc.priceRange.min > 0 || acc.priceRange.max > 0)) {
        minTotal += acc.priceRange.min;
        maxTotal += acc.priceRange.max;
        hasPricedItem = true;
      } else {
        unpricedCount += 1;
      }
    }
  }

  if (transports) {
    for (const trans of transports) {
      if (trans.priceRange && (trans.priceRange.min > 0 || trans.priceRange.max > 0)) {
        minTotal += trans.priceRange.min;
        maxTotal += trans.priceRange.max;
        hasPricedItem = true;
      } else {
        unpricedCount += 1;
      }
    }
  }

  const isRange = minTotal !== maxTotal;
  const minPerPerson = Math.round(minTotal / safeHeadcount);
  const maxPerPerson = Math.round(maxTotal / safeHeadcount);

  return {
    minTotal,
    maxTotal,
    hasCost: hasPricedItem,
    isRange,
    unpricedCount,
    baseHeadcount: safeHeadcount,
    minPerPerson,
    maxPerPerson,
  };
}

export function formatCostText(amount: number): string {
  if (amount <= 0) return "0원";
  if (amount >= 100000000) {
    const eok = Math.floor(amount / 100000000);
    const man = Math.floor((amount % 100000000) / 10000);
    return man > 0 ? `${eok}억 ${man}만원` : `${eok}억원`;
  }
  if (amount >= 10000) {
    const man = Math.floor(amount / 10000);
    const remainder = amount % 10000;
    return remainder > 0 ? `${man}만 ${remainder.toLocaleString()}원` : `${man}만원`;
  }
  return `${amount.toLocaleString()}원`;
}

export function formatCostRangeText(min: number, max: number): string {
  if (min === 0 && max === 0) return "가격 미정";
  if (min === max) return formatCostText(min);
  return `${formatCostText(min)} ~ ${formatCostText(max)}`;
}
