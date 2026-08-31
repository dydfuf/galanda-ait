import { Effect, Layer, Schema } from "effect";
import { Hono, type Context as HonoContext } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { RepositoryError } from "../../src/core/domain/errors.ts";
import {
  ExploreListingIdSchema,
  PlanIdSchema,
  TripIdSchema,
} from "../../src/core/domain/ids.ts";
import {
  decodeExploreCursor,
  encodeExploreCursor,
  encodeExploreFiltersKey,
  EXPLORE_LISTINGS_DEFAULT_LIMIT,
  ExploreListingItemSchema,
  ExploreListingResponseSchema,
  ExploreListingsQuerySchema,
  normalizeExploreListingsFilters,
  ImportExplorePlanRequestSchema,
  ImportExplorePlanResponseSchema,
  InvalidExploreCursorError,
  ListPlanInExploreRequestSchema,
  RelistPlanInExploreRequestSchema,
  UnlistPlanFromExploreRequestSchema,
  type ExploreListingsResponseEncoded,
} from "../../src/contracts/explore.ts";
import {
  decodeSavedCursor,
  encodeSavedCursor,
  ExploreSaveMutationRequestSchema,
  ExploreSaveStateResponseSchema,
  SAVED_LISTINGS_DEFAULT_LIMIT,
  SavedListingItemSchema,
  SavedListingsQuerySchema,
  InvalidSavedCursorError,
  type SavedListingsResponseEncoded,
} from "../../src/contracts/explore-save.ts";
import type { ExplorePlanListing } from "../../src/core/domain/explore-plan.ts";
import type {
  ExploreListingCursor,
  ExploreListingFilters,
  ExplorePlanRepository,
  ListListedResult,
} from "../../src/core/ports/explore-plan-repository.ts";
import type {
  ExploreSaveRepository,
  ListSavedListingsResult,
  SavedListingCursor,
} from "../../src/core/ports/explore-save-repository.ts";
import type { IdGenerator } from "../../src/core/ports/id-generator.ts";
import type { SessionService } from "../../src/core/ports/session.ts";
import type { TripRoomRepository } from "../../src/core/ports/trip-room-repository.ts";
import {
  getExploreListingDetail,
  listExploreListings,
  listPlanInExplore,
  relistPlanInExplore,
  unlistPlanFromExplore,
} from "../../src/core/usecases/explore-listing.ts";
import { importExplorePlan } from "../../src/core/usecases/import-explore-plan.ts";
import {
  getExploreSaveState,
  listSavedExploreListings,
  saveExploreListing,
  unsaveExploreListing,
} from "../../src/core/usecases/explore-save.ts";
import { IdGeneratorLive } from "../../src/infrastructure/id-generator.ts";
import { Database } from "../../src/infrastructure/persistence/drizzle/database.ts";
import { ExplorePlanRepositoryLive } from "../../src/infrastructure/persistence/drizzle/explore-plan-repository.ts";
import { ExploreSaveRepositoryLive } from "../../src/infrastructure/persistence/drizzle/explore-save-repository.ts";
import { TripRoomRepositoryLive } from "../../src/infrastructure/persistence/drizzle/trip-room-repository.ts";
import type { AppEnv } from "../app.ts";
import { formatApiError } from "../http/api-error.ts";
import { runEffect } from "../http/effect-handler.ts";
import { effectValidator } from "../http/effect-validator.ts";
import type { RequestScopeService } from "../http/request-scope.ts";

const strictInput = { onExcessProperty: "error" } as const;

const ExplorePlanParamsSchema = Schema.Struct({
  tripId: TripIdSchema,
  planId: PlanIdSchema,
});
const ExploreListingParamsSchema = Schema.Struct({
  listingId: ExploreListingIdSchema,
});

/**
 * public response로 encode한다. source-only reference는 schema에 없으므로
 * response JSON에 절대 포함되지 않는다.
 */
const toExploreListingResponse = (
  listing: ExplorePlanListing
): typeof ExploreListingResponseSchema.Encoded =>
  Schema.encodeSync(ExploreListingResponseSchema)(listing);

type ExploreRequirements =
  | RequestScopeService
  | SessionService
  | TripRoomRepository
  | ExplorePlanRepository
  | IdGenerator;

