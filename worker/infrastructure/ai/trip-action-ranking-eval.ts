import {
  ROLE_PERMISSIONS,
  type RoomActor,
  type RoomRole,
} from "../../../src/core/domain/auth-guards.ts";
import {
  applyTripActionRanking,
  resolveEligibleTripActions,
} from "../../../src/core/domain/trip-action-resolver.ts";
import type {
  RecommendationSurface,
  TripActionId,
  TripActionRanking,
} from "../../../src/core/domain/trip-action.ts";
import {
  resolveTripDecisions,
  type TripDecisionContext,
} from "../../../src/core/domain/trip-decision.ts";
import type {
  TripActionRankingInput,
} from "../../../src/core/ports/trip-action-ranker.ts";

export interface TripActionRankingGoldenCase {
  readonly id: string;
  readonly inputContext: {
    readonly surface: RecommendationSurface;
    readonly actorRole: RoomRole;
    readonly decisionContext: TripDecisionContext;
    readonly scenario: string;
  };
  readonly eligibleActions: ReadonlyArray<TripActionId>;
  readonly acceptableTopActions: ReadonlyArray<TripActionId>;
  readonly forbiddenActions: ReadonlyArray<TripActionId>;
  readonly rationaleTag: string;
}

export interface TripActionRankingEvalOutcome {
  readonly ranking?: TripActionRanking;
  readonly failure?: "TIMEOUT" | "PROVIDER_ERROR" | "INVALID_OUTPUT";
  readonly firstResponseLatencyMs: number;
  readonly totalLatencyMs: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly totalTokens: number;
  readonly estimatedCostUsd: number;
}

export interface TripActionRankingEvalCandidate {
  readonly id: string;
  readonly rank: (
    input: TripActionRankingInput
  ) => Promise<TripActionRankingEvalOutcome>;
}

const context = (
  overrides: Partial<TripDecisionContext> = {}
): TripDecisionContext => ({
  planCount: 0,
  memberCount: 2,
  opinionParticipantCount: 0,
  actorHasOpinion: false,
  isConfirmed: false,
  confirmablePlanCount: 0,
  ...overrides,
});

const incompleteFirstPlan = {
  basic: false,
  route: false,
  accommodation: false,
  transport: false,
};
const completeFirstPlan = {
  basic: true,
  route: true,
  accommodation: true,
  transport: true,
};

