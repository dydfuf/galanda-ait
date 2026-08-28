import { describe, expect, it } from "vitest";

import { formatCostRangeText } from "../../../core/calculations/plan-cost.ts";
import {
  PlanIdSchema,
  RevisionSchema,
  TripIdSchema,
  UserIdSchema,
} from "../../../core/domain/ids.ts";
import type {
  AccommodationSnapshot,
  TransportSnapshot,
  TripRoom,
} from "../../../core/domain/room.ts";
import { toPlanDetailViewModel } from "../plan-detail-view-model.ts";

const PROPERTY_SEED = 0x9a10_0c3;
const PROPERTY_CASE_COUNT = 128;

type PriceCaseMode =
  | "all-unpriced"
  | "mixed"
  | "all-zero"
  | "all-priced";
type PriceRange = NonNullable<AccommodationSnapshot["priceRange"]>;

interface PlanPriceCase {
  readonly mode: PriceCaseMode;
  readonly accommodations: ReadonlyArray<AccommodationSnapshot>;
  readonly transports: ReadonlyArray<TransportSnapshot>;
}

function createDeterministicGenerator(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function generatePositivePriceRange(next: () => number): PriceRange {
  const min = (1 + Math.floor(next() * 80)) * 5_000;
  return {
    min,
    max: min + Math.floor(next() * 9) * 5_000,
  };
}

function generatePriceRange(
  mode: PriceCaseMode,
  itemIndex: number,
  next: () => number,
): PriceRange | undefined {
  switch (mode) {
    case "all-unpriced":
      return undefined;
    case "mixed":
      if (itemIndex === 0) return undefined;
      if (itemIndex === 1) return generatePositivePriceRange(next);
      return next() < 0.45
        ? undefined
        : next() < 0.25
          ? { min: 0, max: 0 }
          : generatePositivePriceRange(next);
    case "all-zero":
      return { min: 0, max: 0 };
    case "all-priced":
      return generatePositivePriceRange(next);
  }
}

function generatePlanPriceCase(
  caseIndex: number,
  next: () => number,
): PlanPriceCase {
  const modes: ReadonlyArray<PriceCaseMode> = [
    "all-unpriced",
    "mixed",
    "all-zero",
    "all-priced",
  ];
  const mode = modes[caseIndex % modes.length];
  const accommodationCount = 1 + Math.floor(next() * 4);
  const transportCount = 1 + Math.floor(next() * 4);
  const accommodations = Array.from(
    { length: accommodationCount },
    (_, itemIndex): AccommodationSnapshot => {
      const priceRange = generatePriceRange(mode, itemIndex, next);
      return {
        id: `property-stay-${caseIndex}-${itemIndex}`,
        city: `숙박 도시 ${caseIndex}-${itemIndex}`,
        period: "2027-01-01 ~ 2027-01-02",
        nights: 1,
        hotelName: `숙소 ${caseIndex}-${itemIndex}`,
        bookingStatus: "AVAILABLE",
        ...(priceRange ? { priceRange } : {}),
      };
    },
  );
  const transports = Array.from(
    { length: transportCount },
    (_, transportIndex): TransportSnapshot => {
      const itemIndex = accommodationCount + transportIndex;
      const priceRange = generatePriceRange(mode, itemIndex, next);
      return {
        id: `property-transport-${caseIndex}-${transportIndex}`,
        fromCity: `출발 ${caseIndex}-${transportIndex}`,
        toCity: `도착 ${caseIndex}-${transportIndex}`,
        mode: "기차",
        hasTransfer: false,
        durationText: "1시간",
        bookingStatus: "AVAILABLE",
        ...(priceRange ? { priceRange } : {}),
      };
    },
  );

  return { mode, accommodations, transports };
}

function createRoom(caseIndex: number, propertyCase: PlanPriceCase): TripRoom {
  const hostId = UserIdSchema.make(`property-price-host-${caseIndex}`);
  return {
    id: TripIdSchema.make(`property-price-room-${caseIndex}`),
    title: `가격 속성 여행 ${caseIndex}`,
    destination: `목적지 ${caseIndex}`,
    revision: RevisionSchema.make(1),
    members: [{ id: hostId, name: "방장", role: "HOST" }],
    plans: [
      {
        id: PlanIdSchema.make(`property-price-plan-${caseIndex}`),
        title: `가격 속성 여행안 ${caseIndex}`,
        status: "DRAFT",
        authorId: hostId,
        authorName: "방장",
        baseHeadcount: 1 + (caseIndex % 8),
        accommodations: propertyCase.accommodations,
        transports: propertyCase.transports,
        places: [],
        voteCount: 0,
      },
    ],
  };
}

function formatCounterexample(
  caseIndex: number,
  propertyCase: PlanPriceCase,
): string {
  return [
    `Property 3 counterexample (seed=0x${PROPERTY_SEED.toString(16)}, case=${caseIndex})`,
    `mode=${propertyCase.mode}`,
    JSON.stringify({
      accommodations: propertyCase.accommodations.map(({ id, priceRange }) => ({
        id,
        priceRange,
      })),
      transports: propertyCase.transports.map(({ id, priceRange }) => ({
        id,
        priceRange,
      })),
    }),
  ].join(", ");
}

describe("Plan Detail price properties", (): void => {
  // **Validates: Requirements 9.10, 9.12**
  it("Feature: toss-liquid-glass-ui-refresh, Property 3: 미정 가격의 보존", (): void => {
    const next = createDeterministicGenerator(PROPERTY_SEED);

    for (let caseIndex = 0; caseIndex < PROPERTY_CASE_COUNT; caseIndex += 1) {
      const propertyCase = generatePlanPriceCase(caseIndex, next);
      const sourceItems = [
        ...propertyCase.accommodations,
        ...propertyCase.transports,
      ];
      const expectedUnpricedCount = sourceItems.filter(
        ({ priceRange }) => priceRange === undefined,
      ).length;
      const pricedRanges = sourceItems.flatMap(({ priceRange }) =>
        priceRange ? [priceRange] : [],
      );
      const expectedMinTotal = pricedRanges.reduce(
        (total, { min }) => total + min,
        0,
      );
      const expectedMaxTotal = pricedRanges.reduce(
        (total, { max }) => total + max,
        0,
      );
      const hasExplicitZero = pricedRanges.some(
        ({ min, max }) => min === 0 && max === 0,
      );
      const counterexample = formatCounterexample(caseIndex, propertyCase);
      const plan = toPlanDetailViewModel(
        createRoom(caseIndex, propertyCase),
      ).plans[0];

      const hasPricedItem = pricedRanges.length > 0;
      const expectedRangeText = hasPricedItem
        ? formatCostRangeText(
            expectedMinTotal,
            expectedMaxTotal,
            expectedUnpricedCount,
          )
        : null;
      const expectedGroupCostText = expectedRangeText
        ? `${expectedUnpricedCount > 0 ? "확인된 그룹 금액" : "그룹 총액"} ${expectedRangeText}`
        : "가격 미정";
      const pendingText = `가격 미정 ${expectedUnpricedCount}건 별도`;
      const isZeroOnlyPricedTotal =
        hasExplicitZero && expectedMinTotal === 0 && expectedMaxTotal === 0;

      expect({
        counterexample,
        unpricedCount: plan.costSummary.unpricedCount,
        hasCost: plan.costSummary.hasCost,
        minTotal: hasPricedItem ? plan.costSummary.minTotal : null,
        maxTotal: hasPricedItem ? plan.costSummary.maxTotal : null,
        groupCostText: plan.groupCostText,
        allUnpricedPersonText: hasPricedItem
          ? null
          : plan.perPersonCostText,
        allUnpricedExcludesZero: hasPricedItem
          ? null
          : !plan.groupCostText.includes("0원"),
        mixedGroupPendingVisible:
          hasPricedItem && expectedUnpricedCount > 0
            ? plan.groupCostText.includes(pendingText)
            : null,
        mixedPersonPendingVisible:
          hasPricedItem && expectedUnpricedCount > 0
            ? plan.perPersonCostText.includes(pendingText)
            : null,
        explicitZeroHasCost: isZeroOnlyPricedTotal
          ? plan.costSummary.hasCost
          : null,
        explicitZeroVisible: isZeroOnlyPricedTotal
          ? plan.groupCostText.includes("0원")
          : null,
        explicitZeroIsNotUnknown: isZeroOnlyPricedTotal
          ? plan.groupCostText !== "가격 미정"
          : null,
      }).toEqual({
        counterexample,
        unpricedCount: expectedUnpricedCount,
        hasCost: hasPricedItem,
        minTotal: hasPricedItem ? expectedMinTotal : null,
        maxTotal: hasPricedItem ? expectedMaxTotal : null,
        groupCostText: expectedGroupCostText,
        allUnpricedPersonText: hasPricedItem ? null : "가격 미정",
        allUnpricedExcludesZero: hasPricedItem ? null : true,
        mixedGroupPendingVisible:
          hasPricedItem && expectedUnpricedCount > 0 ? true : null,
        mixedPersonPendingVisible:
          hasPricedItem && expectedUnpricedCount > 0 ? true : null,
        explicitZeroHasCost: isZeroOnlyPricedTotal ? true : null,
        explicitZeroVisible: isZeroOnlyPricedTotal ? true : null,
        explicitZeroIsNotUnknown: isZeroOnlyPricedTotal ? true : null,
      });
    }
  });
});
