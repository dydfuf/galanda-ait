import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import type { RecommendNextActionResponse } from "../../contracts/recommendation.ts";
import type {
  RecommendationSurface,
  TripActionId,
} from "../../core/domain/trip-action.ts";
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
  "mx-(--app-inline-padding) mb-5 min-w-0 rounded-2xl border border-border bg-muted/45 p-4";

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
      <div className="flex items-center gap-2 text-primary">
        <Sparkles aria-hidden="true" className="size-4 shrink-0" />
        <h2 className="text-sm font-bold">다음으로 하면 좋은 일</h2>
      </div>
      <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
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
      <div className="flex items-center gap-2 text-primary">
        <Sparkles aria-hidden="true" className="size-4 shrink-0" />
        <h2 id={titleId} className="text-sm font-bold">
          다음으로 하면 좋은 일
        </h2>
      </div>
      <p className="mt-2 text-[15px] leading-relaxed font-semibold text-foreground">
        {tripActionReasonPresentation[recommendation.primary.reasonCode]}
      </p>
      <Button
        type="button"
        size="lg"
        className="mt-4 w-full"
        onClick={() => selectAction(recommendation.primary.actionId, false)}
      >
        {tripActionPresentation[recommendation.primary.actionId].label}
      </Button>
      <div className="mt-2 flex min-w-0 flex-wrap items-center justify-center gap-x-2">
        {alternative && (
          <Button
            type="button"
            variant="ghost"
            className="min-w-0 whitespace-normal text-primary"
            onClick={() => selectAction(alternative, true)}
          >
            대신 {tripActionPresentation[alternative].label}
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          className="text-muted-foreground"
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
