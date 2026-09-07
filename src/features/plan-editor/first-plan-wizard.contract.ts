import type {
  WizardStepAction,
  WizardStepDraftStatus,
  WizardStepNotice,
  WizardStepProgress,
} from "@/components/galanda/wizard-step-page.tsx";

export type FirstPlanWizardField =
  | "title"
  | "city"
  | "arrival-date"
  | "departure-date"
  | "hotel-name"
  | "transport-endpoints"
  | "transport-mode"
  | "transport-duration";

export type FirstPlanWizardEvent =
  | { readonly type: "title-change"; readonly value: string }
  | { readonly type: "proposal-reason-change"; readonly value: string }
  | { readonly type: "headcount-change"; readonly value: number }
  | { readonly type: "city-change"; readonly index: number; readonly value: string }
  | { readonly type: "arrival-date-change"; readonly index: number; readonly value: string }
  | { readonly type: "departure-date-change"; readonly index: number; readonly value: string }
  | { readonly type: "add-city" }
  | { readonly type: "accommodation-status-change"; readonly index: number; readonly isSearching: boolean }
  | { readonly type: "hotel-name-change"; readonly index: number; readonly value: string }
  | {
      readonly type: "transport-endpoints-change";
      readonly index: number;
      readonly fromCity: string;
      readonly toCity: string;
    }
  | {
      readonly type: "transport-status-change";
      readonly index: number;
      readonly bookingStatus: "AVAILABLE" | "NOT_CHECKED";
    }
  | { readonly type: "transport-mode-change"; readonly index: number; readonly value: string }
  | { readonly type: "transport-duration-change"; readonly index: number; readonly value: string }
  | { readonly type: "field-blur"; readonly field: FirstPlanWizardField }
  | { readonly type: "next" }
  | { readonly type: "previous" };

export interface WizardRouteSummary {
  readonly city: string;
  readonly arrivalDate: string;
  readonly departureDate: string;
  readonly nights: number;
}

export type FirstPlanWizardQuestionViewModel =
  | {
      readonly kind: "title";
      readonly value: string;
      readonly characterCount: number;
      readonly error?: string;
    }
  | {
      readonly kind: "proposal-reason";
      readonly value: string;
      readonly characterCount: number;
    }
  | { readonly kind: "headcount"; readonly value: number }
  | {
      readonly kind: "city";
      readonly index: number;
      readonly value: string;
      readonly characterCount: number;
      readonly error?: string;
    }
  | {
      readonly kind: "arrival-date";
      readonly index: number;
      readonly value: string;
      readonly min?: string;
      readonly error?: string;
    }
  | {
      readonly kind: "departure-date";
      readonly index: number;
      readonly value: string;
      readonly min?: string;
      readonly nights: number;
      readonly error?: string;
    }
  | { readonly kind: "add-city"; readonly routes: ReadonlyArray<WizardRouteSummary> }
  | {
      readonly kind: "accommodation-status";
      readonly index: number;
      readonly total: number;
      readonly city: string;
      readonly nights: number;
      readonly isSearching: boolean;
    }
  | {
      readonly kind: "hotel-name";
      readonly index: number;
      readonly total: number;
      readonly city: string;
      readonly nights: number;
      readonly value: string;
      readonly characterCount: number;
      readonly error?: string;
    }
  | {
      readonly kind: "transport-endpoints";
      readonly index: number;
      readonly total: number;
      readonly fromCity: string;
      readonly toCity: string;
      readonly fromError: boolean;
      readonly toError: boolean;
    }
  | {
      readonly kind: "transport-status";
      readonly index: number;
      readonly total: number;
      readonly fromCity: string;
      readonly toCity: string;
      readonly isAvailable: boolean;
    }
  | {
      readonly kind: "transport-mode";
      readonly index: number;
      readonly total: number;
      readonly fromCity: string;
      readonly toCity: string;
      readonly value: string;
      readonly characterCount: number;
      readonly error?: string;
      readonly presets: ReadonlyArray<string>;
    }
  | {
      readonly kind: "transport-duration";
      readonly index: number;
      readonly total: number;
      readonly fromCity: string;
      readonly toCity: string;
      readonly mode: string;
      readonly value: string;
      readonly characterCount: number;
      readonly error?: string;
      readonly presets: ReadonlyArray<string>;
    };

export interface FirstPlanWizardViewModel {
  readonly header: {
    readonly title: string;
    readonly description: string;
  };
  readonly progress: WizardStepProgress;
  readonly draftStatus: WizardStepDraftStatus;
  readonly question: FirstPlanWizardQuestionViewModel;
  readonly actions: {
    readonly primary: WizardStepAction<FirstPlanWizardEvent>;
    readonly secondary: WizardStepAction<FirstPlanWizardEvent>;
  };
  readonly notice?: WizardStepNotice;
}
