import { Result, Schema } from "effect";
import {
  ExploreListingStatusSchema,
  ExplorePlanSnapshotSchema,
  ExploreTimestampSchema,
} from "../core/domain/explore-plan.ts";
import {
  ExploreListingIdSchema,
  PlanIdSchema,
  RevisionSchema,
  TripIdSchema,
} from "../core/domain/ids.ts";
import { TravelDateSchema } from "../core/domain/room.ts";

/**
 * Explore mutation HTTP contract (RAON-259 / Goal 14 DISC-3).
 *
 * ## Privacy boundary
 *
 * public response는 오직 공개 가능한 lifecycle envelope + immutable snapshot만
 * 담는다. server-only source reference(`sourceTripId` / `sourcePlanId` /
 * `sourceAuthorParticipantId`)는 **절대** response DTO에 포함하지 않는다.
 * snapshot(`ExplorePlanSnapshot`)도 source private ID를 노출하지 않는
 * allowlist projection이다.
 *
 * ## Server-owned fields
 *
 * actor identity(userId/role/authorId)와 snapshot은 서버가 세션·source
 * aggregate에서 결정한다. client는 mutation request로 이 값들을 보낼 수 없다.
 * - 최초 게시(create)는 body 없이 source (tripId, planId)만으로 게시하므로
 *   spoof 필드를 받지 않도록 **empty strict** request를 요구한다.
 * - unlist/relist는 optimistic concurrency용 `expectedRevision`만 받는다.
 */

const ExpectedRevisionSchema = RevisionSchema.check(
  Schema.isInt(),
  Schema.isGreaterThanOrEqualTo(1)
);

/**
 * 최초 게시 request. 서버가 소유하지 않는 어떤 필드도 받지 않는다.
 *
 * 빈 `Schema.Struct({})`는 field가 없으면 excess property 검사를 건너뛰므로
 * (Effect Schema 동작), spoof 필드를 확실히 거부하기 위해 "key가 하나도 없어야
 * 한다"는 filter를 명시적으로 건다. client가 authorId/snapshot 등을 보내면
 * decode가 실패해 400으로 매핑된다.
 */
export const ListPlanInExploreRequestSchema = Schema.Record(
  Schema.String,
  Schema.Unknown
).check(
  Schema.makeFilter(
    (value) => Object.keys(value).length === 0,
    { message: "게시 요청 본문에는 어떤 필드도 포함할 수 없습니다." }
  )
);
export type ListPlanInExploreRequest =
  typeof ListPlanInExploreRequestSchema.Type;

/** unlist request. listing optimistic concurrency revision만 받는다. */
export const UnlistPlanFromExploreRequestSchema = Schema.Struct({
  expectedRevision: ExpectedRevisionSchema,
});
export type UnlistPlanFromExploreRequest =
  typeof UnlistPlanFromExploreRequestSchema.Type;

/** relist request. listing optimistic concurrency revision만 받는다. */
export const RelistPlanInExploreRequestSchema = Schema.Struct({
  expectedRevision: ExpectedRevisionSchema,
});
export type RelistPlanInExploreRequest =
  typeof RelistPlanInExploreRequestSchema.Type;

/**
 * Explore import HTTP contract (RAON-261 / Goal 14 DISC-7).
 *
 * ## Request
 *
 * `POST /api/explore/listings/:listingId/import` body는 오직 `target`만 받는다.
 * listingId는 path param이다. actor/author/snapshot/status/revision/provenance
 * 같은 server-owned field는 body로 받지 않는다(strict decode + tagged union이
 * excess/unknown 필드를 거부한다).
 *
 * - NEW_TRIP: optional `title`만 허용한다. 빈 문자열 title은 use case가 거부한다.
 * - EXISTING_TRIP: 대상 `tripId`와 optimistic concurrency `expectedRevision`을 받는다.
 *
 * ## Response
 *
 * 성공 응답은 정확히 `{ tripId, planId }` allowlist만 담는다. imported plan의
 * 내부 내용/snapshot/provenance/source private reference는 노출하지 않는다.
 */
const ImportTargetNewTripSchema = Schema.Struct({
  type: Schema.Literal("NEW_TRIP"),
  title: Schema.optional(Schema.String),
});

const ImportTargetExistingTripSchema = Schema.Struct({
  type: Schema.Literal("EXISTING_TRIP"),
  tripId: TripIdSchema,
  expectedRevision: ExpectedRevisionSchema,
});

export const ImportExplorePlanRequestSchema = Schema.Struct({
  target: Schema.Union([
    ImportTargetNewTripSchema,
    ImportTargetExistingTripSchema,
  ]),
});
export type ImportExplorePlanRequest =
  typeof ImportExplorePlanRequestSchema.Type;

export const ImportExplorePlanResponseSchema = Schema.Struct({
  tripId: TripIdSchema,
  planId: PlanIdSchema,
});
export type ImportExplorePlanResponse =
  typeof ImportExplorePlanResponseSchema.Type;

