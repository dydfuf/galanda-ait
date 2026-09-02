import { Schema } from "effect";
import type {
  ExploreListingId,
  InviteToken,
  PlanId,
  Revision,
  TripId,
} from "../core/domain/ids.ts";
import {
  IssuedInviteSchema,
  PublicInviteSummarySchema,
} from "../core/domain/invite.ts";
import {
  TripRoomSchema,
  UserSessionSchema,
  type TripPlan,
  type UserSession,
} from "../core/domain/room.ts";
import type { UpdateRoomParams } from "../core/ports/trip-room-repository.ts";
import type { CreateRoomInput } from "../core/usecases/create-room.ts";
import type { CreatePlanCommand } from "../core/usecases/save-plan.ts";
import type { SubmitPlanOpinionInput } from "../core/usecases/submit-opinion.ts";
import {
  ConfirmItineraryResultSchema,
  ItineraryAcknowledgementResponseSchema,
  ItineraryStateResponseSchema,
  ConfirmedItineraryResponseSchema,
} from "../contracts/itinerary.ts";
import type { ItineraryItemPatch } from "../core/domain/confirmed-itinerary.ts";
import {
  RecommendNextActionResponseSchema,
  type RecommendNextActionRequest,
  type RecordRecommendationLifecycleEventRequest,
} from "../contracts/recommendation.ts";
import {
  ExploreListingDetailResponseSchema,
  ExploreListingResponseSchema,
  ExploreListingsResponseSchema,
  ExplorePopularCitiesResponseSchema,
  ImportExplorePlanResponseSchema,
  type ClassifyExploreListingRequest,
  type ExploreListingDetailResponse,
  type ExploreListingResponse,
  type ExploreListingsFilters,
  type ExploreListingsResponse,
  type ExplorePopularCitiesResponse,
  type ImportExplorePlanRequest,
  type ImportExplorePlanResponse,
} from "../contracts/explore.ts";
import {
  ExploreSaveStateResponseSchema,
  SavedListingsResponseSchema,
  type ExploreSaveStateResponse,
  type SavedListingsResponse,
} from "../contracts/explore-save.ts";
import {
  TripOverviewListResponseSchema,
  type TripOverviewListResponse,
} from "../contracts/trip-overview.ts";
import {
  TripActivityPageResponseSchema,
  TripActivitySummaryDtoSchema,
  type ActivitySequence,
  type TripActivityPageResponse,
  type TripActivitySummaryDto,
} from "../contracts/trip-activity.ts";

export class ApiClientError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly requestId?: string;
  readonly details?: unknown;

  constructor(options: {
    readonly status: number;
    readonly message: string;
    readonly code?: string;
    readonly requestId?: string;
    readonly details?: unknown;
  }) {
    super(options.message);
    this.name = "ApiClientError";
    this.status = options.status;
    this.code = options.code;
    this.requestId = options.requestId;
    this.details = options.details;
  }
}

const requestJson = async <S extends Schema.Decoder<any, never>>(
  path: string,
  schema: S,
  init: RequestInit = {}
): Promise<S["Type"]> => {
  const response = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers: init.body ? { "content-type": "application/json" } : init.headers,
  });
  const payload: unknown = await response.json().catch(() => undefined);

  if (!response.ok) {
    const detail =
      payload && typeof payload === "object" && "error" in payload
        ? (payload.error as Record<string, unknown>)
        : undefined;
    throw new ApiClientError({
      status: response.status,
      message:
        typeof detail?.message === "string"
          ? detail.message
          : "요청을 처리하지 못했습니다.",
      code: typeof detail?.code === "string" ? detail.code : undefined,
      requestId:
        typeof detail?.requestId === "string" ? detail.requestId : undefined,
      details: detail?.details,
    });
  }

  try {
    return await Schema.decodeUnknownPromise(schema)(payload);
  } catch (cause) {
    throw new Error("서버 응답 형식이 올바르지 않습니다.", { cause });
  }
};

const tripPath = (tripId: TripId): string =>
  `/api/trips/${encodeURIComponent(tripId)}`;

const planPath = (tripId: TripId, planId: PlanId): string =>
  `${tripPath(tripId)}/plans/${encodeURIComponent(planId)}`;

export const getCurrentSession = async (
  signal?: AbortSignal
): Promise<UserSession | null> => {
  return requestJson("/api/session", Schema.NullOr(UserSessionSchema), {
    signal,
  });
};

