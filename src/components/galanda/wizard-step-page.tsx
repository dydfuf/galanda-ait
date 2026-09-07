import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { BottomAction } from "./bottom-action.tsx";
import { PageBody } from "./page-body.tsx";
import { PageTitle } from "./page-title.tsx";
import {
  TripCreationProgress,
  type TripCreationStep,
} from "./trip-creation-progress.tsx";
import { Button } from "@/components/ui/button.tsx";

export type WizardActionState =
  | { readonly tag: "enabled" }
  | { readonly tag: "disabled"; readonly reason: string }
  | { readonly tag: "pending"; readonly pendingLabel: string };

export interface WizardStepAction<Event> {
  readonly label: string;
  readonly event: Event;
  readonly state: WizardActionState;
}

export interface WizardStepProgress {
  readonly currentStep: TripCreationStep;
  readonly subStepLabel: string;
  readonly subStepProgress?: {
    readonly current: number;
    readonly total: number;
  };
}

export interface WizardStepDraftStatus {
  readonly label: string;
  readonly tone: "neutral" | "error";
}

export interface WizardStepNotice {
  readonly tone: "info" | "error";
  readonly message: string;
}

interface WizardStepPageProps<Event> {
  readonly title: ReactNode;
  readonly description: ReactNode;
  readonly progress: WizardStepProgress;
  readonly draftStatus: WizardStepDraftStatus;
  readonly primaryAction: WizardStepAction<Event>;
  readonly secondaryAction?: WizardStepAction<Event>;
  readonly notice?: WizardStepNotice;
  readonly onAction: (event: Event) => void;
  readonly children: ReactNode;
}

function actionIsDisabled(state: WizardActionState): boolean {
  return state.tag !== "enabled";
}

function actionLabel<Event>(action: WizardStepAction<Event>): string {
  return action.state.tag === "pending" ? action.state.pendingLabel : action.label;
}

export function WizardStepPage<Event>({
  title,
  description,
  progress,
  draftStatus,
  primaryAction,
  secondaryAction,
  notice,
  onAction,
  children,
}: WizardStepPageProps<Event>) {
  const disabledReason =
    primaryAction.state.tag === "disabled" ? primaryAction.state.reason : undefined;

  return (
    <div data-galanda-surface="content" className="flex min-h-dvh flex-1 flex-col">
      <PageBody
        data-testid="wizard-step-page-body"
        withBottomAction
        className="flex flex-1 flex-col"
      >
        <TripCreationProgress
          currentStep={progress.currentStep}
          subStepLabel={progress.subStepLabel}
          subStepProgress={progress.subStepProgress}
          className="mx-(--app-inline-padding) mt-1"
        />

        <PageTitle
          title={title}
          description={description}
          action={
            <output
              data-slot="draft-save-status"
              aria-live="polite"
              className={cn(
                "flex min-h-8 items-center rounded-lg px-2.5 py-1 text-xs font-medium [overflow-wrap:anywhere]",
                draftStatus.tone === "error"
                  ? "bg-destructive/10 text-destructive font-semibold"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {draftStatus.label}
            </output>
          }
          className="mt-1"
        />

        {children}
      </PageBody>

      <BottomAction
        surface="content"
        className="border-border"
        accessory={
          notice ? (
            <div className="flex flex-col gap-1 text-center text-sm text-muted-foreground">
              {notice && (
                <output
                  aria-live="polite"
                  className={cn(
                    notice.tone === "error" && "font-semibold text-destructive",
                  )}
                >
                  {notice.message}
                </output>
              )}
            </div>
          ) : undefined
        }
      >
        {secondaryAction && (
          <Button
            type="button"
            size="xl"
            variant="secondary"
            aria-busy={secondaryAction.state.tag === "pending" || undefined}
            aria-description={
              secondaryAction.state.tag === "disabled" ? secondaryAction.state.reason : undefined
            }
            title={secondaryAction.state.tag === "disabled" ? secondaryAction.state.reason : undefined}
            disabled={actionIsDisabled(secondaryAction.state)}
            onClick={() => onAction(secondaryAction.event)}
          >
            {actionLabel(secondaryAction)}
          </Button>
        )}
        <Button
          type="button"
          size="xl"
          aria-busy={primaryAction.state.tag === "pending" || undefined}
          aria-description={disabledReason}
          title={disabledReason}
          disabled={actionIsDisabled(primaryAction.state)}
          onClick={() => onAction(primaryAction.event)}
        >
          {actionLabel(primaryAction)}
        </Button>
      </BottomAction>
    </div>
  );
}