/**
 * public listing response.
 *
 * `ExplorePlanListing` envelope와 동일한 공개 필드만 노출한다. source private
 * reference는 이 schema에 존재하지 않으므로 encode/decode 어느 방향으로도
 * 노출되지 않는다.
 */
const ExploreListingPublicFields = {
  listingId: ExploreListingIdSchema,
  status: ExploreListingStatusSchema,
  listingRevision: RevisionSchema,
  listedAt: ExploreTimestampSchema,
  updatedAt: ExploreTimestampSchema,
  unlistedAt: Schema.optional(ExploreTimestampSchema),
  snapshot: ExplorePlanSnapshotSchema,
};

export const ExploreListingResponseSchema = Schema.Struct(
  ExploreListingPublicFields
);
export type ExploreListingResponse = typeof ExploreListingResponseSchema.Type;

/**
 * Explore feed read contract (RAON-260 / Goal 14 DISC-4).
 *
 * ## Read query
 *
 * `GET /api/explore/listings`는 authenticated session만 요구하는 public feed다.
 * - `limit`: strict bounded 정수(1..MAX). client가 임의로 큰 page를 요구하지 못한다.
 * - `cursor`: 이전 페이지 마지막 항목을 가리키는 opaque token. 서버가 발급하고
 *   서버가 해독한다. client는 내부 구조(listedAt/listingId tuple)를 알 필요가 없고,
 *   해독 실패는 400(INVALID_REQUEST)으로 매핑된다.
 *
 * ## Feed item / response
 *
 * feed item은 mutation response와 동일한 public allowlist(공개 envelope +
 * immutable snapshot)만 노출한다. source private reference(tripId/planId/
 * authorParticipantId)는 어떤 schema에도 존재하지 않으므로 encode/decode 양방향
 * 어디서도 새어 나가지 않는다. `nextCursor`가 있으면 다음 페이지가 존재한다.
 */

/** feed page 한 요청의 최대 항목 수 상한. */
export const EXPLORE_LISTINGS_MAX_LIMIT = 50;
/** limit query가 없을 때 사용할 기본 page 크기. */
export const EXPLORE_LISTINGS_DEFAULT_LIMIT = 20;
/** 비정상적으로 큰 cursor decode 비용을 제한한다. filter identity를 포함해도 bounded다. */
export const EXPLORE_CURSOR_MAX_LENGTH = 4096;

const ExploreCursorTokenSchema = Schema.String.check(
  Schema.makeFilter(
    (value) =>
      value.length > 0 &&
      value.length <= EXPLORE_CURSOR_MAX_LENGTH &&
      /^[A-Za-z0-9_-]+$/.test(value),
    { message: "cursor는 URL-safe opaque token이어야 합니다." }
  )
);

/**
 * opaque cursor의 서버 내부 payload. public token으로 base64url encode된다.
 * feed order(`listedAt DESC, listingId DESC`)의 keyset tuple이다.
 */
export const ExploreListingCursorSchema = Schema.Struct({
  listedAt: ExploreTimestampSchema,
  listingId: ExploreListingIdSchema,
  /** cursor를 발급한 canonical filter set. 다른 filter와 재사용하면 400으로 거부한다. */
  filterKey: Schema.String.check(
    Schema.makeFilter((value) => value.length <= 1024, {
      message: "cursor filter identity가 너무 깁니다.",
    })
  ),
});
export type ExploreListingCursorPayload =
  typeof ExploreListingCursorSchema.Type;

const encodeCursorPayload = Schema.encodeSync(ExploreListingCursorSchema);
const decodeCursorPayload = Schema.decodeUnknownResult(ExploreListingCursorSchema);

const toBase64Url = (json: string): string => {
  // btoa expects latin1; encode UTF-8 bytes first so any snapshot ISO string is safe.
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const fromBase64Url = (token: string): string => {
  const padded = token
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(token.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
};

/** keyset tuple → opaque public cursor token. */
export const encodeExploreCursor = (
  payload: ExploreListingCursorPayload
): string => toBase64Url(JSON.stringify(encodeCursorPayload(payload)));

export class InvalidExploreCursorError extends Error {
  constructor(cause?: unknown) {
    super("Explore cursor를 해독할 수 없습니다.");
    this.name = "InvalidExploreCursorError";
    if (cause !== undefined) this.cause = cause;
  }
}

/**
 * opaque token → keyset tuple. malformed token은 {@link InvalidExploreCursorError}로
 * throw하며, 호출자(HTTP 경계)는 이를 400(INVALID_REQUEST)으로 매핑한다. fallback으로
 * 첫 페이지를 반환하지 않는다(오류를 숨기지 않는다).
 */
export const decodeExploreCursor = (
  token: string
): ExploreListingCursorPayload => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(fromBase64Url(token));
  } catch (cause) {
    throw new InvalidExploreCursorError(cause);
  }
  const result = decodeCursorPayload(parsed);
  if (Result.isFailure(result)) {
    throw new InvalidExploreCursorError(result.failure);
  }
  return result.success;
};

