import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PageHeader } from "@/components/galanda/page-header.tsx";
import { toContentTopInset } from "@/platform/ait/adapter.ts";

import {
  getTripRoomNavigationTitle,
  getTripRoomSection,
  getTripRoomSectionPath,
} from "./trip-room-navigation.ts";

const PROPERTY_SEED = 0x5afe_065;
const PROPERTY_CASE_COUNT = 128;

interface InsetCase {
  readonly measured: number;
  readonly fallback: number;
}

function createDeterministicGenerator(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function generateInsetCase(index: number, next: () => number): InsetCase {
  const fallback = 1 + next() * 199;
  const magnitude = 0.001 + next() * 199.999;
  const measuredByCategory = [
    magnitude,
    0,
    -magnitude,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  ] as const;

  return {
    measured: measuredByCategory[index % measuredByCategory.length],
    fallback,
  };
}

function formatNumber(value: number): string {
  if (Number.isNaN(value)) return "NaN";
  if (value === Number.POSITIVE_INFINITY) return "Infinity";
  if (value === Number.NEGATIVE_INFINITY) return "-Infinity";
  return String(value);
}

function formatCounterexample(index: number, insetCase: InsetCase): string {
  return [
    `Property 2 counterexample (seed=0x${PROPERTY_SEED.toString(16)}, case=${index})`,
    `measured=${formatNumber(insetCase.measured)}`,
    `fallback=${formatNumber(insetCase.fallback)}`,
  ].join(", ");
}

function assertWithCounterexample(
  counterexample: string,
  assertion: () => void,
): void {
  try {
    assertion();
  } catch (error) {
    if (error instanceof Error) {
      error.message = `${counterexample}\n${error.message}`;
    }
    throw error;
  }
}

describe("Trip Room mode navigation", () => {
  it("derives the mode from the URL and builds safe section paths", () => {
    expect(getTripRoomSection("/trips/trip-1/plans")).toBe("plans");
    expect(getTripRoomSection("/trips/trip-1/itinerary")).toBe("itinerary");
    expect(getTripRoomSectionPath("trip-1", "itinerary")).toBe(
      "/trips/trip-1/itinerary",
    );
    expect(getTripRoomSectionPath("trip-1", "unknown")).toBe(
      "/trips/trip-1/plans",
    );
  });

  it("resolves the Web PageHeader title from the current Trip Room route", () => {
    expect(getTripRoomNavigationTitle("/trips/trip-1/plans")).toBe("여행방");
    expect(getTripRoomNavigationTitle("/trips/trip-1/itinerary")).toBe(
      "여행방",
    );
    expect(getTripRoomNavigationTitle("/trips/trip-1/itinerary/edit")).toBe(
      "일정 수정",
    );
    expect(getTripRoomNavigationTitle("/trips/trip-1/plans/new/basic")).toBe(
      "새 여행안",
    );
    expect(getTripRoomNavigationTitle("/trips/trip-1/plans/compare")).toBe(
      "여행안 비교",
    );
    expect(getTripRoomNavigationTitle("/trips/trip-1/plans/plan-1/edit")).toBe(
      "여행안 수정",
    );
    expect(getTripRoomNavigationTitle("/trips/trip-1/plans/plan-1")).toBe(
      "여행안 상세",
    );
  });
});

describe("Native content inset", () => {
  // **Validates: Requirements 5.4, 6.5**
  it("Feature: toss-liquid-glass-ui-refresh, Property 2: Native Content Inset 정규화", () => {
    const next = createDeterministicGenerator(PROPERTY_SEED);

    for (let index = 0; index < PROPERTY_CASE_COUNT; index += 1) {
      const insetCase = generateInsetCase(index, next);
      const expected =
        Number.isFinite(insetCase.measured) && insetCase.measured > 0
          ? insetCase.measured
          : insetCase.fallback;

      const counterexample = formatCounterexample(index, insetCase);
      assertWithCounterexample(counterexample, () => {
        expect(toContentTopInset(insetCase.measured, insetCase.fallback)).toBe(
          expected,
        );
      });
    }
  });

  it("applies the resolved native inset once without adding Web safe-top", () => {
    const resolvedInset = toContentTopInset(Number.NaN, 54);
    const markup = renderToStaticMarkup(
      createElement(PageHeader, {
        safeTop: false,
        title: "여행방",
        topInset: resolvedInset,
      }),
    );

    expect(markup).toContain('style="padding-top:54px"');
    expect(markup.split("padding-top:")).toHaveLength(2);
    expect(markup).not.toContain("pt-(--safe-top)");
  });
});
