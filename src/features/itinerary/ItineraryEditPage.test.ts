import { describe, expect, it } from "vitest";
import type { ItineraryItemPatch } from "../../core/domain/confirmed-itinerary.ts";
import {
  getChangedItineraryPatches,
  getItineraryEditorValidation,
  rebaseItineraryPatches,
} from "./itinerary-editor-state.ts";

const PROPERTY_4_SEED = 0x5afe_099;
const PROPERTY_4_CASE_COUNT = 128;

type StayPatch = Extract<ItineraryItemPatch, { readonly type: "STAY" }>;
type TransportPatch = Extract<
  ItineraryItemPatch,
  { readonly type: "TRANSPORT" }
>;

interface ItineraryRebaseCase {
  readonly base: ReadonlyArray<ItineraryItemPatch>;
  readonly local: ReadonlyArray<ItineraryItemPatch>;
  readonly latest: ReadonlyArray<ItineraryItemPatch>;
}

function createDeterministicGenerator(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function rotate<T>(values: ReadonlyArray<T>, offset: number): T[] {
  if (values.length === 0) return [];
  const normalizedOffset = offset % values.length;
  return [
    ...values.slice(normalizedOffset),
    ...values.slice(0, normalizedOffset),
  ];
}

function generateStayPatches(
  caseIndex: number,
  itemIndex: number,
  changeOffset: number,
  hasLocalChanges: boolean,
  entropy: number,
): readonly [StayPatch, StayPatch, StayPatch] {
  const itemId = `property-4-stay-${caseIndex}-${itemIndex}`;
  const shouldChange = (fieldIndex: number): boolean =>
    hasLocalChanges && (fieldIndex + changeOffset) % 2 === 0;
  const base: StayPatch = {
    type: "STAY",
    itemId,
    date: "2027-01-01",
    endDate: "2027-10-01",
    hotelName: `기준 숙소 ${entropy}`,
    memo: `기준 메모 ${entropy}`,
  };
  const local: StayPatch = {
    ...base,
    date: shouldChange(0) ? "2027-02-02" : base.date,
    endDate: shouldChange(1) ? "2027-11-02" : base.endDate,
    hotelName: shouldChange(2) ? `내 숙소 ${entropy}` : base.hotelName,
    memo: shouldChange(3) ? `내 메모 ${entropy}` : base.memo,
  };
  const latest: StayPatch = {
    ...base,
    date: "2027-03-03",
    endDate: "2027-12-03",
    hotelName: `최신 숙소 ${entropy}`,
    memo: `최신 메모 ${entropy}`,
  };

  return [base, local, latest];
}

function generateTransportPatches(
  caseIndex: number,
  itemIndex: number,
  changeOffset: number,
  hasLocalChanges: boolean,
  entropy: number,
): readonly [TransportPatch, TransportPatch, TransportPatch] {
  const itemId = `property-4-transport-${caseIndex}-${itemIndex}`;
  const shouldChange = (fieldIndex: number): boolean =>
    hasLocalChanges && (fieldIndex + changeOffset) % 2 === 0;
  const base: TransportPatch = {
    type: "TRANSPORT",
    itemId,
    date: "2027-01-01",
    fromCity: `기준 출발지 ${entropy}`,
    toCity: `기준 도착지 ${entropy}`,
    mode: `기준 수단 ${entropy}`,
    memo: `기준 메모 ${entropy}`,
  };
  const local: TransportPatch = {
    ...base,
    date: shouldChange(0) ? "2027-02-02" : base.date,
    fromCity: shouldChange(1) ? `내 출발지 ${entropy}` : base.fromCity,
    toCity: shouldChange(2) ? `내 도착지 ${entropy}` : base.toCity,
    mode: shouldChange(3) ? `내 수단 ${entropy}` : base.mode,
    memo: shouldChange(4) ? `내 메모 ${entropy}` : base.memo,
  };
  const latest: TransportPatch = {
    ...base,
    date: "2027-03-03",
    fromCity: `최신 출발지 ${entropy}`,
    toCity: `최신 도착지 ${entropy}`,
    mode: `최신 수단 ${entropy}`,
    memo: `최신 메모 ${entropy}`,
  };

  return [base, local, latest];
}

function generateItineraryRebaseCase(
  caseIndex: number,
  next: () => number,
): ItineraryRebaseCase {
  const itemCount = 1 + Math.floor(next() * 5);
  const generated = Array.from({ length: itemCount }, (_, itemIndex) => {
    const entropy = Math.floor(next() * 1_000_000);
    const useStay = (caseIndex + itemIndex + Math.floor(next() * 2)) % 2 === 0;
    const fieldCount = useStay ? 4 : 5;
    const changeOffset = Math.floor(next() * fieldCount);
    const hasLocalChanges =
      itemIndex === 0 || (caseIndex + itemIndex) % 4 !== 0;

    return useStay
      ? generateStayPatches(
          caseIndex,
          itemIndex,
          changeOffset,
          hasLocalChanges,
          entropy,
        )
      : generateTransportPatches(
          caseIndex,
          itemIndex,
          changeOffset,
          hasLocalChanges,
          entropy,
        );
  });
  const base = generated.map(([patch]) => patch);
  const local = generated.map(([, patch]) => patch);
  const latest = generated.map(([, , patch]) => patch);

  return {
    base: rotate(base, Math.floor(next() * itemCount)),
    local: rotate(local, Math.floor(next() * itemCount)),
    latest: rotate(latest, Math.floor(next() * itemCount)),
  };
}

function selectRebasedValue<T>(base: T, local: T, latest: T): T {
  return Object.is(base, local) ? latest : local;
}

function getExpectedRebasedPatch(
  base: ItineraryItemPatch,
  local: ItineraryItemPatch,
  latest: ItineraryItemPatch,
): ItineraryItemPatch {
  if (
    base.itemId !== latest.itemId ||
    local.itemId !== latest.itemId ||
    base.type !== latest.type ||
    local.type !== latest.type
  ) {
    throw new Error("Property 4 generated an incompatible patch fixture.");
  }

  if (latest.type === "STAY") {
    if (base.type !== "STAY" || local.type !== "STAY") {
      throw new Error("Property 4 generated mismatched stay patch types.");
    }
    return {
      type: "STAY",
      itemId: latest.itemId,
      date: selectRebasedValue(base.date, local.date, latest.date),
      endDate: selectRebasedValue(base.endDate, local.endDate, latest.endDate),
      hotelName: selectRebasedValue(
        base.hotelName,
        local.hotelName,
        latest.hotelName,
      ),
      memo: selectRebasedValue(base.memo, local.memo, latest.memo),
    };
  }

  if (base.type !== "TRANSPORT" || local.type !== "TRANSPORT") {
    throw new Error("Property 4 generated mismatched transport patch types.");
  }
  return {
    type: "TRANSPORT",
    itemId: latest.itemId,
    date: selectRebasedValue(base.date, local.date, latest.date),
    fromCity: selectRebasedValue(
      base.fromCity,
      local.fromCity,
      latest.fromCity,
    ),
    toCity: selectRebasedValue(base.toCity, local.toCity, latest.toCity),
    mode: selectRebasedValue(base.mode, local.mode, latest.mode),
    memo: selectRebasedValue(base.memo, local.memo, latest.memo),
  };
}

function getExpectedRebasedPatches(
  propertyCase: ItineraryRebaseCase,
): ItineraryItemPatch[] {
  return propertyCase.latest.map((latestPatch) => {
    const basePatch = propertyCase.base.find(
      ({ itemId }) => itemId === latestPatch.itemId,
    );
    const localPatch = propertyCase.local.find(
      ({ itemId }) => itemId === latestPatch.itemId,
    );
    if (!basePatch || !localPatch) {
      throw new Error("Property 4 generated an incompatible identity fixture.");
    }
    return getExpectedRebasedPatch(basePatch, localPatch, latestPatch);
  });
}

function formatProperty4Counterexample(
  caseIndex: number,
  propertyCase: ItineraryRebaseCase,
): string {
  return [
    `Property 4 counterexample (seed=0x${PROPERTY_4_SEED.toString(16)}, case=${caseIndex})`,
    JSON.stringify(propertyCase),
  ].join(", ");
}

describe("itinerary conflict recovery", () => {
  it("keeps a local field edit without overwriting another user's field", () => {
    const base: ItineraryItemPatch[] = [
      {
        type: "STAY",
        itemId: "stay-1",
        date: "2026-09-01",
        endDate: "2026-09-03",
        hotelName: "Hotel A",
        memo: "base memo",
      },
    ];
    const local = [
      { ...base[0]!, hotelName: "Hotel Local" },
    ] as ItineraryItemPatch[];
    const latest = [
      { ...base[0]!, memo: "remote memo" },
    ] as ItineraryItemPatch[];

    const rebased = rebaseItineraryPatches(base, local, latest);

    expect(rebased[0]).toMatchObject({
      hotelName: "Hotel Local",
      memo: "remote memo",
    });
    expect(getChangedItineraryPatches(latest, rebased)).toEqual([
      expect.objectContaining({
        hotelName: "Hotel Local",
        memo: "remote memo",
      }),
    ]);
  });

  // **Validates: Requirements 9.9, 9.11, 11.5**
  it("Feature: toss-liquid-glass-ui-refresh, Property 4: Revision Conflict Three-Way Rebase", () => {
    const next = createDeterministicGenerator(PROPERTY_4_SEED);

    for (let caseIndex = 0; caseIndex < PROPERTY_4_CASE_COUNT; caseIndex += 1) {
      const propertyCase = generateItineraryRebaseCase(caseIndex, next);
      const counterexample = formatProperty4Counterexample(
        caseIndex,
        propertyCase,
      );
      const expected = getExpectedRebasedPatches(propertyCase);
      const rebased = rebaseItineraryPatches(
        propertyCase.base,
        propertyCase.local,
        propertyCase.latest,
      );
      const expectedChanged = expected.filter((expectedPatch) => {
        const latestPatch = propertyCase.latest.find(
          ({ itemId }) => itemId === expectedPatch.itemId,
        );
        return JSON.stringify(expectedPatch) !== JSON.stringify(latestPatch);
      });

      expect({ counterexample, rebased }).toEqual({
        counterexample,
        rebased: expected,
      });
      expect({
        counterexample,
        changed: getChangedItineraryPatches(propertyCase.latest, rebased),
      }).toEqual({ counterexample, changed: expectedChanged });
    }
  });

  it("keeps latest state when an identity mismatch makes rebase input incompatible", () => {
    const base: StayPatch[] = [
      {
        type: "STAY",
        itemId: "stay-latest",
        date: "2027-01-01",
        endDate: "2027-01-03",
        hotelName: "기준 숙소",
        memo: "기준 메모",
      },
    ];
    const local: StayPatch[] = [
      {
        ...base[0]!,
        itemId: "stay-unrelated",
        hotelName: "잘못 연결된 내 숙소",
      },
    ];
    const latest: StayPatch[] = [
      {
        ...base[0]!,
        hotelName: "최신 숙소",
        memo: "최신 메모",
      },
    ];

    const rebased = rebaseItineraryPatches(base, local, latest);

    expect(rebased).toEqual(latest);
    expect(getChangedItineraryPatches(latest, rebased)).toEqual([]);
  });
});

describe("itinerary editor validation", () => {
  it("describes the existing date and route completion conditions without replacing source-owned optional fields", () => {
    const validSourceState: ItineraryItemPatch[] = [
      {
        type: "STAY",
        itemId: "stay-searching",
        date: "2026-09-01",
        endDate: "2026-09-03",
        hotelName: "",
      },
      {
        type: "TRANSPORT",
        itemId: "transport-unchecked",
        date: "2026-09-01",
        fromCity: "서울",
        toCity: "도쿄",
        mode: "",
      },
    ];

    expect(getItineraryEditorValidation(validSourceState)).toEqual({
      isValid: true,
      errors: [],
      firstError: undefined,
    });

    const invalid: ItineraryItemPatch[] = [
      {
        type: "STAY",
        itemId: "stay-searching",
        date: "2026-09-01",
        endDate: "2026-09-01",
        hotelName: "",
      },
      {
        type: "TRANSPORT",
        itemId: "transport-unchecked",
        date: "2026-09-01",
        fromCity: " ",
        toCity: "",
        mode: "",
      },
    ];

    expect(getItineraryEditorValidation(invalid)).toEqual({
      isValid: false,
      firstError: "체크아웃 날짜는 체크인 날짜보다 늦어야 합니다.",
      errors: [
        {
          itemId: "stay-searching",
          fields: ["date", "endDate"],
          message: "체크아웃 날짜는 체크인 날짜보다 늦어야 합니다.",
        },
        {
          itemId: "transport-unchecked",
          fields: ["fromCity", "toCity"],
          message: "이동 출발지와 도착지를 입력해주세요.",
        },
      ],
    });
  });
});
