import { describe, expect, it } from "vitest";

import { getRoomActor, type RoomActor } from "../../core/domain/auth-guards.ts";
import {
  ParticipantIdSchema,
  PlanIdSchema,
  RevisionSchema,
  TripIdSchema,
  type ParticipantId,
} from "../../core/domain/ids.ts";
import type { TripActionId } from "../../core/domain/trip-action.ts";
import { resolveEligibleTripActions } from "../../core/domain/trip-action-resolver.ts";
import { toTripRoomDecisionContext } from "../../core/domain/trip-decision.ts";
import type { TripMember, TripRoom } from "../../core/domain/room.ts";
import { tripActionPresentation } from "../common/trip-action-presentation.ts";
import {
  resolvePlanHomeCta,
  type PlanHomePrimaryCtaKind,
} from "./plan-home-view-model.ts";

const PROPERTY_SEED = 0x7a2c_7a1;
const PROPERTY_CASE_COUNT = 128;

const primaryKindByAction = {
  EDIT_PLAN_BASIC: "create-first",
  PROPOSE_ALTERNATIVE: "propose-new",
  COMPARE_PLANS: "compare",
  VIEW_ITINERARY: "view-itinerary",
} as const satisfies Partial<Record<TripActionId, PlanHomePrimaryCtaKind>>;

type GeneratedActorKind = "host" | "member" | "guest";
type ConfirmationMode = "none" | "confirmed-plan-id" | "legacy-status";

interface PlanHomeCtaCase {
  readonly room: TripRoom;
  readonly participantId: ParticipantId;
  readonly requestedActorKind: GeneratedActorKind;
  readonly confirmationMode: ConfirmationMode;
}

function createDeterministicGenerator(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function generatePlanHomeCtaCase(
  index: number,
  next: () => number,
): PlanHomeCtaCase {
  const actorKinds: ReadonlyArray<GeneratedActorKind> = [
    "host",
    "member",
    "guest",
  ];
  const confirmationModes: ReadonlyArray<ConfirmationMode> = [
    "none",
    "confirmed-plan-id",
    "legacy-status",
  ];
  const requestedActorKind = actorKinds[Math.floor(index / 6) % actorKinds.length];
  const planCount = index % 6;
  const requestedConfirmationMode =
    confirmationModes[Math.floor(index / 18) % confirmationModes.length];
  const confirmationMode = planCount === 0 ? "none" : requestedConfirmationMode;
  const generatedMemberCount = 1 + Math.floor(next() * 4);
  const memberCount = requestedActorKind === "member"
    ? Math.max(2, generatedMemberCount)
    : generatedMemberCount;

  const hostId = ParticipantIdSchema.make(`property-host-${index}`);
  const members: TripMember[] = [
    { id: hostId, name: `방장 ${index}`, role: "HOST" },
    ...Array.from({ length: memberCount - 1 }, (_, memberIndex) => ({
      id: ParticipantIdSchema.make(`property-member-${index}-${memberIndex + 1}`),
      name: `멤버 ${index}-${memberIndex + 1}`,
      role: "MEMBER" as const,
    })),
  ];

  const plans: TripRoom["plans"] = Array.from(
    { length: planCount },
    (_, planIndex) => {
      const opinions = members
        .filter(() => next() < 0.45)
        .map((member) => ({
          userId: member.id,
          userName: member.name,
          reaction: (["LIKE", "OKAY", "HARD"] as const)[
            Math.floor(next() * 3)
          ],
        }));
      const author = members[planIndex % members.length];

      return {
        id: PlanIdSchema.make(`property-plan-${index}-${planIndex}`),
        title: `생성 여행안 ${index}-${planIndex}`,
        status:
          confirmationMode === "legacy-status" && planIndex === 0
            ? "CONFIRMED"
            : next() < 0.5
              ? "DRAFT"
              : "VOTING",
        revision: RevisionSchema.make(1 + (planIndex % 3)),
        authorId: author.id,
        authorName: author.name,
        places: [],
        memberOpinions: opinions,
        voteCount: opinions.length,
      };
    },
  );

  const room: TripRoom = {
    id: TripIdSchema.make(`property-room-${index}`),
    title: `생성 여행 ${index}`,
    destination: `목적지 ${index}`,
    revision: RevisionSchema.make(1 + (index % 7)),
    members,
    plans,
    confirmedPlanId:
      confirmationMode === "confirmed-plan-id" ? plans[0]?.id : undefined,
  };
  const participantId = requestedActorKind === "host"
    ? hostId
    : requestedActorKind === "member"
      ? members[1].id
      : ParticipantIdSchema.make(`property-guest-${index}`);

  return {
    room,
    participantId,
    requestedActorKind,
    confirmationMode,
  };
}

function formatCounterexample(
  index: number,
  propertyCase: PlanHomeCtaCase,
  actor: RoomActor,
  eligibleActionIds: ReadonlyArray<TripActionId>,
): string {
  return [
    `Property 1 counterexample (seed=0x${PROPERTY_SEED.toString(16)}, case=${index})`,
    `requestedActor=${propertyCase.requestedActorKind}`,
    `resolvedActor=${actor.role}`,
    `plans=${propertyCase.room.plans.length}`,
    `members=${propertyCase.room.members.length}`,
    `confirmation=${propertyCase.confirmationMode}`,
    `eligible=${eligibleActionIds.join("|") || "none"}`,
  ].join(", ");
}

describe("Plan Home CTA properties", () => {
  // **Validates: Requirements 1.4, 11.5**
  it("Feature: toss-liquid-glass-ui-refresh, Property 1: 동적 Primary Action의 유일성과 권한 정합성", () => {
    const next = createDeterministicGenerator(PROPERTY_SEED);

    for (let index = 0; index < PROPERTY_CASE_COUNT; index += 1) {
      const propertyCase = generatePlanHomeCtaCase(index, next);
      const actor = getRoomActor(propertyCase.room, propertyCase.participantId);
      const eligibleActions = resolveEligibleTripActions(
        toTripRoomDecisionContext(propertyCase.room, actor),
        actor,
      );
      const firstEligibleAction = eligibleActions[0];
      const expectedKind = firstEligibleAction
        ? (primaryKindByAction[firstEligibleAction.actionId as keyof typeof primaryKindByAction] ?? null)
        : null;
      const expectedLabel = expectedKind && firstEligibleAction
        ? tripActionPresentation[firstEligibleAction.actionId].label
        : null;
      const cta = resolvePlanHomeCta(propertyCase.room, actor);
      const counterexample = formatCounterexample(
        index,
        propertyCase,
        actor,
        eligibleActions.map(({ actionId }) => actionId),
      );
      const returnedPrimaryKinds = cta.primaryKind === null
        ? []
        : [cta.primaryKind];

      expect({
        counterexample,
        hasAtMostOnePrimary: returnedPrimaryKinds.length <= 1,
        hasConsistentPrimaryShape:
          (cta.primaryKind === null) === (cta.primaryLabel === null),
        primaryKind: cta.primaryKind,
        primaryLabel: cta.primaryLabel,
      }).toEqual({
        counterexample,
        hasAtMostOnePrimary: true,
        hasConsistentPrimaryShape: true,
        primaryKind: expectedKind,
        primaryLabel: expectedLabel,
      });
    }
  });
});
