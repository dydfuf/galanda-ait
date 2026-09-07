import type { WizardActionState } from "@/components/galanda/wizard-step-page.tsx";
import type {
  FirstPlanWizardEvent,
  FirstPlanWizardQuestionViewModel,
  FirstPlanWizardViewModel,
} from "./first-plan-wizard.contract.ts";

export const validWizardActionState: WizardActionState = {
  tag: "disabled",
  reason: "입력값을 확인해주세요.",
};

export const validWizardEvent: FirstPlanWizardEvent = {
  type: "city-change",
  index: 0,
  value: "제주",
};

export const wizardViewModelContract: Pick<FirstPlanWizardViewModel, "actions"> = {
  actions: {
    primary: {
      label: "다음",
      event: { type: "next" },
      state: { tag: "enabled" },
    },
    secondary: {
      label: "이전",
      event: { type: "previous" },
      state: { tag: "enabled" },
    },
  },
};

// @ts-expect-error Disabled actions must explain why the action is unavailable.
export const missingDisabledReason: WizardActionState = { tag: "disabled" };

// @ts-expect-error A city-change event requires an index and a value.
export const malformedWizardEvent: FirstPlanWizardEvent = { type: "city-change" };

export const malformedQuestionKind: FirstPlanWizardViewModel["question"] =
  // @ts-expect-error Unknown question kinds must fail exhaustive View handling.
  { kind: "unknown" };

// Adding a question or event kind requires updating the exhaustive handlers and this fixture.
export const handledQuestionKinds: Record<FirstPlanWizardQuestionViewModel["kind"], true> = {
  title: true,
  "proposal-reason": true,
  headcount: true,
  city: true,
  "arrival-date": true,
  "departure-date": true,
  "add-city": true,
  "accommodation-status": true,
  "hotel-name": true,
  "transport-endpoints": true,
  "transport-status": true,
  "transport-mode": true,
  "transport-duration": true,
};

export const handledWizardEventTypes: Record<FirstPlanWizardEvent["type"], true> = {
  "title-change": true,
  "proposal-reason-change": true,
  "headcount-change": true,
  "city-change": true,
  "arrival-date-change": true,
  "departure-date-change": true,
  "add-city": true,
  "accommodation-status-change": true,
  "hotel-name-change": true,
  "transport-endpoints-change": true,
  "transport-status-change": true,
  "transport-mode-change": true,
  "transport-duration-change": true,
  "field-blur": true,
  next: true,
  previous: true,
};
