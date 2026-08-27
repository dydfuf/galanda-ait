import { Effect, Option } from "effect";
import {
  getRoomActor,
  requireRoomMember,
  type RoomRole,
} from "../domain/auth-guards.ts";
import {
  NotFoundError,
  StateConflictError,
  ValidationError,
} from "../domain/errors.ts";
import type {
  RecommendationId,
  Revision,
  TripId,
} from "../domain/ids.ts";
import {
  NBA_RULE_POLICY_VERSION,
  type RecommendationSource,
  type RecommendationSurface,
  type TripAction,
  type TripActionId,
} from "../domain/trip-action.ts";
import {
  applyTripActionRanking,
  isAiRankingNeeded,
  resolveEligibleTripActions,
} from "../domain/trip-action-resolver.ts";
import {
  resolveTripDecisions,
  toFirstPlanDecisionContext,
  toTripRoomDecisionContext,
  type TripRecommendationConflict,
} from "../domain/trip-decision.ts";
import type { PlanPublishCompletion } from "../domain/room.ts";
import { mergeParticipantIdentityInRoom } from "../domain/room-transitions.ts";
import { IdGenerator } from "../ports/id-generator.ts";
import { requireAuthSession } from "../ports/session.ts";
import { TripActionRanker } from "../ports/trip-action-ranker.ts";
import type { TripActionRankingInput } from "../ports/trip-action-ranker.ts";
import { TripRoomRepository } from "../ports/trip-room-repository.ts";

export interface RecommendNextTripActionCommand {
  readonly tripId: TripId;
  readonly surface: RecommendationSurface;
  readonly draft?: PlanPublishCompletion & {
    readonly conflict?: TripRecommendationConflict;
  };
}

export interface NextTripActionRecommendation {
  readonly recommendationId: RecommendationId;
  readonly primary: TripAction;
  readonly alternatives: ReadonlyArray<TripAction>;
  readonly source: RecommendationSource;
  readonly contextFingerprint: string;
  readonly rankingInput: TripActionRankingInput;
}

interface RecommendationFingerprintInput {
  readonly rulePolicyVersion: string;
  readonly rankingPolicyVersion?: string;
  readonly tripRevision: Revision;
  readonly actorCapabilityScope: RoomRole;
  readonly surface: RecommendationSurface;
  readonly draft?: PlanPublishCompletion & {
    readonly conflict?: TripRecommendationConflict;
  };
  readonly eligibleActionIds: ReadonlyArray<TripActionId>;
}

const createRecommendationContextFingerprint = async (
  input: RecommendationFingerprintInput
): Promise<string> => {
  const bytes = new TextEncoder().encode(JSON.stringify({
    rulePolicyVersion: input.rulePolicyVersion,
    rankingPolicyVersion: input.rankingPolicyVersion ?? null,
    tripRevision: input.tripRevision,
    actorCapabilityScope: input.actorCapabilityScope,
    surface: input.surface,
    draftState: input.draft
      ? [
          input.draft.basic,
          input.draft.route,
          input.draft.accommodation,
          input.draft.transport,
          input.draft.conflict ?? null,
        ]
      : null,
    eligibleActionSet: [...input.eligibleActionIds].sort(),
  }));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(
    new Uint8Array(digest),
    (byte) => byte.toString(16).padStart(2, "0")
  ).join("");
};

