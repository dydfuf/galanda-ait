import { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";

import "@/index.css";
import { FirstPlanWizardView } from "@/features/plan-editor/components/FirstPlanWizardView.tsx";
import { createFirstPlanWizardViewModel } from "@/features/plan-editor/first-plan-wizard.presenter.ts";
import type { FirstPlanWizardEvent } from "@/features/plan-editor/first-plan-wizard.contract.ts";
import type { PlanEditorFormData } from "@/features/plan-editor/plan-editor-model.ts";

const baseFormData: PlanEditorFormData = {
  title: "제주 힐링 여행",
  proposalReason: "",
  baseHeadcount: 2,
  routes: [
    { city: "제주", arrivalDate: "2026-10-01", departureDate: "2026-10-04" },
  ],
  accommodations: [],
  transports: [],
};

function FixtureApp() {
  const state = new URLSearchParams(window.location.search).get("state") ?? "normal";
  const isOffline = state === "offline";
  const isLong = state === "long";
  const isInvalidDate = state === "invalid-date";
  const isReviewReturn = state === "review";
  const [events, setEvents] = useState<ReadonlyArray<string>>([]);
  const formData = useMemo<PlanEditorFormData>(
    () => ({
      ...baseFormData,
      routes: [
        {
          city: isLong ? "도쿄·하코네·가마쿠라를 잇는 아주 긴 목적지 이름" : "제주",
          arrivalDate: "2026-10-01",
          departureDate: isInvalidDate ? "2026-09-30" : "2026-10-04",
        },
      ],
    }),
    [isInvalidDate, isLong],
  );
  const cursor = isLong
    ? { section: "route" as const, question: "add-city" as const, index: 0 }
    : isInvalidDate
      ? { section: "route" as const, question: "departure-date" as const, index: 0 }
      : isReviewReturn
        ? { section: "route" as const, question: "city" as const, index: 0, returnToReview: true }
        : { section: "basic" as const, question: "title" as const };
  const baseViewModel = createFirstPlanWizardViewModel({
    cursor,
    formData,
    draftSaveStatus: state === "saving" ? "SAVING" : state === "error" ? "ERROR" : "SAVED",
    isOnline: !isOffline,
    touched: isInvalidDate ? { "departure-date": true } : undefined,
  });
  const viewModel = isLong
    ? {
        ...baseViewModel,
        header: {
          ...baseViewModel.header,
          description:
            "긴 목적지 이름과 설명이 작은 화면에서도 줄바꿈되며 하단 CTA와 겹치지 않는지 확인하는 fixture입니다. ".repeat(2),
        },
      }
    : baseViewModel;
  const onEvent = (event: FirstPlanWizardEvent) => {
    setEvents((current) => [...current, event.type]);
  };

  return (
    <div data-fixture-state={state}>
      <FirstPlanWizardView vm={viewModel} onEvent={onEvent} />
      <output data-testid="fixture-events">{events.join(",")}</output>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<FixtureApp />);
