import { Effect, Layer, Schema } from "effect";
import { Hono, type Context as HonoContext } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { RepositoryError } from "../../src/core/domain/errors.ts";
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
import { IdGeneratorLive } from "../../src/infrastructure/id-generator.ts";
import { InviteRepositoryLive } from "../../src/infrastructure/persistence/drizzle/invite-repository.ts";
import { Database } from "../../src/infrastructure/persistence/drizzle/database.ts";
import { TripRoomRepositoryLive } from "../../src/infrastructure/persistence/drizzle/trip-room-repository.ts";
import { ConfirmedItineraryRepositoryLive } from "../../src/infrastructure/persistence/drizzle/confirmed-itinerary-repository.ts";
import type { AppEnv } from "../app.ts";
import { runEffect } from "../http/effect-handler.ts";
import { effectValidator } from "../http/effect-validator.ts";
import type { RequestScopeService } from "../http/request-scope.ts";
import {
  getPublicInviteSummary,
  issueTripInvite,
  joinTripByInvite,
  revokeTripInvite,
} from "../../src/core/usecases/invite.ts";

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
  status?: ContentfulStatusCode
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
  return runEffect(c, effect.pipe(Effect.provide(services)), { status });
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