const runExploreEffect = <E>(
  c: HonoContext<AppEnv>,
  effect: Effect.Effect<ExplorePlanListing, E, ExploreRequirements>,
  status?: ContentfulStatusCode
): Promise<Response> => {
  const db = c.var.database;
  if (!db) {
    return runEffect(
      c,
      Effect.fail(
        new RepositoryError({
          operation: "ExplorePlanRepositoryLive",
          message: "데이터베이스를 사용할 수 없습니다.",
        })
      )
    );
  }

  const services = Layer.mergeAll(
    TripRoomRepositoryLive.pipe(Layer.provide(Layer.succeed(Database, { db }))),
    ExplorePlanRepositoryLive.pipe(
      Layer.provide(Layer.succeed(Database, { db }))
    ),
    IdGeneratorLive
  );

  return runEffect(c, effect.pipe(Effect.provide(services)), {
    status,
    mapSuccess: (listing, ctx) =>
      ctx.json(toExploreListingResponse(listing), status ?? 200),
  });
};

/** POST /api/trips/:tripId/plans/:planId/explore-listing (최초 게시) */
export const explorePlanListingRoute = new Hono<AppEnv>();

explorePlanListingRoute.post(
  "/:tripId/plans/:planId/explore-listing",
  effectValidator("param", ExplorePlanParamsSchema),
  // body는 서버 소유 필드 spoof를 막기 위해 empty strict DTO만 허용한다.
  effectValidator("json", ListPlanInExploreRequestSchema, strictInput),
  (c) =>
    runExploreEffect(
      c,
      listPlanInExplore({
        sourceTripId: c.req.valid("param").tripId,
        sourcePlanId: c.req.valid("param").planId,
      }),
      201
    )
);

/** /api/explore/* (unlist/relist) */
export const exploreRoute = new Hono<AppEnv>();

exploreRoute.delete(
  "/listings/:listingId",
  effectValidator("param", ExploreListingParamsSchema),
  effectValidator("json", UnlistPlanFromExploreRequestSchema, strictInput),
  (c) =>
    runExploreEffect(
      c,
      unlistPlanFromExplore({
        listingId: c.req.valid("param").listingId,
        expectedRevision: c.req.valid("json").expectedRevision,
      })
    )
);

exploreRoute.post(
  "/listings/:listingId/relist",
  effectValidator("param", ExploreListingParamsSchema),
  effectValidator("json", RelistPlanInExploreRequestSchema, strictInput),
  (c) =>
    runExploreEffect(
      c,
      relistPlanInExplore({
        listingId: c.req.valid("param").listingId,
        expectedRevision: c.req.valid("json").expectedRevision,
      })
    )
);

/**
 * POST /api/explore/listings/:listingId/import (RAON-261 DISC-7 snapshot import).
 *
 * LISTED public snapshot을 사용자의 private plan으로 복사한다. body는 `target`만
 * 받으며(strict decode + tagged union이 actor/author/snapshot/status/revision/
 * provenance spoof를 거부), listingId는 path param이다. 응답은 정확히
 * `{ tripId, planId }` allowlist만 담고 imported plan 내부/snapshot/provenance/
 * source private reference를 노출하지 않는다.
 *
 * route는 ExplorePlanRepository + TripRoomRepository + IdGenerator만 request-scoped
 * 로 제공한다. source room lookup을 하지 않으며 private aggregate read-through가
 * 구조적으로 불가능하다(오직 listing snapshot만 읽는다).
 *
 * 상태 구분:
 * - 성공 → 201 + { tripId, planId }.
 * - listing 없음(deleted/invalid/never-existed) → 404 NOT_FOUND.
 * - UNLISTED → 410 LISTING_UNAVAILABLE.
 * - EXISTING_TRIP stale revision → 409 REVISION_CONFLICT.
 * - infra 장애 → 503.
 */
