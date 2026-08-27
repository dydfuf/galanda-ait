import { Effect, Layer, Logger, Schema } from "effect";
import { Hono, type Context as HonoContext } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { RepositoryError } from "../../src/core/domain/errors.ts";
import {
  RecommendNextActionRequestSchema,
  type RecommendNextActionResponse,
} from "../../src/contracts/recommendation.ts";
import {
  PlanIdSchema,
  RevisionSchema,
  TripIdSchema,
} from "../../src/core/domain/ids.ts";
import type { TripPlan } from "../../src/core/domain/room.ts";
import { ItineraryItemPatchSchema } from "../../src/core/domain/confirmed-itinerary.ts";
import type { IdGenerator } from "../../src/core/ports/id-generator.ts";
import type { InviteRepository } from "../../src/core/ports/invite-repository.ts";
import type { SessionService } from "../../src/core/ports/session.ts";
import type { TripRoomRepository } from "../../src/core/ports/trip-room-repository.ts";
import {
  TripActionRanker,
  type TripActionRankerService,
} from "../../src/core/ports/trip-action-ranker.ts";
import type { ConfirmedItineraryRepository } from "../../src/core/ports/confirmed-itinerary-repository.ts";
import {
  CreateRoomInputSchema,
  createTripRoom,
} from "../../src/core/usecases/create-room.ts";
import {
  getTripRoom,
  getTripRooms,
} from "../../src/core/usecases/get-room.ts";
import { confirmTripPlan } from "../../src/core/usecases/confirm-plan.ts";
import { getTripItinerary } from "../../src/core/usecases/get-itinerary.ts";
import {
  acknowledgeTripItinerary,
  reviseTripItinerary,
} from "../../src/core/usecases/revise-itinerary.ts";
import {
  PlanEditableFieldsSchema,
  createPlan,
  deletePlan,
  updatePlan,
} from "../../src/core/usecases/save-plan.ts";
import { submitOpinion } from "../../src/core/usecases/submit-opinion.ts";
import { updateTripRoom } from "../../src/core/usecases/update-room.ts";
import {
  recommendNextTripAction,
  type NextTripActionRecommendation,
} from "../../src/core/usecases/recommend-next-trip-action.ts";
import { IdGeneratorLive } from "../../src/infrastructure/id-generator.ts";
import { InviteRepositoryLive } from "../../src/infrastructure/persistence/drizzle/invite-repository.ts";
import { Database } from "../../src/infrastructure/persistence/drizzle/database.ts";
import { TripRoomRepositoryLive } from "../../src/infrastructure/persistence/drizzle/trip-room-repository.ts";
import { ConfirmedItineraryRepositoryLive } from "../../src/infrastructure/persistence/drizzle/confirmed-itinerary-repository.ts";
import type { AppEnv } from "../app.ts";
import {
  runEffect,
  type RunEffectOptions,
} from "../http/effect-handler.ts";
import { effectValidator } from "../http/effect-validator.ts";
import type { RequestScopeService } from "../http/request-scope.ts";
import {
  getPublicInviteSummary,
  issueTripInvite,
  joinTripByInvite,
  revokeTripInvite,
} from "../../src/core/usecases/invite.ts";
import {
  makeCachedTripActionRanker,
  makeCloudflareAiGatewayTripActionRanker,
} from "../infrastructure/ai/cloudflare-ai-gateway-trip-action-ranker.ts";

const TripParamsSchema = Schema.Struct({ tripId: TripIdSchema });
const PublicInviteParamsSchema = Schema.Struct({ inviteToken: Schema.String });
const JoinInviteRequestSchema = Schema.Struct({ nickname: Schema.String });
const PlanParamsSchema = Schema.Struct({
  tripId: TripIdSchema,
  planId: PlanIdSchema,
});
const ExpectedRevisionSchema = RevisionSchema.check(
  Schema.isInt(),
  Schema.isGreaterThanOrEqualTo(1)
);
const UpdateTripRequestSchema = Schema.Struct({
  title: Schema.optional(Schema.String),
  destination: Schema.optional(Schema.String),
  expectedRevision: ExpectedRevisionSchema,
});
const CreatePlanRequestSchema = Schema.Struct({
  ...PlanEditableFieldsSchema.fields,
  cloneFromPlanId: Schema.optional(PlanIdSchema),
  expectedRevision: ExpectedRevisionSchema,
});
const UpdatePlanRequestSchema = Schema.Struct({
  ...PlanEditableFieldsSchema.fields,
  expectedRevision: ExpectedRevisionSchema,
});
const RevisionRequestSchema = Schema.Struct({
  expectedRevision: ExpectedRevisionSchema,
});
const ReviseItineraryRequestSchema = Schema.Struct({
  patches: Schema.Array(ItineraryItemPatchSchema).check(Schema.isNonEmpty()),
  expectedRevision: ExpectedRevisionSchema,
});
const OpinionRequestSchema = Schema.Struct({
  reaction: Schema.Literals(["LIKE", "OKAY", "HARD"]),
  reason: Schema.optional(Schema.String),
  expectedRevision: ExpectedRevisionSchema,
});
const strictInput = { onExcessProperty: "error" } as const;

