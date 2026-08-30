import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils.ts";

const TRIP_CREATION_STEPS = [
  { id: "trip-info", label: "여행 정보" },
  { id: "companions", label: "동행자" },
  { id: "plan-basic", label: "기본 정보" },
  { id: "plan-route", label: "여행 경로" },
  { id: "plan-accommodation", label: "숙소" },
  { id: "plan-transport", label: "교통" },
  { id: "plan-review", label: "검토·등록" },
] as const;

export type TripCreationStep = (typeof TRIP_CREATION_STEPS)[number]["id"];

interface TripCreationProgressProps {
  readonly currentStep: TripCreationStep;
  readonly className?: string;
}

/**
 * 여행방 생성부터 첫 여행안 등록까지 이어지는 진행 표시예요.
 * 보이는 현재 단계명과 semantic ordered list를 함께 제공해 점만으로 상태를 전달하지 않아요.
 */
export function TripCreationProgress({
  currentStep,
  className,
}: TripCreationProgressProps) {
  const currentStepIndex = TRIP_CREATION_STEPS.findIndex(
    (step) => step.id === currentStep,
  );
  const current = TRIP_CREATION_STEPS[currentStepIndex]!;
  const progressRef = useRef<HTMLElement>(null);

  useEffect(() => {
    progressRef.current?.focus({ preventScroll: true });
  }, [currentStep]);

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
          {currentStepIndex + 1}/{TRIP_CREATION_STEPS.length}
        </p>
        <p className="min-w-0 text-sm font-semibold text-foreground [overflow-wrap:anywhere]">
          {current.label}
        </p>
      </div>

      <ol className="mt-3 flex min-w-0 items-center">
        {TRIP_CREATION_STEPS.map((step, index) => {
          const isCurrent = step.id === currentStep;
          const isPrevious = index < currentStepIndex;

          return (
            <li
              key={step.id}
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
              {index < TRIP_CREATION_STEPS.length - 1 && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "h-0.5 min-w-2 flex-1",
                    isPrevious ? "bg-primary" : "bg-border-strong",
                  )}
                />
              )}
              <span className="sr-only">
                {index + 1}. {step.label}
                {isCurrent ? " 현재 단계" : isPrevious ? " 이전 단계" : " 예정"}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