export const signInAnonymously = () =>
  requestJson(
    "/api/auth/sign-in/anonymous",
    Schema.Struct({
      token: Schema.String,
      user: Schema.Struct({ id: Schema.String }),
    }),
    { method: "POST", body: "{}" }
  );

export const getTrips = (signal?: AbortSignal): Promise<TripOverviewListResponse> =>
  requestJson("/api/trips", TripOverviewListResponseSchema, { signal });

export const getTrip = (tripId: TripId, signal?: AbortSignal) =>
  requestJson(tripPath(tripId), TripRoomSchema, {
    signal,
  });

export const recommendNextTripAction = (
  tripId: TripId,
  input: RecommendNextActionRequest,
  signal?: AbortSignal,
) =>
  requestJson(
    `${tripPath(tripId)}/recommendations/next`,
    RecommendNextActionResponseSchema,
    { method: "POST", body: JSON.stringify(input), signal },
  );

export const recordRecommendationLifecycleEvent = (
  tripId: TripId,
  input: RecordRecommendationLifecycleEventRequest,
) =>
  requestJson(
    `${tripPath(tripId)}/recommendations/events`,
    Schema.Struct({ accepted: Schema.Literal(true) }),
    { method: "POST", body: JSON.stringify(input), keepalive: true },
  );

export const getTripItinerary = (tripId: TripId, signal?: AbortSignal) =>
  requestJson(`${tripPath(tripId)}/itinerary`, ItineraryStateResponseSchema, {
    signal,
  });

export const getInviteSummary = (
  inviteToken: InviteToken,
  signal?: AbortSignal
) =>
  requestJson(
    `/api/invites/${encodeURIComponent(inviteToken)}`,
    PublicInviteSummarySchema,
    { signal }
  );

export const issueTripInvite = (tripId: TripId) =>
  requestJson(`${tripPath(tripId)}/invites`, IssuedInviteSchema, {
    method: "POST",
  });

export const joinInvite = (inviteToken: InviteToken, nickname: string) =>
  requestJson(
    `/api/invites/${encodeURIComponent(inviteToken)}/join`,
    TripRoomSchema,
    { method: "POST", body: JSON.stringify({ nickname }) }
  );

export const createTrip = (input: CreateRoomInput) =>
  requestJson("/api/trips", TripRoomSchema, {
    method: "POST",
    body: JSON.stringify(input),
  });

export const updateTrip = (
  tripId: TripId,
  input: UpdateRoomParams & { readonly expectedRevision: Revision }
) =>
  requestJson(tripPath(tripId), TripRoomSchema, {
    method: "PATCH",
    body: JSON.stringify(input),
  });

export const createTripPlan = (
  tripId: TripId,
  input: Omit<CreatePlanCommand, "roomId">
) =>
  requestJson(`${tripPath(tripId)}/plans`, TripRoomSchema, {
    method: "POST",
    body: JSON.stringify(input),
  });

export const updateTripPlan = (
  tripId: TripId,
  plan: TripPlan,
  expectedRevision: Revision
) =>
  requestJson(planPath(tripId, plan.id), TripRoomSchema, {
    method: "PATCH",
    body: JSON.stringify({
      title: plan.title,
      proposalReason: plan.proposalReason,
      baseHeadcount: plan.baseHeadcount,
      routes: plan.routes,
      accommodations: plan.accommodations,
      transports: plan.transports,
      places: plan.places,
      expectedRevision,
    }),
  });

export const deleteTripPlan = (
  tripId: TripId,
  planId: PlanId,
  expectedRevision: Revision
) =>
  requestJson(planPath(tripId, planId), TripRoomSchema, {
    method: "DELETE",
    body: JSON.stringify({ expectedRevision }),
  });

export const submitTripPlanOpinion = (
  tripId: TripId,
  planId: PlanId,
  opinion: SubmitPlanOpinionInput["opinion"],
  expectedRevision: Revision
) =>
  requestJson(`${planPath(tripId, planId)}/opinion`, TripRoomSchema, {
    method: "PUT",
    body: JSON.stringify({ ...opinion, expectedRevision }),
  });

export const confirmTripPlan = (
  tripId: TripId,
  planId: PlanId,
  expectedRevision: Revision
) =>
  requestJson(`${planPath(tripId, planId)}/confirm`, ConfirmItineraryResultSchema, {
    method: "POST",
    body: JSON.stringify({ expectedRevision }),
  });

export const reviseTripItinerary = (
  tripId: TripId,
  patches: ReadonlyArray<ItineraryItemPatch>,
  expectedRevision: Revision
) =>
  requestJson(`${tripPath(tripId)}/itinerary`, ConfirmedItineraryResponseSchema, {
    method: "PATCH",
    body: JSON.stringify({ patches, expectedRevision }),
  });