const toRecommendNextActionResponse = (
  recommendation: NextTripActionRecommendation
): RecommendNextActionResponse => ({
  recommendationId: recommendation.recommendationId,
  primary: {
    actionId: recommendation.primary.actionId,
    reasonCode: recommendation.primary.reasonCode,
  },
  alternatives: recommendation.alternatives.map(({ actionId }) => ({ actionId })),
  source: recommendation.source,
  policyVersion: recommendation.policyVersion,
  tripRevision: recommendation.tripRevision,
  contextFingerprint: recommendation.contextFingerprint,
});

const makeConfiguredTripActionRanker = (
  c: HonoContext<AppEnv>
): TripActionRankerService =>
  makeCloudflareAiGatewayTripActionRanker({
    accountId: c.env.AI_GATEWAY_ACCOUNT_ID ?? "",
    gatewayId: c.env.AI_GATEWAY_ID ?? "",
    gatewayToken: c.env.AI_GATEWAY_TOKEN ?? "",
    model: c.env.AI_RECOMMENDATION_MODEL ?? "",
    policyVersion: c.env.AI_RECOMMENDATION_POLICY_VERSION ?? "",
    timeoutMs: Number(c.env.AI_RECOMMENDATION_TIMEOUT_MS),
    openAiApiKey: c.env.OPENAI_API_KEY,
  });

const makeActiveTripActionRanker = (
  c: HonoContext<AppEnv>
): TripActionRankerService | undefined => {
  if ((c.env.AI_RECOMMENDATION_MODE?.trim() ?? "off") !== "active") {
    return undefined;
  }

  const policyVersion = c.env.AI_RECOMMENDATION_POLICY_VERSION?.trim() ?? "";
  const approvedPolicyVersion =
    c.env.AI_RECOMMENDATION_ACTIVE_APPROVED_POLICY_VERSION?.trim() ?? "";
  if (!policyVersion || approvedPolicyVersion !== policyVersion) {
    console.warn(JSON.stringify({
      message: "nba_active_rollout_not_approved",
      requestId: c.var.requestId,
      policyVersion: policyVersion || undefined,
    }));
    return undefined;
  }

  try {
    const ranker = makeConfiguredTripActionRanker(c);
    return typeof caches === "undefined"
      ? ranker
      : makeCachedTripActionRanker(
          ranker,
          caches.default,
          (promise) => c.executionCtx.waitUntil(promise)
        );
  } catch (error) {
    console.error(JSON.stringify({
      message: "nba_active_configuration_invalid",
      requestId: c.var.requestId,
      error: error instanceof Error ? error.message : String(error),
    }));
    return undefined;
  }
};

const runShadowRanking = (
  recommendation: NextTripActionRecommendation,
  ranker: TripActionRankerService,
  requestId: string,
  endpointWallLatencyMs: number
): Promise<void> =>
  Effect.runPromise(
    ranker.rank(recommendation.rankingInput).pipe(
      Effect.tap((ranking) =>
        Effect.logInfo("nba_shadow_completed").pipe(
          Effect.annotateLogs({
            eventName: "nba_shadow_completed",
            ruleActionId: recommendation.primary.actionId,
            shadowActionId: ranking.primaryActionId,
            disagreed: ranking.primaryActionId !== recommendation.primary.actionId,
            eligibleActionCount: recommendation.rankingInput.eligibleActions.length,
            contextFingerprint: recommendation.contextFingerprint,
            policyVersion: ranker.policyVersion,
            endpointWallLatencyMs,
          })
        )
      ),
      Effect.map(() => undefined),
      Effect.catch((error) =>
        Effect.logWarning("nba_shadow_failed").pipe(
          Effect.annotateLogs({
            eventName: "nba_shadow_failed",
            failure: error.reason,
            eligibleActionCount: recommendation.rankingInput.eligibleActions.length,
            contextFingerprint: recommendation.contextFingerprint,
            policyVersion: ranker.policyVersion,
            endpointWallLatencyMs,
          })
        )
      ),
      Effect.annotateLogs({ requestId }),
      Effect.provide(Logger.layer([Logger.consoleStructured]))
    )
  );

