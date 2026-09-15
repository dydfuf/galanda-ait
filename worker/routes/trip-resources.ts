import { Hono, type Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import { Effect, Layer, Schema } from "effect";
import type { AppEnv } from "../app.ts";
import { effectValidator } from "../http/effect-validator.ts";
import { runEffect } from "../http/effect-handler.ts";
import type { RequestScopeService } from "../http/request-scope.ts";
import { formatApiError } from "../http/api-error.ts";
import { TripIdSchema } from "../../src/core/domain/ids.ts";
import { RepositoryError } from "../../src/core/domain/errors.ts";
import type { SessionService } from "../../src/core/ports/session.ts";
import type { TripRoomRepository } from "../../src/core/ports/trip-room-repository.ts";
import type { TripResourceRepository } from "../../src/core/ports/trip-resource-repository.ts";
import { TripResourceExtractor } from "../../src/core/ports/trip-resource-extractor.ts";
import { Database } from "../../src/infrastructure/persistence/drizzle/database.ts";
import { TripRoomRepositoryLive } from "../../src/infrastructure/persistence/drizzle/trip-room-repository.ts";
import { DrizzleTripResourceRepositoryLive } from "../../src/infrastructure/persistence/drizzle/trip-resource-repository.ts";
import { makeTripResourceExtractor } from "../infrastructure/ai/trip-resource-extractor.ts";
import { CreateResourceRequestSchema, EditResourcePlaceRequestSchema, ResourceParamsSchema, ResourceRevisionRequestSchema } from "../../src/contracts/trip-resource.ts";
import { createTripResource, deleteTripResource, editTripResourcePlace, listTripResources, organizeTripResource } from "../../src/core/usecases/trip-resources.ts";

type Requirements = RequestScopeService | SessionService | TripRoomRepository | TripResourceRepository | TripResourceExtractor;

const runResourceEffect = <A, E>(c: Context<AppEnv>, program: Effect.Effect<A, E, Requirements>, status: 200 | 201 = 200) => {
  const db = c.var.database;
  if (!db) return runEffect(c, Effect.fail(new RepositoryError({ operation: "tripResources", message: "데이터베이스를 사용할 수 없습니다." })));
  const services = Layer.mergeAll(
    TripRoomRepositoryLive.pipe(Layer.provide(Layer.succeed(Database, { db }))),
    DrizzleTripResourceRepositoryLive(db),
    Layer.succeed(TripResourceExtractor, makeTripResourceExtractor({
      accountId: c.env.AI_GATEWAY_ACCOUNT_ID,
      gatewayId: c.env.AI_GATEWAY_ID,
      gatewayToken: c.env.AI_GATEWAY_TOKEN,
      model: c.env.AI_RESOURCE_MODEL,
      openAiApiKey: c.env.OPENAI_API_KEY,
    })),
  );
  return runEffect(c, program.pipe(Effect.provide(services)), { status });
};

export const tripResourcesRoute = new Hono<AppEnv>();
const strictInput = { onExcessProperty: "error" } as const;
const collectionParams = effectValidator("param", Schema.Struct({ tripId: TripIdSchema }));
const resourceParams = effectValidator("param", ResourceParamsSchema);
const revisionBody = effectValidator("json", ResourceRevisionRequestSchema, strictInput);

tripResourcesRoute.use("/:tripId/resources/*", bodyLimit({
  maxSize: 100_000,
  onError: (c) => c.json(formatApiError({ code: "INVALID_REQUEST", message: "자료가 너무 커요. 메모를 나누어 저장해주세요.", requestId: c.var.requestId }), 413),
}));

tripResourcesRoute.get("/:tripId/resources", collectionParams, (c) =>
  runResourceEffect(c, listTripResources(c.req.valid("param").tripId)));
tripResourcesRoute.post("/:tripId/resources", collectionParams,
  effectValidator("json", CreateResourceRequestSchema, strictInput), (c) =>
    runResourceEffect(c, createTripResource(c.req.valid("param").tripId, c.req.valid("json")), 201));
tripResourcesRoute.post("/:tripId/resources/:resourceId/organize", resourceParams, revisionBody, (c) => {
  const { tripId, resourceId } = c.req.valid("param");
  return runResourceEffect(c, organizeTripResource(tripId, resourceId, c.req.valid("json").expectedRevision));
});
tripResourcesRoute.patch("/:tripId/resources/:resourceId/places", resourceParams,
  effectValidator("json", EditResourcePlaceRequestSchema, strictInput), (c) => {
    const { tripId, resourceId } = c.req.valid("param");
    return runResourceEffect(c, editTripResourcePlace(tripId, resourceId, c.req.valid("json")));
  });
tripResourcesRoute.delete("/:tripId/resources/:resourceId", resourceParams, revisionBody, (c) => {
  const { tripId, resourceId } = c.req.valid("param");
  return runResourceEffect(c, deleteTripResource(tripId, resourceId, c.req.valid("json").expectedRevision));
});