export const recommendNextTripAction = Effect.fn("recommendNextTripAction")(
  function* (command: RecommendNextTripActionCommand) {
    if (command.surface !== "FIRST_PLAN" && command.draft) {
      return yield* Effect.fail(
        new ValidationError({
          message: "draft snapshot은 첫 여행안 화면에서만 사용할 수 있습니다.",
        })
      );
    }

    const session = yield* requireAuthSession();
    const rooms = yield* TripRoomRepository;
    const room = mergeParticipantIdentityInRoom(
      yield* rooms.getRoom(command.tripId),
      session.participantId,
      session.participantIds
    );
    yield* requireRoomMember(room, session.participantIds).pipe(
      Effect.mapError(
        () => new NotFoundError({ entity: "TripRoom", id: command.tripId })
      )
    );

    if (command.draft && room.plans.length > 0) {
      return yield* Effect.fail(
        new StateConflictError({
          message: "이미 첫 여행안이 등록되어 draft snapshot을 사용할 수 없습니다.",
        })
      );
    }

    const actor = getRoomActor(room, session.participantIds);
    const context = command.surface === "FIRST_PLAN"
      ? toFirstPlanDecisionContext(
          room,
          actor,
          command.draft
            ? {
                basic: command.draft.basic,
                route: command.draft.route,
                accommodation: command.draft.accommodation,
                transport: command.draft.transport,
              }
            : undefined,
          command.draft?.conflict
        )
      : toTripRoomDecisionContext(room, actor);
    const actions = resolveEligibleTripActions(context, actor);
    const deterministicPrimary = actions[0];
    if (!deterministicPrimary) {
      return yield* Effect.fail(
        new StateConflictError({
          message: "현재 상태에서 추천할 수 있는 다음 행동이 없습니다.",
        })
      );
    }

    const ranker = yield* Effect.serviceOption(TripActionRanker);
    const activeRanker =
      Option.isSome(ranker) && isAiRankingNeeded(context, actions)
        ? ranker.value
        : undefined;
    const contextFingerprint = yield* Effect.promise(() =>
      createRecommendationContextFingerprint({
        rulePolicyVersion: NBA_RULE_POLICY_VERSION,
        rankingPolicyVersion: activeRanker?.policyVersion,
        tripRevision: room.revision,
        actorCapabilityScope: actor.role,
        surface: command.surface,
        draft: command.draft,
        eligibleActionIds: actions.map(({ actionId }) => actionId),
      })
    );
    const rankingInput = {
      contextFingerprint,
      surface: command.surface,
      decisions: resolveTripDecisions(context),
      eligibleActions: actions,
    } satisfies TripActionRankingInput;

    let rankedActions = actions;
    let source: RecommendationSource = "RULE";
    let policyVersion = NBA_RULE_POLICY_VERSION;
    if (activeRanker) {
      const ranking = yield* activeRanker.rank(rankingInput).pipe(
        Effect.map(Option.some),
        Effect.catch((error) =>
          Effect.logWarning("nba_ai_ranker_fallback").pipe(
            Effect.annotateLogs({
              reason: error.reason,
              surface: command.surface,
              policyVersion: activeRanker.policyVersion,
            }),
            Effect.as(Option.none())
          )
        )
      );
      if (Option.isSome(ranking)) {
        const applied = applyTripActionRanking(actions, ranking.value);
        if (applied?.[0]) {
          rankedActions = applied;
          source = "AI";
          policyVersion = activeRanker.policyVersion;
        } else {
          yield* Effect.logWarning("nba_ai_ranker_fallback").pipe(
            Effect.annotateLogs({
              reason: "INVALID_OUTPUT",
              surface: command.surface,
              policyVersion: activeRanker.policyVersion,
            })
          );
        }
      }
    }

    const primary = rankedActions[0] ?? deterministicPrimary;

    const ids = yield* IdGenerator;
    const recommendationId = yield* ids.recommendationId;
    const event = {
      eventName: "nba_recommendation_generated" as const,
      recommendationId,
      source,
      actionId: primary.actionId,
      reasonCode: primary.reasonCode,
      surface: command.surface,
      policyVersion,
      contextFingerprint,
    };
    yield* Effect.logInfo(event.eventName).pipe(Effect.annotateLogs(event));

    return {
      recommendationId,
      primary,
      alternatives: rankedActions.slice(1),
      source,
      contextFingerprint,
      rankingInput,
    } satisfies NextTripActionRecommendation;
  }
);