const scheduleShadowRanking = (
  c: HonoContext<AppEnv>,
  recommendation: NextTripActionRecommendation,
  endpointWallLatencyMs: number
) => {
  if ((c.env.AI_RECOMMENDATION_MODE?.trim() ?? "off") !== "shadow") return;

  if (recommendation.rankingInput.eligibleActions.length === 1) {
    c.executionCtx.waitUntil(Effect.runPromise(
      Effect.logInfo("nba_shadow_skipped").pipe(
        Effect.annotateLogs({
          eventName: "nba_shadow_skipped",
          reason: "SINGLE_ELIGIBLE_ACTION",
          contextFingerprint: recommendation.contextFingerprint,
          endpointWallLatencyMs,
          requestId: c.var.requestId,
        }),
        Effect.provide(Logger.layer([Logger.consoleStructured]))
      )
    ));
    return;
  }

  const ranker = makeConfiguredTripActionRanker(c);
  c.executionCtx.waitUntil(runShadowRanking(
    recommendation,
    ranker,
    c.var.requestId,
    endpointWallLatencyMs
  ));
};

type TripRequirements =
  | RequestScopeService
  | SessionService
  | TripRoomRepository
  | ConfirmedItineraryRepository
  | InviteRepository
  | IdGenerator;

const runTripEffect = <A, E>(
  c: HonoContext<AppEnv>,
  effect: Effect.Effect<A, E, TripRequirements>,
  status?: ContentfulStatusCode,
  mapSuccess?: RunEffectOptions<A>["mapSuccess"]
): Promise<Response> => {
  const db = c.var.database;
  if (!db) {
    return runEffect(
      c,
      Effect.fail(
        new RepositoryError({
          operation: "TripRoomRepositoryLive",
          message: "데이터베이스를 사용할 수 없습니다.",
        })
      )
    );
  }

  const services = Layer.mergeAll(
    TripRoomRepositoryLive.pipe(
      Layer.provide(Layer.succeed(Database, { db }))
    ),
    InviteRepositoryLive.pipe(
      Layer.provide(Layer.succeed(Database, { db }))
    ),
    ConfirmedItineraryRepositoryLive.pipe(
      Layer.provide(Layer.succeed(Database, { db }))
    ),
    IdGeneratorLive
  );
  return runEffect(c, effect.pipe(Effect.provide(services)), {
    status,
    mapSuccess,
  });
};

export const tripsRoute = new Hono<AppEnv>();
export const invitesRoute = new Hono<AppEnv>();

invitesRoute.get(
  "/:inviteToken",
  effectValidator("param", PublicInviteParamsSchema),
  (c) =>
    runTripEffect(
      c,
      getPublicInviteSummary(c.req.valid("param").inviteToken)
    )
);

invitesRoute.post(
  "/:inviteToken/join",
  effectValidator("param", PublicInviteParamsSchema),
  effectValidator("json", JoinInviteRequestSchema, strictInput),
  (c) =>
    runTripEffect(
      c,
      joinTripByInvite(
        c.req.valid("param").inviteToken,
        c.req.valid("json").nickname
      )
    )
);

tripsRoute.get("/", (c) => runTripEffect(c, getTripRooms()));

tripsRoute.get(
  "/:tripId/itinerary",
  effectValidator("param", TripParamsSchema),
  (c) => runTripEffect(c, getTripItinerary(c.req.valid("param").tripId))
);

tripsRoute.patch(
  "/:tripId/itinerary",
  effectValidator("param", TripParamsSchema),
  effectValidator("json", ReviseItineraryRequestSchema, strictInput),
  (c) =>
    runTripEffect(
      c,
      reviseTripItinerary(
        c.req.valid("param").tripId,
        c.req.valid("json").patches,
        c.req.valid("json").expectedRevision
      )
    )
);

tripsRoute.post(
  "/:tripId/itinerary/acknowledgements",
  effectValidator("param", TripParamsSchema),
  effectValidator("json", RevisionRequestSchema, strictInput),
  (c) =>
    runTripEffect(
      c,
      acknowledgeTripItinerary(
        c.req.valid("param").tripId,
        c.req.valid("json").expectedRevision
      )
    )
);