export const acknowledgeTripItinerary = (
  tripId: TripId,
  expectedRevision: Revision
) =>
  requestJson(
    `${tripPath(tripId)}/itinerary/acknowledgements`,
    ItineraryAcknowledgementResponseSchema,
    { method: "POST", body: JSON.stringify({ expectedRevision }) }
  );

/**
 * Explore 공개 feed 조회 (RAON-260 DISC-4).
 *
 * authenticated session만 요구하는 public feed다. 응답은 schema로 decode해
 * 서버가 약속한 public shape만 통과시킨다. cursor는 서버가 발급한 opaque token을
 * 그대로 다시 전달한다.
 */
export const getExploreListings = (
  params: ExploreListingsFilters & {
    readonly limit?: number;
    readonly cursor?: string;
  } = {},
  signal?: AbortSignal
): Promise<ExploreListingsResponse> => {
  const search = new URLSearchParams();
  if (params.limit !== undefined) search.set("limit", String(params.limit));
  if (params.cursor !== undefined) search.set("cursor", params.cursor);
  if (params.query !== undefined) search.set("query", params.query);
  if (params.destination !== undefined)
    search.set("destination", params.destination);
  if (params.routeCity !== undefined) search.set("routeCity", params.routeCity);
  if (params.cityId !== undefined) search.set("cityId", params.cityId);
  if (params.themeId !== undefined) search.set("themeId", params.themeId);
  if (params.startDate !== undefined) search.set("startDate", params.startDate);
  if (params.endDate !== undefined) search.set("endDate", params.endDate);
  const queryString = search.toString();
  const path = queryString
    ? `/api/explore/listings?${queryString}`
    : "/api/explore/listings";
  return requestJson(path, ExploreListingsResponseSchema, { signal });
};

/** 전체 현재 LISTED set의 canonical route city aggregate를 조회한다. */
export const getExplorePopularCities = (
  signal?: AbortSignal
): Promise<ExplorePopularCitiesResponse> =>
  requestJson(
    "/api/explore/popular-cities",
    ExplorePopularCitiesResponseSchema,
    { signal }
  );

/**
 * Explore 공개 listing 단건 detail 조회 (RAON-263 DISC-5).
 *
 * feed와 동일하게 authenticated session만 요구하는 public read다. detail
 * endpoint(`/api/explore/listings/:listingId`)만 호출하고, source private
 * Trip/Plan route나 private endpoint는 절대 호출하지 않는다. 응답은 schema로
 * decode해 서버가 약속한 LISTED public shape만 통과시킨다. unlisted/deleted/
 * invalid는 서버가 410/404로 응답하며, api-client는 이를 `ApiClientError`로
 * 던지므로 UI가 unavailable/not-found를 구분할 수 있다.
 */
export const getExploreListingDetail = (
  listingId: ExploreListingId,
  signal?: AbortSignal
): Promise<ExploreListingDetailResponse> =>
  requestJson(
    `/api/explore/listings/${encodeURIComponent(listingId)}`,
    ExploreListingDetailResponseSchema,
    { signal }
  );

export const classifyExploreListing = (
  listingId: ExploreListingId,
  request: ClassifyExploreListingRequest
): Promise<ExploreListingResponse> =>
  requestJson(
    `/api/explore/listings/${encodeURIComponent(listingId)}/themes`,
    ExploreListingResponseSchema,
    { method: "PUT", body: JSON.stringify(request) }
  );

/**
 * Explore 공개 snapshot을 내 여행으로 가져오기(import) (RAON-261/262 DISC-7/8).
 *
 * `POST /api/explore/listings/:listingId/import`만 호출한다. body는 tagged
 * `target`(NEW_TRIP | EXISTING_TRIP)만 담으며, actor/author/snapshot/status/
 * revision/provenance 같은 server-owned field는 절대 보내지 않는다(서버가 세션과
 * source listing snapshot에서 결정한다). 성공 응답은 정확히 `{ tripId, planId }`
 * allowlist만 담고 schema로 decode해 그 shape만 통과시킨다.
 *
 * 상태 구분은 서버가 status code로 내려주고 api-client가 `ApiClientError`로 던진다:
 * - 201 → `{ tripId, planId }`(성공, atomic).
 * - 403 FORBIDDEN/ACCOUNT_UPGRADE_REQUIRED → 권한/계정 연결 필요.
 * - 404 NOT_FOUND(`details.entity` = TripRoom | ExplorePlanListing) → 대상 없음.
 * - 409 REVISION_CONFLICT/STATE_CONFLICT → 대상 방이 먼저 변경/확정됨.
 * - 410 LISTING_UNAVAILABLE → listing 게시 중단.
 * - 422 VALIDATION_FAILED → snapshot이 불완전해 가져올 수 없음.
 * - 5xx → 일시 장애(재시도).
 */