/** 검색/필터 문자열은 trim 후 1..100자만 허용한다. */
export const EXPLORE_FILTER_TEXT_MAX_LENGTH = 100;
const ExploreFilterTextSchema = Schema.String.check(
  Schema.makeFilter(
    (value) => {
      const length = value.trim().length;
      return length >= 1 && length <= EXPLORE_FILTER_TEXT_MAX_LENGTH;
    },
    { message: "검색/필터 값은 1~100자여야 합니다." }
  )
);

/**
 * feed query params.
 *
 * - `query`: title/destination/route city를 대상으로 하는 literal substring 검색.
 * - `destination` / `routeCity`: 공개 snapshot field의 literal substring 필터.
 * - `startDate` / `endDate`: 요청 기간과 공개 dateRange가 겹치는 listing 필터.
 * - `limit`은 optional bounded 정수, `cursor`는 optional opaque token.
 *
 * Hono가 query 값을 문자열로 넘기므로 numeric coercion 후 상한을 건다. 필터는
 * 이후 page에도 동일하게 전달되며 repository가 LISTED snapshot에만 적용한다.
 */
export const ExploreListingsQuerySchema = Schema.Struct({
  limit: Schema.optional(
    Schema.NumberFromString.check(
      Schema.isInt(),
      Schema.isGreaterThanOrEqualTo(1),
      Schema.isLessThanOrEqualTo(EXPLORE_LISTINGS_MAX_LIMIT)
    )
  ),
  cursor: Schema.optional(ExploreCursorTokenSchema),
  query: Schema.optional(ExploreFilterTextSchema),
  destination: Schema.optional(ExploreFilterTextSchema),
  routeCity: Schema.optional(ExploreFilterTextSchema),
  startDate: Schema.optional(TravelDateSchema),
  endDate: Schema.optional(TravelDateSchema),
}).check(
  Schema.makeFilter(
    (value) =>
      value.startDate === undefined ||
      value.endDate === undefined ||
      value.startDate <= value.endDate,
    { message: "시작일은 종료일보다 늦을 수 없습니다." }
  )
);
export type ExploreListingsQuery = typeof ExploreListingsQuerySchema.Type;
export type ExploreListingsFilters = Pick<
  ExploreListingsQuery,
  "query" | "destination" | "routeCity" | "startDate" | "endDate"
>;

const normalizedFilterText = (
  value: string | undefined
): string | undefined => {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
};

/** URL, cursor identity, query key, API 요청이 공유하는 canonical filter 표현. */
export const normalizeExploreListingsFilters = (
  filters: ExploreListingsFilters = {}
): ExploreListingsFilters => ({
  query: normalizedFilterText(filters.query),
  destination: normalizedFilterText(filters.destination),
  routeCity: normalizedFilterText(filters.routeCity),
  startDate: normalizedFilterText(filters.startDate),
  endDate: normalizedFilterText(filters.endDate),
});

/** cursor를 발급한 filter set을 충돌 없이 비교하기 위한 ordered identity. */
export const encodeExploreFiltersKey = (
  filters: ExploreListingsFilters = {}
): string => {
  const normalized = normalizeExploreListingsFilters(filters);
  return JSON.stringify([
    normalized.query ?? null,
    normalized.destination ?? null,
    normalized.routeCity ?? null,
    normalized.startDate ?? null,
    normalized.endDate ?? null,
  ]);
};

/** feed item은 lifecycle상 LISTED인 public allowlist만 허용한다. */
export const ExploreListingItemSchema = Schema.Struct({
  ...ExploreListingPublicFields,
  status: Schema.Literal("LISTED"),
});
export type ExploreListingItem = typeof ExploreListingItemSchema.Type;

/**
 * Explore listing detail read contract (RAON-263 / Goal 14 DISC-5).
 *
 * focused detail도 feed item과 동일한 public allowlist(공개 envelope + immutable
 * snapshot)만 노출한다. LISTED만 detail로 반환되므로 feed item schema를 그대로
 * 재사용한다. source private reference(tripId/planId/authorParticipantId)는 어떤
 * schema에도 없으므로 encode/decode 양방향 어디서도 새어 나가지 않는다.
 */
export const ExploreListingDetailResponseSchema = ExploreListingItemSchema;
export type ExploreListingDetailResponse =
  typeof ExploreListingDetailResponseSchema.Type;

/** feed page 응답. 다음 페이지가 있으면 `nextCursor`(opaque token)를 담는다. */
export const ExploreListingsResponseSchema = Schema.Struct({
  items: Schema.Array(ExploreListingItemSchema),
  nextCursor: Schema.optional(ExploreCursorTokenSchema),
});
export type ExploreListingsResponse =
  typeof ExploreListingsResponseSchema.Type;
export type ExploreListingsResponseEncoded =
  typeof ExploreListingsResponseSchema.Encoded;
