import { useEffect, useState } from "react";
import type { RecommendNextActionResponse } from "../../contracts/recommendation.ts";
import type {
  RecommendationSurface,
  TripActionId,
} from "../../core/domain/trip-action.ts";
import { DecisionIcon } from "@/components/galanda/decision-icon.tsx";
import { Button } from "@/components/ui/button.tsx";
import { cn } from "@/lib/utils.ts";
import {
  tripActionPresentation,
  tripActionReasonPresentation,
} from "./trip-action-presentation.ts";
import {
  trackRecommendationEvent,
  type RecommendationActionContext,
} from "./recommendation.ts";

const recommendationCardClassName =
  "mx-(--app-inline-padding) min-w-0 py-3";

export function NextActionRecommendationPending({
  className,
}: {
  readonly className?: string;
}): JSX.Element {
  return (
    <section
      aria-busy="true"
      aria-label="다음으로 하면 좋은 일"
      aria-live="polite"
      className={cn(recommendationCardClassName, className)}
    >
      <div className="flex items-center gap-1.5 text-primary">
        <h2 className="text-xs font-bold tracking-wide">다음으로 하면 좋은 일</h2>
      </div>
      <p className="mt-2 text-sm font-medium leading-relaxed text-muted-foreground">
        여행 상태에 맞는 다음 행동을 확인하고 있어요.
      </p>
    </section>
  );
}

interface NextActionRecommendationProps {
  readonly tripId: string;
  readonly surface: RecommendationSurface;
  readonly recommendation: RecommendNextActionResponse;
  readonly onAction: (context: RecommendationActionContext) => void;
  readonly onDismiss?: (recommendationId: string) => void;
  readonly className?: string;
}

export function NextActionRecommendation({
  tripId,
  surface,
  recommendation,
  onAction,
  onDismiss,
  className,
}: NextActionRecommendationProps): JSX.Element | null {
  const [dismissedId, setDismissedId] = useState<string>();

  useEffect(() => {
    trackRecommendationEvent(
      tripId,
      recommendation,
      surface,
      "nba_impression",
    );
  }, [recommendation, surface, tripId]);

  if (dismissedId === recommendation.recommendationId) return null;

  const selectAction = (actionId: TripActionId, alternative: boolean): void => {
    trackRecommendationEvent(
      tripId,
      recommendation,
      surface,
      alternative ? "nba_alternative_selected" : "nba_accept",
      actionId,
    );
    onAction({ recommendation, surface, actionId });
  };
  const alternative = recommendation.alternatives[0]?.actionId;
  const titleId = `recommendation-${recommendation.recommendationId}-title`;

  return (
    <section
      aria-labelledby={titleId}
      className={cn(recommendationCardClassName, className)}
    >
      <div className="flex items-center gap-1.5 text-primary">
        <h2 id={titleId} className="text-xs font-bold tracking-wide">
          다음으로 하면 좋은 일
        </h2>
      </div>
      <p className="mt-2 min-w-0 text-[15px] font-semibold leading-snug tracking-tight text-foreground [overflow-wrap:anywhere]">
        {tripActionReasonPresentation[recommendation.primary.reasonCode]}
      </p>
      <Button
        type="button"
        size="xl"
        className="mt-4 w-full"
        onClick={() => selectAction(recommendation.primary.actionId, false)}
      >
        {recommendation.primary.actionId === "COMPARE_PLANS" && (
          <DecisionIcon name="compare" size={20} />
        )}
        {tripActionPresentation[recommendation.primary.actionId].label}
      </Button>
      <div className="mt-1.5 flex min-w-0 flex-wrap items-center justify-center gap-x-2">
        {alternative && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-w-0 whitespace-normal text-xs font-semibold text-primary hover:text-primary hover:bg-primary-muted/60"
            onClick={() => selectAction(alternative, true)}
          >
            {alternative === "COMPARE_PLANS" && <DecisionIcon name="compare" size={16} />}
            대신 {tripActionPresentation[alternative].label}
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-xs font-medium text-muted-foreground hover:text-foreground"
          onClick={() => {
            trackRecommendationEvent(
              tripId,
              recommendation,
              surface,
              "nba_skip",
            );
            setDismissedId(recommendation.recommendationId);
            onDismiss?.(recommendation.recommendationId);
          }}
        >
          지금은 건너뛰기
        </Button>
      </div>
    </section>
  );
}