export const importExplorePlan = (
  listingId: ExploreListingId,
  target: ImportExplorePlanRequest["target"]
): Promise<ImportExplorePlanResponse> =>
  requestJson(
    `/api/explore/listings/${encodeURIComponent(listingId)}/import`,
    ImportExplorePlanResponseSchema,
    { method: "POST", body: JSON.stringify({ target }) }
  );

/**
 * Explore listing 저장/해제/상태 (RAON-254 DISC-6).
 *
 * actor identity는 서버가 세션에서 결정하므로 어떤 participant/user ID도 보내지
 * 않는다(빈 body). 응답은 실제 persisted 저장 상태(`{ saved }`)만 담는다. save는
 * idempotent(200), unsave는 반복 안전(200)하다. 없음/UNLISTED는 서버가 404/410으로
 * 응답하며 api-client가 `ApiClientError`로 던진다.
 */
const exploreSavePath = (listingId: ExploreListingId): string =>
  `/api/explore/listings/${encodeURIComponent(listingId)}/save`;

export const saveExploreListing = (
  listingId: ExploreListingId
): Promise<ExploreSaveStateResponse> =>
  requestJson(exploreSavePath(listingId), ExploreSaveStateResponseSchema, {
    method: "POST",
    body: "{}",
  });

export const unsaveExploreListing = (
  listingId: ExploreListingId
): Promise<ExploreSaveStateResponse> =>
  requestJson(exploreSavePath(listingId), ExploreSaveStateResponseSchema, {
    method: "DELETE",
    body: "{}",
  });

export const getExploreSaveState = (
  listingId: ExploreListingId,
  signal?: AbortSignal
): Promise<ExploreSaveStateResponse> =>
  requestJson(exploreSavePath(listingId), ExploreSaveStateResponseSchema, {
    signal,
  });

/**
 * 내 저장 목록(`/api/me/saved`) 조회 (RAON-254 DISC-6).
 *
 * 현재 세션 기준 저장 목록을 keyset paginate한다. 응답은 schema로 decode해 서버가
 * 약속한 public shape(savedAt + LISTED listing)만 통과시킨다. cursor는 서버가 발급한
 * opaque token을 그대로 다시 전달한다.
 */
export const getSavedListings = (
  params: { readonly limit?: number; readonly cursor?: string } = {},
  signal?: AbortSignal
): Promise<SavedListingsResponse> => {
  const search = new URLSearchParams();
  if (params.limit !== undefined) search.set("limit", String(params.limit));
  if (params.cursor !== undefined) search.set("cursor", params.cursor);
  const queryString = search.toString();
  const path = queryString ? `/api/me/saved?${queryString}` : "/api/me/saved";
  return requestJson(path, SavedListingsResponseSchema, { signal });
};

/**
 * 여행방 협업 활동 이력 조회 (`/api/trips/:tripId/activity`)
 */
export const getTripActivities = (
  tripId: TripId | string,
  params: { readonly beforeSequence?: ActivitySequence; readonly limit?: number } = {},
  signal?: AbortSignal
): Promise<TripActivityPageResponse> => {
  const search = new URLSearchParams();
  if (params.beforeSequence !== undefined) {
    search.set("beforeSequence", params.beforeSequence);
  }
  if (params.limit !== undefined) {
    search.set("limit", String(params.limit));
  }
  const queryString = search.toString();
  const path = queryString
    ? `/api/trips/${encodeURIComponent(tripId)}/activity?${queryString}`
    : `/api/trips/${encodeURIComponent(tripId)}/activity`;
  return requestJson(path, TripActivityPageResponseSchema, { signal });
};

/**
 * 여행방 활동 읽음 처리 (`/api/trips/:tripId/activity/read`)
 */
export const markTripActivityRead = (
  tripId: TripId | string,
  throughSequence: ActivitySequence
): Promise<TripActivitySummaryDto> =>
  requestJson(
    `/api/trips/${encodeURIComponent(tripId)}/activity/read`,
    TripActivitySummaryDtoSchema,
    {
      method: "PUT",
      body: JSON.stringify({ throughSequence }),
    }
  );