exploreRoute.post(
  "/listings/:listingId/import",
  effectValidator("param", ExploreListingParamsSchema),
  effectValidator("json", ImportExplorePlanRequestSchema, strictInput),
  (c) => {
    const db = c.var.database;
    if (!db) {
      return runEffect(
        c,
        Effect.fail(
          new RepositoryError({
            operation: "ExplorePlanRepositoryLive",
            message: "데이터베이스를 사용할 수 없습니다.",
          })
        )
      );
    }

    const services = Layer.mergeAll(
      TripRoomRepositoryLive.pipe(
        Layer.provide(Layer.succeed(Database, { db }))
      ),
      ExplorePlanRepositoryLive.pipe(
        Layer.provide(Layer.succeed(Database, { db }))
      ),
      IdGeneratorLive
    );

    return runEffect(
      c,
      importExplorePlan({
        listingId: c.req.valid("param").listingId,
        target: c.req.valid("json").target,
      }).pipe(Effect.provide(services)),
      {
        mapSuccess: (result, ctx) =>
          ctx.json(
            Schema.encodeSync(ImportExplorePlanResponseSchema)(result),
            201
          ),
      }
    );
  }
);

/**
 * GET /api/explore/listings (RAON-260 DISC-4 public feed).
 *
 * authenticated session만 요구한다. read query use case는 room membership을 보지
 * 않고 `TripRoomRepository`도 제공하지 않으므로 private aggregate read-through가
 * 구조적으로 불가능하다. 응답은 public envelope + immutable snapshot page이며,
 * nextCursor는 서버가 발급한 opaque token이다.
 *
 * `limit`은 strict bounded 정수로 query validator가 검증한다(범위를 벗어나면 400).
 * `cursor`는 opaque token이라 handler에서 해독하며, 해독 실패는 400(INVALID_REQUEST)
 * 으로 매핑한다(첫 페이지로 조용히 fallback하지 않는다).
 */
const toExploreListingsResponse = (
  result: ListListedResult,
  filterKey: string
): ExploreListingsResponseEncoded => {
  const items = result.page.map((listing) => {
    if (listing.status !== "LISTED") {
      throw new Error("Explore feed repository returned an unlisted item.");
    }
    return Schema.encodeSync(ExploreListingItemSchema)({
      ...listing,
      status: "LISTED" as const,
    });
  });
  return result.nextCursor
    ? {
        items,
        nextCursor: encodeExploreCursor({ ...result.nextCursor, filterKey }),
      }
    : { items };
};

exploreRoute.get(
  "/listings",
  effectValidator("query", ExploreListingsQuerySchema, strictInput),
  (c) => {
    const requestId = c.var.requestId ?? crypto.randomUUID();
    const query = c.req.valid("query");

    const filters: ExploreListingFilters = normalizeExploreListingsFilters({
      query: query.query,
      destination: query.destination,
      routeCity: query.routeCity,
      startDate: query.startDate,
      endDate: query.endDate,
    });
    const filterKey = encodeExploreFiltersKey(filters);

    let cursor: ExploreListingCursor | undefined;
    if (query.cursor !== undefined) {
      try {
        const payload = decodeExploreCursor(query.cursor);
        if (payload.filterKey !== filterKey) {
          throw new InvalidExploreCursorError();
        }
        cursor = {
          listedAt: payload.listedAt,
          listingId: payload.listingId,
        };
      } catch (error) {
        if (error instanceof InvalidExploreCursorError) {
          return Promise.resolve(
            c.json(
              formatApiError({
                code: "INVALID_REQUEST",
                message: "요청 형식이 올바르지 않습니다.",
                requestId,
              }),
              400
            )
          );
        }
        throw error;
      }
    }

    const limit = query.limit ?? EXPLORE_LISTINGS_DEFAULT_LIMIT;

    const db = c.var.database;
    if (!db) {
      return runEffect(
        c,
        Effect.fail(
          new RepositoryError({
            operation: "ExplorePlanRepositoryLive",
            message: "데이터베이스를 사용할 수 없습니다.",
          })
        )
      );
    }

    // read query는 ExplorePlanRepository만 필요하다. TripRoomRepository를 제공하지
    // 않아 private aggregate read-through를 구조적으로 차단한다.
    const services = ExplorePlanRepositoryLive.pipe(
      Layer.provide(Layer.succeed(Database, { db }))
    );

    return runEffect(
      c,
      listExploreListings({ limit, cursor, filters }).pipe(Effect.provide(services)),
      {
        mapSuccess: (result, ctx) =>
          ctx.json(toExploreListingsResponse(result, filterKey), 200),
      }
    );
  }
);

