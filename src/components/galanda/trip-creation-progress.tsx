import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils.ts";

export type TripCreationStep =
  | "trip-info"
  | "companions"
  | "plan-basic"
  | "plan-route"
  | "plan-accommodation"
  | "plan-transport"
  | "plan-review";

interface StageDefinition {
  readonly id: "trip-room" | "companions" | "first-plan" | "review";
  readonly label: string;
  readonly steps: readonly TripCreationStep[];
}

export const TRIP_CREATION_STAGES: readonly StageDefinition[] = [
  {
    id: "trip-room",
    label: "여행방",
    steps: ["trip-info"],
  },
  {
    id: "companions",
    label: "동행자",
    steps: ["companions"],
  },
  {
    id: "first-plan",
    label: "첫 여행안",
    steps: ["plan-basic", "plan-route", "plan-accommodation", "plan-transport"],
  },
  {
    id: "review",
    label: "검토",
    steps: ["plan-review"],
  },
] as const;

export interface TripCreationProgressProps {
  readonly currentStep: TripCreationStep;
  readonly subStepLabel?: string;
  readonly subStepProgress?: {
    readonly current: number;
    readonly total: number;
  };
  readonly className?: string;
}

/**
 * 여행방 생성부터 첫 여행안 등록까지 4개 메인 단계로 진행을 안내하는 컴포넌트예요.
 * 여행방(1) → 동행자(2) → 첫 여행안(3) → 검토(4) 4단계를 시각적·스크린리더로 전달해요.
 */
export function TripCreationProgress({
  currentStep,
  subStepLabel,
  subStepProgress,
  className,
}: TripCreationProgressProps) {
  const stageIndex = TRIP_CREATION_STAGES.findIndex((stage) =>
    stage.steps.includes(currentStep),
  );
  const currentStage =
    stageIndex >= 0 ? TRIP_CREATION_STAGES[stageIndex]! : TRIP_CREATION_STAGES[0]!;
  const currentStageIndex = stageIndex >= 0 ? stageIndex : 0;

  const displayedTitle = subStepLabel
    ? `${currentStage.label} · ${subStepLabel}`
    : currentStage.label;

  const stageCounter = `${currentStageIndex + 1}/${TRIP_CREATION_STAGES.length}`;
  const counterText = subStepProgress
    ? `${stageCounter} · ${subStepProgress.current}/${subStepProgress.total}`
    : stageCounter;

  const progressRef = useRef<HTMLElement>(null);

  useEffect(() => {
    progressRef.current?.focus({ preventScroll: true });
  }, [currentStep, subStepLabel, subStepProgress?.current]);

  return (
    <nav
      ref={progressRef}
      tabIndex={-1}
      aria-label="여행 만들기 진행 단계"
      data-slot="trip-creation-progress"
      className={cn(
        "rounded-2xl border border-primary-border-weak bg-primary-muted px-4 py-3",
        className,
      )}
    >
      <div
        className="flex min-w-0 items-center justify-between gap-3"
        aria-live="polite"
        aria-atomic="true"
      >
        <p className="shrink-0 text-sm font-bold text-primary tabular-nums">
          {counterText}
        </p>
        <p className="min-w-0 text-sm font-semibold text-foreground [overflow-wrap:anywhere]">
          {displayedTitle}
        </p>
      </div>

      <ol className="mt-3 flex min-w-0 items-center">
        {TRIP_CREATION_STAGES.map((stage, index) => {
          const isCurrent = index === currentStageIndex;
          const isPrevious = index < currentStageIndex;

          return (
            <li
              key={stage.id}
              aria-current={isCurrent ? "step" : undefined}
              data-state={
                isCurrent ? "current" : isPrevious ? "previous" : "upcoming"
              }
              className="flex min-w-0 flex-1 items-center last:flex-none"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "size-3 shrink-0 rounded-full border-2",
                  isCurrent || isPrevious
                    ? "border-primary bg-primary"
                    : "border-border-strong bg-card",
                  isCurrent && "ring-4 ring-primary/15",
                )}
              />
              {index < TRIP_CREATION_STAGES.length - 1 && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "h-0.5 min-w-2 flex-1",
                    isPrevious ? "bg-primary" : "bg-border-strong",
                  )}
                />
              )}
              <span className="sr-only">
                {index + 1}. {stage.label}
                {isCurrent ? " 현재 단계" : isPrevious ? " 이전 단계" : " 예정"}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
