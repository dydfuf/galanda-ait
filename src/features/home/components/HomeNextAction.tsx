import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeftRight, CalendarDays, ChevronRight, FileText } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button.tsx";
import { cn } from "@/lib/utils.ts";
import { getTrip } from "@/app/api-client.ts";
import type { TripOverviewDto } from "@/contracts/trip-overview.ts";
import { RevisionSchema, TripIdSchema } from "@/core/domain/ids.ts";
import { getRoomActor } from "@/core/domain/auth-guards.ts";
import { toTripRoomDecisionContext } from "@/core/domain/trip-decision.ts";
import { resolveEligibleTripActions } from "@/core/domain/trip-action-resolver.ts";
import { useSessionQuery } from "@/hooks/useSession.ts";
import { useNextTripActionRecommendation } from "@/features/common/use-next-trip-action-recommendation.ts";
import { trackRecommendationEvent, type RecommendationActionContext } from "@/features/common/recommendation.ts";
import { tripActionPresentation, tripActionReasonPresentation } from "@/features/common/trip-action-presentation.ts";
import { toUserMessage } from "@/features/common/error-message.ts";
import { shareTripInvite } from "@/features/invite/share-trip-invite.ts";

export function HomeNextAction({ trip, stale = false }: { readonly trip: TripOverviewDto; readonly stale?: boolean }) {
  const navigate = useNavigate();
  const { data: session } = useSessionQuery();
  const query = useNextTripActionRecommendation(trip.id, { surface: "HOME" }, RevisionSchema.make(trip.revision), Boolean(session) && !stale);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const recommendation = !stale && !query.isError && query.data &&
    trip.eligibleActionIds.includes(query.data.primary.actionId) &&
    query.data.alternatives.every(({ actionId }) => trip.eligibleActionIds.includes(actionId))
    ? query.data : undefined;
  const tripRoot = `/trips/${encodeURIComponent(trip.id)}`;
  const StatusIcon = trip.isConfirmed ? CalendarDays : trip.candidateCount > 1 ? ArrowLeftRight : FileText;

  useEffect(() => {
    if (recommendation) trackRecommendationEvent(trip.id, recommendation, "HOME", "nba_impression");
  }, [trip.id, recommendation]);

  const runAction = async (context: RecommendationActionContext) => {
    if (pending || !session) return;
    setPending(true);
    setError(undefined);
    try {
      const room = await getTrip(TripIdSchema.make(trip.id));
      const actor = getRoomActor(room, session.participantIds);
      if (!resolveEligibleTripActions(toTripRoomDecisionContext(room, actor), actor)
        .some(({ actionId }) => actionId === context.actionId)) {
        throw new Error("여행 상태가 바뀌었어요. 계획 보기에서 최신 내용을 확인해주세요.");
      }
      if (context.actionId === "INVITE_MEMBER") {
        const outcome = await shareTripInvite(trip.id);
        if (outcome === "shared" || outcome === "copied") {
          trackRecommendationEvent(trip.id, context.recommendation, "HOME", "nba_action_completed", context.actionId);
        }
        return;
      }
      let path = tripActionPresentation[context.actionId].route(trip.id);
      if (context.actionId === "GIVE_OPINION") {
        const target = room.plans.find((plan) => plan.status === "VOTING" &&
          !plan.memberOpinions?.some((opinion) => session.participantIds.includes(opinion.userId)));
        if (target) path = `/trips/${trip.id}/plans/${target.id}`;
      } else if (context.actionId === "COMPARE_PLANS" || context.actionId === "CONFIRM_PLAN") {
        const [left, right] = room.plans.filter((plan) => plan.status !== "DRAFT");
        if (left && right) path = `/trips/${trip.id}/plans/compare?left=${left.id}&right=${right.id}`;
      }
      navigate(path, { state: { nbaRecommendation: context } });
    } catch (cause) {
      setError(toUserMessage(cause, "다음 행동을 열지 못했어요. 다시 시도해주세요."));
    } finally {
      setPending(false);
    }
  };

  return (
    <section aria-label="여행의 다음 행동" className="flex min-w-0 flex-col">
      <Link
        to={`${tripRoot}/${trip.isConfirmed ? "itinerary" : "plans"}`}
        className="flex min-h-16 items-center gap-4 border-t border-border py-5 text-base leading-relaxed text-foreground no-underline! focus-visible:outline-2 focus-visible:outline-ring"
      >
        <StatusIcon className="size-5 shrink-0 text-muted-foreground" strokeWidth={1.8} aria-hidden="true" />
        <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
          {recommendation?.primary.actionId === "COMPARE_PLANS"
            ? `비교할 여행안이 ${trip.candidateCount}개 있어요`
            : recommendation
              ? tripActionReasonPresentation[recommendation.primary.reasonCode]
              : trip.isConfirmed
                ? "확정된 여행 일정을 확인해보세요."
                : trip.candidateCount > 0
                  ? `제안된 여행안이 ${trip.candidateCount}개 있어요`
                  : "첫 여행안을 함께 만들어보세요."}
        </span>
        <ChevronRight className="size-5 shrink-0 text-muted-foreground" strokeWidth={1.8} aria-hidden="true" />
      </Link>
      <div className="flex flex-col gap-2 pt-5 [&_a]:scroll-mb-[calc(var(--global-nav-height,0px)+16px)] [&_button]:scroll-mb-[calc(var(--global-nav-height,0px)+16px)]">
        {error && <p role="alert" className="text-sm leading-relaxed text-destructive">{error}</p>}
        {recommendation ? (
          <Button
            size="xl"
            className="min-h-14 w-full"
            disabled={pending}
            aria-busy={pending}
            onClick={() => {
              trackRecommendationEvent(trip.id, recommendation, "HOME", "nba_accept", recommendation.primary.actionId);
              void runAction({ recommendation, surface: "HOME", actionId: recommendation.primary.actionId });
            }}
          >
            {pending ? "여행 상태 확인 중..." : tripActionPresentation[recommendation.primary.actionId].label}
          </Button>
        ) : (
          <Link
            to={`${tripRoot}/${trip.isConfirmed ? "itinerary" : "plans"}`}
            className={cn(buttonVariants({ size: "xl" }), "min-h-14 w-full no-underline!")}
          >
            {trip.isConfirmed ? "확정 일정 보기" : "계획 보기"}
          </Link>
        )}
        {(recommendation || trip.isConfirmed) && (
          <Link
            to={`${tripRoot}/plans`}
            className={cn(buttonVariants({ variant: "ghost", size: "xl" }), "text-primary no-underline!")}
          >
            여행방 열기
          </Link>
        )}
      </div>
    </section>
  );
}
