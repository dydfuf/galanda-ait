import { describe, expect, it } from "vitest";

import type { FirstPlanWizardCursor } from "./first-plan-wizard-flow.ts";
import { createFirstPlanWizardViewModel } from "./first-plan-wizard.presenter.ts";
import type { PlanEditorFormData } from "./plan-editor-model.ts";

const formData: PlanEditorFormData = {
  title: "제주 힐링 여행",
  proposalReason: "바다와 카페",
  baseHeadcount: 2,
  routes: [
    { city: "제주", arrivalDate: "2026-10-01", departureDate: "2026-10-04" },
  ],
  accommodations: [
    {
      id: "acc-1",
      city: "제주",
      period: "2026-10-01 ~ 2026-10-04",
      nights: 3,
      hotelName: "호텔",
      isSearching: false,
      bookingStatus: "AVAILABLE",
    },
  ],
  transports: [
    {
      id: "tr-1",
      fromCity: "김포",
      toCity: "제주",
      mode: "항공",
      hasTransfer: false,
      durationText: "1시간",
      bookingStatus: "AVAILABLE",
    },
    {
      id: "tr-2",
      fromCity: "제주",
      toCity: "김포",
      mode: "항공",
      hasTransfer: false,
      durationText: "1시간",
      bookingStatus: "AVAILABLE",
    },
  ],
};

function present(
  cursor: FirstPlanWizardCursor,
  overrides: Partial<PlanEditorFormData> = {},
) {
  return createFirstPlanWizardViewModel({
    cursor,
    formData: { ...formData, ...overrides },
    draftSaveStatus: "IDLE",
    isOnline: true,
  });
}

describe("createFirstPlanWizardViewModel", () => {
  it("builds every current question as a discriminated view model", () => {
    const questions: ReadonlyArray<[FirstPlanWizardCursor, string]> = [
      [{ section: "basic", question: "title" }, "title"],
      [{ section: "basic", question: "proposal-reason" }, "proposal-reason"],
      [{ section: "basic", question: "headcount" }, "headcount"],
      [{ section: "route", question: "city", index: 0 }, "city"],
      [{ section: "route", question: "arrival-date", index: 0 }, "arrival-date"],
      [{ section: "route", question: "departure-date", index: 0 }, "departure-date"],
      [{ section: "route", question: "add-city", index: 0 }, "add-city"],
      [{ section: "accommodation", question: "status", index: 0 }, "accommodation-status"],
      [{ section: "accommodation", question: "hotel-name", index: 0 }, "hotel-name"],
      [{ section: "transport", question: "endpoints", index: 0 }, "transport-endpoints"],
      [{ section: "transport", question: "status", index: 0 }, "transport-status"],
      [{ section: "transport", question: "mode", index: 0 }, "transport-mode"],
      [{ section: "transport", question: "duration", index: 0 }, "transport-duration"],
    ];

    for (const [cursor, kind] of questions) {
      expect(present(cursor).question.kind).toBe(kind);
    }
  });

  it("does not invent a saved state when the caller provides IDLE", () => {
    const vm = present({ section: "basic", question: "title" });

    expect(vm.draftStatus.label).toBe("아직 저장되지 않음");
    expect(vm.draftStatus.tone).toBe("neutral");
  });

  it("keeps invalid input disabled while exposing a typed reason", () => {
    const vm = present(
      { section: "route", question: "departure-date", index: 0 },
      {
        routes: [
          { city: "제주", arrivalDate: "2026-10-04", departureDate: "2026-10-04" },
        ],
      },
    );

    expect(vm.actions.primary.state).toEqual({
      tag: "disabled",
      reason: "출발일은 도착일 이후여야 합니다.",
    });
  });

  it("keeps offline navigation available and reports the offline notice separately", () => {
    const vm = createFirstPlanWizardViewModel({
      cursor: { section: "basic", question: "title" },
      formData,
      draftSaveStatus: "SAVED",
      isOnline: false,
    });

    expect(vm.actions.primary.state).toEqual({ tag: "enabled" });
    expect(vm.notice?.message).toContain("오프라인");
  });
});
