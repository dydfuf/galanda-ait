import { Result, Schema } from "effect";
import { ExploreListingItemSchema } from "./explore.ts";
import { ExploreTimestampSchema } from "../core/domain/explore-plan.ts";
import { ExploreListingIdSchema } from "../core/domain/ids.ts";

/**
 * Explore save HTTP contract (RAON-254 / Goal 14 DISC-6).
 *
 * ## Server-owned actor
 *
 * actor identity(participant/user ID)는 서버가 세션에서 결정한다. save/unsave
 * request는 어떤 actor 필드도 받지 않는다(client identity 불수용). 최초 save·
 * unsave 모두 body 없이 path listingId만으로 동작하므로, spoof 필드를 확실히
 * 거부하기 위해 "key가 하나도 없어야 한다"는 empty strict request를 요구한다.
 *
 * ## Privacy
 *
 * saved-list item은 feed item과 동일한 public allowlist(공개 envelope + immutable
 * snapshot) + save 시각(`savedAt`)만 노출한다. saver participant ID나 source
 * private reference는 어떤 schema에도 없으므로 encode/decode 양방향 어디서도
 * 새어 나가지 않는다. save count/trending signal은 응답에 포함하지 않는다.
 */

/** 최초 save/unsave request. 서버가 소유하지 않는 어떤 필드도 받지 않는다. */
export const ExploreSaveMutationRequestSchema = Schema.Record(
  Schema.String,
  Schema.Unknown
).check(
  Schema.makeFilter((value) => Object.keys(value).length === 0, {
    message: "저장 요청 본문에는 어떤 필드도 포함할 수 없습니다.",
  })
);
export type ExploreSaveMutationRequest =
  typeof ExploreSaveMutationRequestSchema.Type;

/** save/unsave/상태 조회 응답. 현재 persisted 저장 상태만 담는다. */
export const ExploreSaveStateResponseSchema = Schema.Struct({
  saved: Schema.Boolean,
});
export type ExploreSaveStateResponse =
  typeof ExploreSaveStateResponseSchema.Type;

// --- saved-list pagination --------------------------------------------------

/** saved-list page 한 요청의 최대 항목 수 상한. */
export const SAVED_LISTINGS_MAX_LIMIT = 50;
/** limit query가 없을 때 사용할 기본 page 크기. */
export const SAVED_LISTINGS_DEFAULT_LIMIT = 20;
/** 비정상적으로 큰 cursor decode 비용을 제한한다. */
export const SAVED_CURSOR_MAX_LENGTH = 512;

const SavedCursorTokenSchema = Schema.String.check(
  Schema.makeFilter(
    (value) =>
      value.length > 0 &&
      value.length <= SAVED_CURSOR_MAX_LENGTH &&
      /^[A-Za-z0-9_-]+$/.test(value),
    { message: "cursor는 URL-safe opaque token이어야 합니다." }
  )
);

/**
 * opaque cursor의 서버 내부 payload. public token으로 base64url encode된다.
 * saved-list order(`savedAt DESC, listingId DESC`)의 keyset tuple이다.
 */
export const SavedListingCursorSchema = Schema.Struct({
  savedAt: ExploreTimestampSchema,
  listingId: ExploreListingIdSchema,
});
export type SavedListingCursorPayload =
  typeof SavedListingCursorSchema.Type;

const encodeCursorPayload = Schema.encodeSync(SavedListingCursorSchema);
const decodeCursorPayload = Schema.decodeUnknownResult(SavedListingCursorSchema);

const toBase64Url = (json: string): string => {
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
export const encodeSavedCursor = (payload: SavedListingCursorPayload): string =>
  toBase64Url(JSON.stringify(encodeCursorPayload(payload)));

export class InvalidSavedCursorError extends Error {
  constructor(cause?: unknown) {
    super("저장 목록 cursor를 해독할 수 없습니다.");
    this.name = "InvalidSavedCursorError";
    if (cause !== undefined) this.cause = cause;
  }
}

/**
 * opaque token → keyset tuple. malformed token은 {@link InvalidSavedCursorError}로
 * throw하며, 호출자(HTTP 경계)는 이를 400(INVALID_REQUEST)으로 매핑한다. fallback으로
 * 첫 페이지를 반환하지 않는다.
 */
export const decodeSavedCursor = (
  token: string
): SavedListingCursorPayload => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(fromBase64Url(token));
  } catch (cause) {
    throw new InvalidSavedCursorError(cause);
  }
  const result = decodeCursorPayload(parsed);
  if (Result.isFailure(result)) {
    throw new InvalidSavedCursorError(result.failure);
  }
  return result.success;
};

/**
 * saved-list query params. `limit`은 optional bounded 정수, `cursor`는 optional
 * opaque token이다. Hono가 query 값을 문자열로 넘기므로 numeric coercion 후 상한을 건다.
 */
export const SavedListingsQuerySchema = Schema.Struct({
  limit: Schema.optional(
    Schema.NumberFromString.check(
      Schema.isInt(),
      Schema.isGreaterThanOrEqualTo(1),
      Schema.isLessThanOrEqualTo(SAVED_LISTINGS_MAX_LIMIT)
    )
  ),
  cursor: Schema.optional(SavedCursorTokenSchema),
});
export type SavedListingsQuery = typeof SavedListingsQuerySchema.Type;

/**
 * saved-list item. save 시각(`savedAt`) + 현재 LISTED public listing(read-through)만
 * 노출한다. UNLISTED/deleted는 서버가 join에서 제외하므로 여기 오지 않는다.
 */
export const SavedListingItemSchema = Schema.Struct({
  savedAt: ExploreTimestampSchema,
  listing: ExploreListingItemSchema,
});
export type SavedListingItem = typeof SavedListingItemSchema.Type;

/** saved-list page 응답. 다음 페이지가 있으면 `nextCursor`(opaque token)를 담는다. */
export const SavedListingsResponseSchema = Schema.Struct({
  items: Schema.Array(SavedListingItemSchema),
  nextCursor: Schema.optional(SavedCursorTokenSchema),
});
export type SavedListingsResponse = typeof SavedListingsResponseSchema.Type;
export type SavedListingsResponseEncoded =
  typeof SavedListingsResponseSchema.Encoded;