/**
 * GET /api/explore/listings/:listingId (RAON-263 DISC-5 focused detail).
 *
 * feed와 동일하게 authenticated session만 요구하는 public read다. read query
 * use case는 room membership을 보지 않고 `TripRoomRepository`도 제공하지 않으므로
 * private aggregate read-through가 구조적으로 불가능하다. `listingId`는 path
 * validator가 검증한다(형식 오류는 400). 응답은 오직 LISTED public envelope +
 * immutable snapshot이며, source private reference는 schema에 없어 노출되지 않는다.
 *
 * 상태 구분:
 * - LISTED → 200 + public detail.
 * - record 없음(deleted/invalid/never-existed) → 404 NOT_FOUND.
 * - UNLISTED(게시 중단) → 410 LISTING_UNAVAILABLE.
 * - infra 장애 → 503.
 */
exploreRoute.get(
  "/listings/:listingId",
  effectValidator("param", ExploreListingParamsSchema),
  (c) => {
    const db = c.var.database;
    if (!db) {
      return runEffect(
        c,
        Effect.fail(
          new RepositoryError({
            operation: "ExplorePlanRepositoryLive",
            message: "데이터베이스를 사용할 수 없습니다.",
          })
        )
      );
    }

    // detail read도 ExplorePlanRepository만 제공한다(TripRoomRepository 미제공).
    const services = ExplorePlanRepositoryLive.pipe(
      Layer.provide(Layer.succeed(Database, { db }))
    );

    return runEffect(
      c,
      getExploreListingDetail({
        listingId: c.req.valid("param").listingId,
      }).pipe(Effect.provide(services)),
      {
        mapSuccess: (listing, ctx) =>
          ctx.json(
            Schema.encodeSync(ExploreListingItemSchema)({
              ...listing,
              status: "LISTED" as const,
            }),
            200
          ),
      }
    );
  }
);


// --- save / unsave / saved-list (RAON-254 DISC-6) ---------------------------

/** save state response encode helper. */
const toSaveStateResponse = (state: {
  readonly saved: boolean;
}): typeof ExploreSaveStateResponseSchema.Encoded =>
  Schema.encodeSync(ExploreSaveStateResponseSchema)(state);

type ExploreSaveRequirements =
  | RequestScopeService
  | SessionService
  | ExplorePlanRepository
  | ExploreSaveRepository
  | IdGenerator;

/**
 * save mutation/query effect runner.
 *
 * save use case는 listing LISTED 여부 확인을 위해 `ExplorePlanRepository`가,
 * idempotent 저장/삭제/상태 조회를 위해 `ExploreSaveRepository`가 필요하다.
 * private `TripRoomRepository`는 제공하지 않으므로 public read 경계를 벗어나
 * private aggregate를 read-through할 수 없다.
 */
const runExploreSaveEffect = <E>(
  c: HonoContext<AppEnv>,
  effect: Effect.Effect<
    { readonly saved: boolean },
    E,
    ExploreSaveRequirements
  >,
  status?: ContentfulStatusCode
): Promise<Response> => {
  const db = c.var.database;
  if (!db) {
    return runEffect(
      c,
      Effect.fail(
        new RepositoryError({
          operation: "ExploreSaveRepositoryLive",
          message: "데이터베이스를 사용할 수 없습니다.",
        })
      )
    );
  }

  const services = Layer.mergeAll(
    ExplorePlanRepositoryLive.pipe(
      Layer.provide(Layer.succeed(Database, { db }))
    ),
    ExploreSaveRepositoryLive.pipe(
      Layer.provide(Layer.succeed(Database, { db }))
    ),
    IdGeneratorLive
  );

  return runEffect(c, effect.pipe(Effect.provide(services)), {
    status,
    mapSuccess: (state, ctx) => ctx.json(toSaveStateResponse(state), status ?? 200),
  });
};

/**
 * POST /api/explore/listings/:listingId/save (idempotent save).
 *
 * body는 서버 소유 actor 필드 spoof를 막기 위해 empty strict DTO만 허용한다.
 * LISTED만 저장 가능하며(정책), 없음/UNLISTED는 404/410으로 분기한다. 이미 저장된
 * 경우 no-op이고 `{ saved: true }`로 응답한다(idempotent).
 */
exploreRoute.post(
  "/listings/:listingId/save",
  effectValidator("param", ExploreListingParamsSchema),
  effectValidator("json", ExploreSaveMutationRequestSchema, strictInput),
  (c) =>
    runExploreSaveEffect(
      c,
      saveExploreListing({ listingId: c.req.valid("param").listingId })
    )
);