export const tripActionRankingGoldenCases: ReadonlyArray<TripActionRankingGoldenCase> = [
  {
    id: "first-plan-basic-incomplete",
    inputContext: {
      surface: "FIRST_PLAN",
      actorRole: "HOST",
      decisionContext: context({
        memberCount: 1,
        firstPlanCompletion: incompleteFirstPlan,
      }),
      scenario: "first plan의 기본 정보가 미완료",
    },
    eligibleActions: ["EDIT_PLAN_BASIC", "INVITE_MEMBER"],
    acceptableTopActions: ["EDIT_PLAN_BASIC"],
    forbiddenActions: ["PUBLISH_FIRST_PLAN", "CONFIRM_PLAN"],
    rationaleTag: "FIRST_PLAN_BASIC_INCOMPLETE",
  },
  {
    id: "route-missing",
    inputContext: {
      surface: "FIRST_PLAN",
      actorRole: "HOST",
      decisionContext: context({
        memberCount: 1,
        firstPlanCompletion: {
          ...incompleteFirstPlan,
          basic: true,
        },
      }),
      scenario: "기본 정보는 완료됐지만 경로가 없음",
    },
    eligibleActions: ["DEFINE_ROUTE", "INVITE_MEMBER"],
    acceptableTopActions: ["DEFINE_ROUTE"],
    forbiddenActions: ["ADD_ACCOMMODATION", "ADD_TRANSPORT", "PUBLISH_FIRST_PLAN"],
    rationaleTag: "ROUTE_MISSING",
  },
  {
    id: "route-complete-details-missing",
    inputContext: {
      surface: "FIRST_PLAN",
      actorRole: "HOST",
      decisionContext: context({
        memberCount: 1,
        firstPlanCompletion: {
          basic: true,
          route: true,
          accommodation: false,
          transport: false,
        },
      }),
      scenario: "경로 완료 후 숙소와 교통이 모두 미완료",
    },
    eligibleActions: ["ADD_ACCOMMODATION", "ADD_TRANSPORT", "INVITE_MEMBER"],
    acceptableTopActions: ["ADD_ACCOMMODATION", "ADD_TRANSPORT"],
    forbiddenActions: ["PUBLISH_FIRST_PLAN", "CONFIRM_PLAN"],
    rationaleTag: "DETAILS_MISSING",
  },
  {
    id: "accommodation-searching",
    inputContext: {
      surface: "FIRST_PLAN",
      actorRole: "HOST",
      decisionContext: context({ firstPlanCompletion: completeFirstPlan }),
      scenario: "숙소는 검색 중으로 표시되어 publish completion상 완료",
    },
    eligibleActions: ["PUBLISH_FIRST_PLAN"],
    acceptableTopActions: ["PUBLISH_FIRST_PLAN"],
    forbiddenActions: ["ADD_ACCOMMODATION", "CONFIRM_PLAN"],
    rationaleTag: "ACCOMMODATION_SEARCHING",
  },
  {
    id: "transport-not-checked",
    inputContext: {
      surface: "FIRST_PLAN",
      actorRole: "HOST",
      decisionContext: context({
        memberCount: 1,
        firstPlanCompletion: completeFirstPlan,
      }),
      scenario: "교통 예약 상태는 미확인이지만 publish completion상 완료",
    },
    eligibleActions: ["PUBLISH_FIRST_PLAN", "INVITE_MEMBER"],
    acceptableTopActions: ["PUBLISH_FIRST_PLAN"],
    forbiddenActions: ["ADD_TRANSPORT", "CONFIRM_PLAN"],
    rationaleTag: "TRANSPORT_NOT_CHECKED",
  },
  {
    id: "plan-count-zero",
    inputContext: {
      surface: "PLAN_HOME",
      actorRole: "HOST",
      decisionContext: context(),
      scenario: "여행안 0개",
    },
    eligibleActions: ["EDIT_PLAN_BASIC"],
    acceptableTopActions: ["EDIT_PLAN_BASIC"],
    forbiddenActions: ["COMPARE_PLANS", "CONFIRM_PLAN"],
    rationaleTag: "PLAN_COUNT_0",
  },
  {
    id: "plan-count-one",
    inputContext: {
      surface: "PLAN_HOME",
      actorRole: "HOST",
      decisionContext: context({ planCount: 1, actorHasOpinion: false }),
      scenario: "여행안 1개",
    },
    eligibleActions: ["PROPOSE_ALTERNATIVE", "GIVE_OPINION"],
    acceptableTopActions: ["PROPOSE_ALTERNATIVE", "GIVE_OPINION"],
    forbiddenActions: ["COMPARE_PLANS", "CONFIRM_PLAN"],
    rationaleTag: "PLAN_COUNT_1",
  },
  {
    id: "plan-count-two-opinions-insufficient-host",
    inputContext: {
      surface: "PLAN_HOME",
      actorRole: "HOST",
      decisionContext: context({
        planCount: 2,
        opinionParticipantCount: 1,
        actorHasOpinion: false,
        confirmablePlanCount: 1,
      }),
      scenario: "여행안 2개 이상, 의견 참여 부족, 방장",
    },
    eligibleActions: [
      "COMPARE_PLANS",
      "PROPOSE_ALTERNATIVE",
      "GIVE_OPINION",
      "CONFIRM_PLAN",
    ],
    acceptableTopActions: ["COMPARE_PLANS", "GIVE_OPINION"],
    forbiddenActions: ["INVITE_MEMBER", "VIEW_ITINERARY"],
    rationaleTag: "OPINIONS_INSUFFICIENT_HOST",
  },
  {
    id: "plan-count-two-opinions-sufficient-host",
    inputContext: {
      surface: "PLAN_HOME",
      actorRole: "HOST",
      decisionContext: context({
        planCount: 2,
        opinionParticipantCount: 2,
        actorHasOpinion: true,
        confirmablePlanCount: 1,
      }),
      scenario: "여행안 2개 이상, 전원 의견 참여, 방장",
    },
    eligibleActions: ["COMPARE_PLANS", "PROPOSE_ALTERNATIVE", "CONFIRM_PLAN"],
    acceptableTopActions: ["COMPARE_PLANS", "CONFIRM_PLAN"],
    forbiddenActions: ["GIVE_OPINION", "VIEW_ITINERARY"],
    rationaleTag: "OPINIONS_SUFFICIENT_HOST",
  },
  {
    id: "plan-count-two-member",
    inputContext: {
      surface: "PLAN_HOME",
      actorRole: "MEMBER",
      decisionContext: context({
        planCount: 2,
        opinionParticipantCount: 1,
        actorHasOpinion: false,
        confirmablePlanCount: 1,
      }),
      scenario: "여행안 2개 이상, 일반 멤버",
    },
    eligibleActions: ["COMPARE_PLANS", "PROPOSE_ALTERNATIVE", "GIVE_OPINION"],
    acceptableTopActions: ["COMPARE_PLANS", "GIVE_OPINION"],
    forbiddenActions: ["INVITE_MEMBER", "CONFIRM_PLAN"],
    rationaleTag: "MEMBER_ROLE",
  },
  {
    id: "confirmed",
    inputContext: {
      surface: "PLAN_HOME",
      actorRole: "HOST",
      decisionContext: context({ planCount: 2, isConfirmed: true }),
      scenario: "여행 확정 완료",
    },
    eligibleActions: ["VIEW_ITINERARY"],
    acceptableTopActions: ["VIEW_ITINERARY"],
    forbiddenActions: ["CONFIRM_PLAN", "PROPOSE_ALTERNATIVE"],
    rationaleTag: "CONFIRMED",
  },
  {
    id: "draft-conflict",
    inputContext: {
      surface: "FIRST_PLAN",
      actorRole: "HOST",
      decisionContext: context({ conflict: "DRAFT" }),
      scenario: "draft conflict",
    },
    eligibleActions: [],
    acceptableTopActions: [],
    forbiddenActions: ["PUBLISH_FIRST_PLAN", "CONFIRM_PLAN"],
    rationaleTag: "DRAFT_CONFLICT",
  },
  {
    id: "revision-conflict",
    inputContext: {
      surface: "FIRST_PLAN",
      actorRole: "HOST",
      decisionContext: context({ conflict: "REVISION" }),
      scenario: "revision conflict",
    },
    eligibleActions: [],
    acceptableTopActions: [],
    forbiddenActions: ["PUBLISH_FIRST_PLAN", "CONFIRM_PLAN"],
    rationaleTag: "REVISION_CONFLICT",
  },
  {
    id: "single-eligible-action",
    inputContext: {
      surface: "PLAN_HOME",
      actorRole: "MEMBER",
      decisionContext: context({ planCount: 0 }),
      scenario: "AI 호출이 불필요한 단일 eligible action",
    },
    eligibleActions: ["EDIT_PLAN_BASIC"],
    acceptableTopActions: ["EDIT_PLAN_BASIC"],
    forbiddenActions: ["INVITE_MEMBER", "CONFIRM_PLAN"],
    rationaleTag: "SINGLE_ELIGIBLE_ACTION",
  },
];

