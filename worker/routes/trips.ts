import { Effect, Layer, Schema } from "effect";
import { Hono, type Context as HonoContext } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { RepositoryError } from "../../src/core/domain/errors.ts";
import {
  RevisionSchema,
  TripIdSchema,
} from "../../src/core/domain/ids.ts";
import type { IdGenerator } from "../../src/core/ports/id-generator.ts";
import type { SessionService } from "../../src/core/ports/session.ts";
import type { TripRoomRepository } from "../../src/core/ports/trip-room-repository.ts";
import {
  CreateRoomInputSchema,
  createTripRoom,
} from "../../src/core/usecases/create-room.ts";
import {
  getTripRoom,
  getTripRooms,
} from "../../src/core/usecases/get-room.ts";
import { updateTripRoom } from "../../src/core/usecases/update-room.ts";
import { IdGeneratorLive } from "../../src/infrastructure/id-generator.ts";
import { Database } from "../../src/infrastructure/persistence/drizzle/database.ts";
import { TripRoomRepositoryLive } from "../../src/infrastructure/persistence/drizzle/trip-room-repository.ts";
import type { AppEnv } from "../app.ts";
import { runEffect } from "../http/effect-handler.ts";
import { effectValidator } from "../http/effect-validator.ts";
import type { RequestScopeService } from "../http/request-scope.ts";

const TripParamsSchema = Schema.Struct({ tripId: TripIdSchema });
const UpdateTripRequestSchema = Schema.Struct({
  title: Schema.optional(Schema.String),
  destination: Schema.optional(Schema.String),
  expectedRevision: RevisionSchema.check(
    Schema.isInt(),
    Schema.isGreaterThanOrEqualTo(1)
  ),
});
const strictInput = { onExcessProperty: "error" } as const;

type TripRequirements =
  | RequestScopeService
  | SessionService
  | TripRoomRepository
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

  const services = Layer.merge(
    TripRoomRepositoryLive.pipe(
      Layer.provide(Layer.succeed(Database, { db }))
    ),
    IdGeneratorLive
  );
  return runEffect(c, effect.pipe(Effect.provide(services)), { status });
};

export const tripsRoute = new Hono<AppEnv>();

tripsRoute.get("/", (c) => runTripEffect(c, getTripRooms()));

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