tripsRoute.post(
  "/:tripId/recommendations/next",
  effectValidator("param", TripParamsSchema),
  effectValidator("json", RecommendNextActionRequestSchema, strictInput),
  (c) => {
    const startedAt = Date.now();
    const recommendation = recommendNextTripAction({
      tripId: c.req.valid("param").tripId,
      ...c.req.valid("json"),
    });
    const activeRanker = makeActiveTripActionRanker(c);
    return runTripEffect(
      c,
      activeRanker
        ? recommendation.pipe(
            Effect.provideService(TripActionRanker, activeRanker)
          )
        : recommendation,
      undefined,
      (recommendation, context) => {
        try {
          scheduleShadowRanking(
            context,
            recommendation,
            Date.now() - startedAt
          );
        } catch (error) {
          console.error(JSON.stringify({
            message: "nba_shadow_schedule_failed",
            requestId: context.var.requestId,
            error: error instanceof Error ? error.message : String(error),
          }));
        }
        return context.json(toRecommendNextActionResponse(recommendation));
      }
    );
  }
);

tripsRoute.get(
  "/:tripId",
  effectValidator("param", TripParamsSchema),
  (c) => runTripEffect(c, getTripRoom(c.req.valid("param").tripId))
);

tripsRoute.post(
  "/",
  effectValidator("json", CreateRoomInputSchema, strictInput),
  (c) => runTripEffect(c, createTripRoom(c.req.valid("json")), 201)
);

tripsRoute.patch(
  "/:tripId",
  effectValidator("param", TripParamsSchema),
  effectValidator("json", UpdateTripRequestSchema, strictInput),
  (c) => {
    const { expectedRevision, ...params } = c.req.valid("json");
    return runTripEffect(
      c,
      updateTripRoom({
        roomId: c.req.valid("param").tripId,
        params,
        expectedRevision,
      })
    );
  }
);

tripsRoute.post(
  "/:tripId/plans",
  effectValidator("param", TripParamsSchema),
  effectValidator("json", CreatePlanRequestSchema, strictInput),
  (c) =>
    runTripEffect(
      c,
      createPlan({
        roomId: c.req.valid("param").tripId,
        ...c.req.valid("json"),
      }),
      201
    )
);

tripsRoute.patch(
  "/:tripId/plans/:planId",
  effectValidator("param", PlanParamsSchema),
  effectValidator("json", UpdatePlanRequestSchema, strictInput),
  (c) => {
    const { expectedRevision, ...fields } = c.req.valid("json");
    const plan: TripPlan = {
      id: c.req.valid("param").planId,
      ...fields,
      status: "DRAFT",
      voteCount: 0,
    };
    return runTripEffect(
      c,
      updatePlan({
        roomId: c.req.valid("param").tripId,
        plan,
        expectedRevision,
      })
    );
  }
);

tripsRoute.delete(
  "/:tripId/plans/:planId",
  effectValidator("param", PlanParamsSchema),
  effectValidator("json", RevisionRequestSchema, strictInput),
  (c) =>
    runTripEffect(
      c,
      deletePlan({
        roomId: c.req.valid("param").tripId,
        planId: c.req.valid("param").planId,
        expectedRevision: c.req.valid("json").expectedRevision,
      })
    )
);

tripsRoute.put(
  "/:tripId/plans/:planId/opinion",
  effectValidator("param", PlanParamsSchema),
  effectValidator("json", OpinionRequestSchema, strictInput),
  (c) => {
    const { expectedRevision, ...opinion } = c.req.valid("json");
    return runTripEffect(
      c,
      submitOpinion({
        roomId: c.req.valid("param").tripId,
        planId: c.req.valid("param").planId,
        opinion,
        expectedRevision,
      })
    );
  }
);

tripsRoute.post(
  "/:tripId/plans/:planId/confirm",
  effectValidator("param", PlanParamsSchema),
  effectValidator("json", RevisionRequestSchema, strictInput),
  (c) =>
    runTripEffect(
      c,
      confirmTripPlan(
        c.req.valid("param").tripId,
        c.req.valid("param").planId,
        c.req.valid("json").expectedRevision
      ).pipe(Effect.map((itinerary) => ({ status: "CONFIRMED" as const, itinerary })))
    )
);

tripsRoute.post(
  "/:tripId/invites",
  effectValidator("param", TripParamsSchema),
  (c) => runTripEffect(c, issueTripInvite(c.req.valid("param").tripId), 201)
);

tripsRoute.delete(
  "/:tripId/invites",
  effectValidator("param", TripParamsSchema),
  (c) => runTripEffect(c, revokeTripInvite(c.req.valid("param").tripId))
);
