import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getTrip } from "@/app/api-client.ts";
import type { TripOverviewDto } from "@/contracts/trip-overview.ts";
import { RevisionSchema, TripIdSchema } from "@/core/domain/ids.ts";
import { getRoomActor } from "@/core/domain/auth-guards.ts";
import { toTripRoomDecisionContext } from "@/core/domain/trip-decision.ts";
import { resolveEligibleTripActions } from "@/core/domain/trip-action-resolver.ts";
import { useSessionQuery } from "@/hooks/useSession.ts";
import { NextActionRecommendation, NextActionRecommendationPending } from "@/features/common/NextActionRecommendation.tsx";
import { useNextTripActionRecommendation } from "@/features/common/use-next-trip-action-recommendation.ts";
import { trackRecommendationEvent, type RecommendationActionContext } from "@/features/common/recommendation.ts";
import { tripActionPresentation } from "@/features/common/trip-action-presentation.ts";
import { toUserMessage } from "@/features/common/error-message.ts";
import { shareTripInvite } from "@/features/invite/share-trip-invite.ts";

export function HomeNextAction({ trip }: { readonly trip: TripOverviewDto }) {
  const navigate = useNavigate();
  const { data: session } = useSessionQuery();
  const query = useNextTripActionRecommendation(trip.id, { surface: "HOME" }, RevisionSchema.make(trip.revision), Boolean(session));
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const recommendation = query.data;

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

  if (query.isPending) return <NextActionRecommendationPending className="mx-0" />;
  if (query.isError || !recommendation ||
    !trip.eligibleActionIds.includes(recommendation.primary.actionId) ||
    recommendation.alternatives.some(({ actionId }) => !trip.eligibleActionIds.includes(actionId))) return null;

  return (
    <div>
      <fieldset disabled={pending} aria-busy={pending} className="min-w-0">
        <NextActionRecommendation
          tripId={trip.id}
          surface="HOME"
          recommendation={recommendation}
          onAction={(context) => void runAction(context)}
          className="mx-0"
        />
      </fieldset>
      {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  );
}