/**
 * DELETE /api/explore/listings/:listingId/save (idempotent unsave).
 *
 * empty strict body만 허용한다. 저장돼 있지 않아도, listing이 없거나 UNLISTED여도
 * 실패하지 않고 `{ saved: false }`로 응답한다(반복 안전).
 */
exploreRoute.delete(
  "/listings/:listingId/save",
  effectValidator("param", ExploreListingParamsSchema),
  effectValidator("json", ExploreSaveMutationRequestSchema, strictInput),
  (c) =>
    runExploreSaveEffect(
      c,
      unsaveExploreListing({ listingId: c.req.valid("param").listingId })
    )
);

/**
 * GET /api/explore/listings/:listingId/save (persisted save state).
 *
 * 현재 세션(alias 집합) 기준 실제 저장 여부를 반환한다. UI가 toggle 초기 상태·
 * 새로고침·다른 기기 상태를 실제 persisted state와 일치시키는 데 쓴다.
 */
exploreRoute.get(
  "/listings/:listingId/save",
  effectValidator("param", ExploreListingParamsSchema),
  (c) =>
    runExploreSaveEffect(
      c,
      getExploreSaveState({ listingId: c.req.valid("param").listingId })
    )
);

/**
 * GET /api/me/saved (paginated saved-list, RAON-254 DISC-6).
 *
 * 현재 세션(alias 집합)의 저장 목록을 `savedAt DESC`로 keyset paginate한다.
 * 현재 LISTED listing만 read-through join하므로 UNLISTED/deleted는 제외되고,
 * relist되면 다시 나타난다. 응답은 public envelope + immutable snapshot + savedAt만
 * 담으며 saver participant ID/source private reference를 노출하지 않는다.
 *
 * `limit`은 strict bounded 정수(범위 밖이면 400), `cursor`는 opaque token이라
 * handler에서 해독하고 해독 실패는 400(INVALID_REQUEST)으로 매핑한다(조용한 첫
 * 페이지 fallback 금지).
 */
const toSavedListingsResponse = (
  result: ListSavedListingsResult
): SavedListingsResponseEncoded => {
  const items = result.page.map((entry) => {
    if (entry.listing.status !== "LISTED") {
      throw new Error("Saved-list repository returned an unlisted item.");
    }
    return Schema.encodeSync(SavedListingItemSchema)({
      savedAt: entry.savedAt,
      listing: { ...entry.listing, status: "LISTED" as const },
    });
  });
  return result.nextCursor
    ? { items, nextCursor: encodeSavedCursor(result.nextCursor) }
    : { items };
};

export const meRoute = new Hono<AppEnv>();

meRoute.get(
  "/saved",
  effectValidator("query", SavedListingsQuerySchema, strictInput),
  (c) => {
    const requestId = c.var.requestId ?? crypto.randomUUID();
    const query = c.req.valid("query");

    let cursor: SavedListingCursor | undefined;
    if (query.cursor !== undefined) {
      try {
        cursor = decodeSavedCursor(query.cursor);
      } catch (error) {
        if (error instanceof InvalidSavedCursorError) {
          return Promise.resolve(
            c.json(
              formatApiError({
                code: "INVALID_REQUEST",
                message: "요청 형식이 올바르지 않습니다.",
                requestId,
              }),
              400
            )
          );
        }
        throw error;
      }
    }

    const limit = query.limit ?? SAVED_LISTINGS_DEFAULT_LIMIT;

    const db = c.var.database;
    if (!db) {
      return runEffect(
        c,
        Effect.fail(
          new RepositoryError({
            operation: "ExploreSaveRepositoryLive",
            message: "데이터베이스를 사용할 수 없습니다.",
          })
        )
      );
    }

    // saved-list는 ExploreSaveRepository만 필요하다(read-through join 포함).
    // TripRoomRepository를 제공하지 않아 private aggregate read-through를 차단한다.
    const services = ExploreSaveRepositoryLive.pipe(
      Layer.provide(Layer.succeed(Database, { db }))
    );

    return runEffect(
      c,
      listSavedExploreListings({ limit, cursor }).pipe(
        Effect.provide(services)
      ),
      {
        mapSuccess: (result, ctx) =>
          ctx.json(toSavedListingsResponse(result), 200),
      }
    );
  }
);