const actorFor = (role: RoomRole): RoomActor => ({
  role,
  isHost: role === "HOST",
  isMember: role !== "GUEST",
  isGuest: role === "GUEST",
  can: (action) => ROLE_PERMISSIONS[role].has(action),
});

const rankingInputFor = (
  goldenCase: TripActionRankingGoldenCase
): TripActionRankingInput => {
  const eligibleActions = resolveEligibleTripActions(
    goldenCase.inputContext.decisionContext,
    actorFor(goldenCase.inputContext.actorRole)
  );
  const actualIds = eligibleActions.map(({ actionId }) => actionId);
  if (JSON.stringify(actualIds) !== JSON.stringify(goldenCase.eligibleActions)) {
    throw new Error(
      `${goldenCase.id}: eligible actions changed (${actualIds.join(", ")})`
    );
  }
  return {
    surface: goldenCase.inputContext.surface,
    decisions: resolveTripDecisions(goldenCase.inputContext.decisionContext),
    eligibleActions,
  };
};

const percentile = (values: ReadonlyArray<number>, ratio: number): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.ceil(sorted.length * ratio) - 1] ?? 0;
};

const rate = (count: number, total: number): number =>
  total === 0 ? 0 : count / total;

export const runTripActionRankingEval = async (
  candidates: ReadonlyArray<TripActionRankingEvalCandidate>,
  goldenCases = tripActionRankingGoldenCases
) => {
  if (candidates.length < 2) {
    throw new Error("At least two ranking candidates are required");
  }

  const reports = [];
  for (const candidate of candidates) {
    const cases = [];
    for (const goldenCase of goldenCases) {
      const input = rankingInputFor(goldenCase);
      if (input.eligibleActions.length <= 1) {
        cases.push({
          id: goldenCase.id,
          rationaleTag: goldenCase.rationaleTag,
          status: "SKIPPED" as const,
          reason: input.eligibleActions.length === 0
            ? "NO_ELIGIBLE_ACTION"
            : "SINGLE_ELIGIBLE_ACTION",
        });
        continue;
      }

      const outcome = await candidate.rank(input);
      const rankedActionIds = outcome.ranking
        ? [outcome.ranking.primaryActionId, ...outcome.ranking.alternativeActionIds]
        : [];
      const eligibleActionIds = new Set(goldenCase.eligibleActions);
      const forbiddenActionIds = new Set(goldenCase.forbiddenActions);
      const eligibilityViolation = rankedActionIds.some(
        (actionId) => !eligibleActionIds.has(actionId)
      );
      const forbiddenAction = rankedActionIds.some((actionId) =>
        forbiddenActionIds.has(actionId)
      );
      const validRanking = outcome.ranking
        ? Boolean(applyTripActionRanking(input.eligibleActions, outcome.ranking))
        : false;
      const top1Agreement = outcome.ranking
        ? goldenCase.acceptableTopActions.includes(outcome.ranking.primaryActionId)
        : false;
      const topKCoverage = rankedActionIds.some((actionId) =>
        goldenCase.acceptableTopActions.includes(actionId)
      );
      cases.push({
        id: goldenCase.id,
        rationaleTag: goldenCase.rationaleTag,
        status: outcome.ranking ? "COMPLETED" as const : "FAILED" as const,
        failure: outcome.failure,
        primaryActionId: outcome.ranking?.primaryActionId,
        eligibilityViolation,
        forbiddenAction,
        validRanking,
        top1Agreement,
        topKCoverage,
        ruleDisagreement: outcome.ranking?.primaryActionId !==
          input.eligibleActions[0]?.actionId,
        firstResponseLatencyMs: outcome.firstResponseLatencyMs,
        totalLatencyMs: outcome.totalLatencyMs,
        inputTokens: outcome.inputTokens,
        outputTokens: outcome.outputTokens,
        totalTokens: outcome.totalTokens,
        estimatedCostUsd: outcome.estimatedCostUsd,
      });
    }

    const invoked = cases.filter(({ status }) => status !== "SKIPPED");
    const completed = cases.filter(({ status }) => status === "COMPLETED");
    reports.push({
      candidateId: candidate.id,
      metrics: {
        totalCases: cases.length,
        invokedCases: invoked.length,
        skippedCases: cases.length - invoked.length,
        completedCases: completed.length,
        eligibilityViolationRate: rate(
          completed.filter(({ eligibilityViolation }) => eligibilityViolation).length,
          completed.length
        ),
        schemaFailureRate: rate(
          invoked.filter(({ failure, status, validRanking }) =>
            failure === "INVALID_OUTPUT" ||
            (status === "COMPLETED" && !validRanking)
          ).length,
          invoked.length
        ),
        goldenTop1Agreement: rate(
          completed.filter(({ top1Agreement }) => top1Agreement).length,
          completed.length
        ),
        goldenTopKCoverage: rate(
          completed.filter(({ topKCoverage }) => topKCoverage).length,
          completed.length
        ),
        forbiddenActionRate: rate(
          completed.filter(({ forbiddenAction }) => forbiddenAction).length,
          completed.length
        ),
        ruleDisagreementRate: rate(
          completed.filter(({ ruleDisagreement }) => ruleDisagreement).length,
          completed.length
        ),
        p50FirstResponseLatencyMs: percentile(
          invoked.map(({ firstResponseLatencyMs }) => firstResponseLatencyMs ?? 0),
          0.5
        ),
        p95FirstResponseLatencyMs: percentile(
          invoked.map(({ firstResponseLatencyMs }) => firstResponseLatencyMs ?? 0),
          0.95
        ),
        p50TotalLatencyMs: percentile(
          invoked.map(({ totalLatencyMs }) => totalLatencyMs ?? 0),
          0.5
        ),
        p95TotalLatencyMs: percentile(
          invoked.map(({ totalLatencyMs }) => totalLatencyMs ?? 0),
          0.95
        ),
        inputTokens: invoked.reduce(
          (sum, item) => sum + (item.inputTokens ?? 0),
          0
        ),
        outputTokens: invoked.reduce(
          (sum, item) => sum + (item.outputTokens ?? 0),
          0
        ),
        totalTokens: invoked.reduce(
          (sum, item) => sum + (item.totalTokens ?? 0),
          0
        ),
        estimatedCostPerRecommendationUsd: invoked.length === 0
          ? 0
          : invoked.reduce(
              (sum, item) => sum + (item.estimatedCostUsd ?? 0),
              0
            ) /
            invoked.length,
        providerErrorRate: rate(
          invoked.filter(({ failure }) => failure === "PROVIDER_ERROR").length,
          invoked.length
        ),
        timeoutRate: rate(
          invoked.filter(({ failure }) => failure === "TIMEOUT").length,
          invoked.length
        ),
      },
      cases,
    });
  }

  return { generatedAt: new Date().toISOString(), candidates: reports };
};
