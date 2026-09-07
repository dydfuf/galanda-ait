import type { WizardActionState } from "@/components/galanda/wizard-step-page.tsx";
import type {
  FirstPlanWizardEvent,
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
