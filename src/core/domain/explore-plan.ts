import { Schema } from "effect";
import {
  ExploreListingIdSchema,
  RevisionSchema,
  type ExploreListingId,
  type ParticipantId,
  type PlanId,
} from "./ids.ts";
import {
  getPlanNightCount,
  getPlanPublishValidationErrors,
  getRouteValidationError,
  getStayNightCount,
  TravelDateSchema,
  TripPlanSchema,
  type AccommodationSnapshot,
  type TransportSnapshot,
  type TripPlan,
  type TripRoom,
} from "./room.ts";

/**
 * Explore 공개 projection contract (RAON-255 / Goal 14 DISC-1).
 *
 * private `TripPlan` aggregate를 extend/spread하지 않고, 공개해도 되는 field만
 * 명시적으로 재선언한 allowlist schema다. snapshot은 source revision을 복제한
 * immutable value이며 source aggregate read-through를 하지 않는다.
 *
 * 기본 제외(schema/test로 고정):
 * - room/member identity, member opinions, HARD reason
 * - proposal/private note/draft, differenceSummary
 * - bookingUrl, priceRange, confirmedBy/At, bookingStatus, invite token
 * - private trip/plan/place/clone ID 등 source aggregate 역탐색 field
 */

/** UTC ISO 날짜-시간. lifecycle 타임스탬프에 사용한다. */
export const ExploreTimestampSchema = Schema.String.check(
  Schema.makeFilter((value) => {
    const millis = Date.parse(value);
    return Number.isFinite(millis) && new Date(millis).toISOString() === value;
  }, { message: "UTC ISO 날짜-시간이어야 합니다." })
);
export type ExploreTimestamp = typeof ExploreTimestampSchema.Type;

/** 도착/출발 도시 이름과 날짜만 노출하는 공개 route stop. */
export const ExploreRouteStopSchema = Schema.Struct({
  city: Schema.String,
  arrivalDate: TravelDateSchema,
  departureDate: TravelDateSchema,
});
export type ExploreRouteStop = typeof ExploreRouteStopSchema.Type;

/**
 * sanitized 숙소 요약. 내부 ID/예약 URL/가격/예약 상태/확정자 없이
 * 도시·숙소 표시명·박수만 공개한다.
 */
export const ExploreStaySummarySchema = Schema.Struct({
  city: Schema.String,
  /** 사용자가 아직 숙소를 찾는 중이면 이름 대신 상태만 노출한다. */
  hotelName: Schema.optional(Schema.String),
  isSearching: Schema.Boolean,
  nights: Schema.Number,
});
export type ExploreStaySummary = typeof ExploreStaySummarySchema.Type;

/**
 * sanitized 교통 요약. 내부 ID/예약 URL/가격/예약 상태/확정자 없이
 * 구간·수단·소요시간·환승 여부만 공개한다.
 */
export const ExploreTransportSummarySchema = Schema.Struct({
  fromCity: Schema.String,
  toCity: Schema.String,
  mode: Schema.String,
  hasTransfer: Schema.Boolean,
  durationText: Schema.String,
});
export type ExploreTransportSummary = typeof ExploreTransportSummarySchema.Type;

/** 공개 가능한 작성자 표시명만 담는 attribution. participant ID를 노출하지 않는다. */
export const ExploreAuthorAttributionSchema = Schema.Struct({
  displayName: Schema.String,
});
export type ExploreAuthorAttribution =
  typeof ExploreAuthorAttributionSchema.Type;

/** date/duration 범위. route에서 파생한 공개 값이다. */
export const ExploreDateRangeSchema = Schema.Struct({
  startDate: TravelDateSchema,
  endDate: TravelDateSchema,
  nightCount: Schema.Number,
});
export type ExploreDateRange = typeof ExploreDateRangeSchema.Type;

/**
 * private plan과 구조가 분리된 immutable 공개 snapshot.
 * source `plan.revision`을 `sourcePlanRevision`으로 고정한다.
 */
const PositiveRevisionSchema = RevisionSchema.check(
  Schema.isInt(),
  Schema.isGreaterThanOrEqualTo(1)
);

export const ExplorePlanSnapshotSchema = Schema.Struct({
  title: Schema.String,
  destination: Schema.String,
  routes: Schema.Array(ExploreRouteStopSchema).check(Schema.isNonEmpty()),
  dateRange: ExploreDateRangeSchema,
  stays: Schema.Array(ExploreStaySummarySchema),
  transports: Schema.Array(ExploreTransportSummarySchema),
  author: ExploreAuthorAttributionSchema,
  sourcePlanRevision: PositiveRevisionSchema,
});
export type ExplorePlanSnapshot = typeof ExplorePlanSnapshotSchema.Type;

export const ExploreListingStatusSchema = Schema.Literals(["LISTED", "UNLISTED"]);
export type ExploreListingStatus = typeof ExploreListingStatusSchema.Type;

/**
 * lifecycle envelope. listing 식별자·상태·revision·타임스탬프와
 * immutable snapshot을 함께 보관한다.
 *
 * ## Lifecycle 정책 (RAON-255 DISC-1 계약)
 *
 * 이 domain layer는 envelope의 shape와 각 전이가 만족해야 하는 값 규칙을
 * source of truth로 고정한다. 실제 전이 실행(persistence/use case)은
 * 이후 child에서 이 규칙을 그대로 구현한다.
 *
 * 상태 기계는 두 상태만 갖는다: `LISTED` ⇄ `UNLISTED`.
 * `listingRevision`은 optimistic concurrency용 monotonic revision이며,
 * 상태를 바꾸는 모든 전이에서 반드시 증가한다(read-modify-write 우회 금지).
 * `snapshot`은 최초 project 시점의 immutable value이므로, 아래 어떤 전이도
 * 이미 저장된 snapshot의 내용을 바꾸지 않는다(relist 재사영 시에만 교체).
 *
 * - list (최초 게시): status=`LISTED`, `listingRevision`=최초값,
 *   `listedAt`=`updatedAt`=게시 시각, `unlistedAt` 없음.
 *   snapshot은 `projectExplorePlanSnapshot`으로 사영한 값을 그대로 고정한다.
 *
 * - unlist (`LISTED`→`UNLISTED`): `listingRevision` 증가,
 *   `updatedAt`=`unlistedAt`=중단 시각으로 갱신, `listedAt`은 최초 게시 시각을
 *   유지한다. snapshot은 immutable하게 그대로 둔다(공개는 중단하되 박제 내용은 보존).
 *
 * - relist (`UNLISTED`→`LISTED`, 허용됨): `listingRevision` 증가,
 *   `listedAt`=`updatedAt`=재게시 시각으로 함께 갱신하고, `unlistedAt`은 제거한다
 *   (다시 노출 중이므로 undefined). 재게시는 최신 source plan 상태를 다시
 *   project한 **새 snapshot으로 교체**한다. 즉 relist는 stale snapshot을 그대로
 *   되살리지 않고, 다시 사영에 성공한 경우에만 노출한다(project 실패 시 relist
 *   불가, fail-closed). `listedAt`을 재게시 시각으로 올리는 이유는 LISTED feed가
 *   `listedAt DESC`로 정렬되므로, 재게시된 plan이 원래 위치에 묻히지 않고 최신
 *   listing으로 다시 노출되어야 하기 때문이다.
 *
 * - source deletion policy (source plan 또는 room 삭제 시):
 *   snapshot은 source aggregate를 read-through하지 않는 immutable value이므로
 *   source 삭제가 이미 저장된 snapshot 내용을 바꾸지 않는다. 다만 source가
 *   사라지면 노출을 유지할 근거(권한·최신성·재사영 가능성)가 사라지므로,
 *   기존 `LISTED` listing은 **auto-unlist** 처리한다(unlist 전이와 동일하게
 *   `listingRevision` 증가·`unlistedAt` 설정). auto-unlist된 listing은 source가
 *   없으므로 relist가 불가능하다(재사영 대상이 없어 fail-closed).
 */
export const ExplorePlanListingSchema = Schema.Struct({
  listingId: ExploreListingIdSchema,
  status: ExploreListingStatusSchema,
  listingRevision: PositiveRevisionSchema,
  listedAt: ExploreTimestampSchema,
  updatedAt: ExploreTimestampSchema,
  unlistedAt: Schema.optional(ExploreTimestampSchema),
  snapshot: ExplorePlanSnapshotSchema,
});
export type ExplorePlanListing = typeof ExplorePlanListingSchema.Type;

/**
 * projection failure 이유. 각 실패는 서로 다른 정책을 의미하므로 합치지 않는다.
 * - MISSING_REVISION: source plan이 private-room 공개본(revision set)이 아니다.
 * - UNRESOLVED_AUTHOR: room+plan으로 공개 가능한 작성자 표시명을 찾을 수 없다.
 * - INVALID_ROUTE: route가 비었거나, 도시/날짜가 비었거나, 겹침/역순 등
 *   publish validation을 통과하지 못한다. date range는 검증된 route의
 *   arrival/departure에서 파생되므로 route가 유효하면 date range도 유효하다
 *   (별도 date 실패 kind를 두지 않는다).
 */
export type ExploreProjectionFailure =
  | { readonly kind: "MISSING_REVISION" }
  | { readonly kind: "UNRESOLVED_AUTHOR" }
  | { readonly kind: "INVALID_ROUTE"; readonly message: string };

export type ExploreProjectionResult =
  | { readonly ok: true; readonly snapshot: ExplorePlanSnapshot }
  | { readonly ok: false; readonly failure: ExploreProjectionFailure };

/**
 * room member(작성자 ID) 또는 plan에 박제된 authorName으로 공개 표시명을 resolve한다.
 * participant ID는 공개 결과에 노출하지 않는다.
 */
const resolveAuthorDisplayName = (
  room: TripRoom,
  plan: TripPlan
): string | undefined => {
  if (plan.authorId) {
    const member = room.members.find(({ id }) => id === plan.authorId);
    const name = member?.name.trim();
    return name || undefined;
  }

  const authorName = plan.authorName?.trim();
  if (!authorName) return undefined;
  const matchingMembers = room.members.filter(
    ({ name }) => name.trim() === authorName
  );
  return matchingMembers.length === 1
    ? matchingMembers[0]?.name.trim() || undefined
    : undefined;
};

const sanitizeStay = (
  stay: NonNullable<TripPlan["accommodations"]>[number]
): ExploreStaySummary => {
  const isSearching = Boolean(stay.isSearching);
  const hotelName = stay.hotelName.trim();
  return {
    city: stay.city,
    hotelName: isSearching || !hotelName ? undefined : hotelName,
    isSearching,
    nights: stay.nights,
  };
};

const sanitizeTransport = (
  transport: NonNullable<TripPlan["transports"]>[number]
): ExploreTransportSummary => ({
  fromCity: transport.fromCity,
  toCity: transport.toCity,
  mode: transport.mode,
  hasTransfer: transport.hasTransfer,
  durationText: transport.durationText,
});

/**
 * private room+plan을 sanitized immutable `ExplorePlanSnapshot`으로 사영한다.
 *
 * - source object를 참조로 재사용하지 않고 새 value를 만든다. 이후 source가
 *   mutate되어도 결과 snapshot은 바뀌지 않는다.
 * - revision 없음/unresolved author/invalid-or-incomplete route/date는 명시적
 *   failure로 반환하며, 기존 publish validation/date helper를 재사용한다.
 */
export const projectExplorePlanSnapshot = (
  room: TripRoom,
  plan: TripPlan
): ExploreProjectionResult => {
  if (plan.revision === undefined) {
    return { ok: false, failure: { kind: "MISSING_REVISION" } };
  }

  const displayName = resolveAuthorDisplayName(room, plan);
  if (!displayName) {
    return { ok: false, failure: { kind: "UNRESOLVED_AUTHOR" } };
  }

  const routes = plan.routes ?? [];
  if (routes.length === 0) {
    return {
      ok: false,
      failure: { kind: "INVALID_ROUTE", message: "최소 1개 이상의 방문 도시가 필요합니다." },
    };
  }
  const incompleteRoute = routes.find(
    ({ city, arrivalDate, departureDate }) =>
      !city.trim() || !arrivalDate || !departureDate
  );
  if (incompleteRoute) {
    return {
      ok: false,
      failure: {
        kind: "INVALID_ROUTE",
        message: `${incompleteRoute.city || "도시"}의 도착일과 출발일을 입력해주세요.`,
      },
    };
  }
  const routeError = getRouteValidationError(routes);
  if (routeError) {
    return { ok: false, failure: { kind: "INVALID_ROUTE", message: routeError } };
  }

  // route가 non-empty이고 각 stop의 날짜가 채워졌음을 위에서 보장했으므로,
  // date range는 검증된 첫/마지막 stop에서 결정적으로 파생된다.
  const firstStop = routes[0]!;
  const lastStop = routes[routes.length - 1]!;

  const snapshot: ExplorePlanSnapshot = {
    title: plan.title,
    destination: room.destination,
    routes: routes.map((route) => ({
      city: route.city,
      arrivalDate: route.arrivalDate,
      departureDate: route.departureDate,
    })),
    dateRange: {
      startDate: firstStop.arrivalDate,
      endDate: lastStop.departureDate,
      nightCount: getPlanNightCount(plan),
    },
    stays: (plan.accommodations ?? []).map(sanitizeStay),
    transports: (plan.transports ?? []).map(sanitizeTransport),
    author: { displayName },
    sourcePlanRevision: plan.revision,
  };

  return { ok: true, snapshot };
};

/**
 * Explore public snapshot → private `TripPlan` copier (RAON-261 / Goal 14 DISC-7).
 *
 * LISTED immutable snapshot을 사용자의 private VOTING plan으로 복사한다. source
 * private Trip/Plan aggregate를 다시 읽지 않고 오직 공개 snapshot만 입력으로 쓴다.
 *
 * ## Independence
 * - 모든 array/object를 새로 만든다. source object를 참조로 재사용하지 않으므로
 *   이후 어느 쪽을 편집해도 서로 영향을 주지 않는다.
 * - stay/transport의 내부 ID는 새로 발급한 `planId` + kind + stable index로
 *   결정적으로 파생한다(`${planId}-stay-1`, `${planId}-transport-1`). source
 *   private plan의 원본 ID를 복사하지 않고, `crypto`/random 등 provider-neutral
 *   core 밖의 비결정 소스도 쓰지 않는다. 새 planId가 독립성/유일성을 보장한다.
 *
 * ## Server-owned fields
 * - `id`/`authorId`/`authorName`/`revision`/`status`/`publishedAt`은 caller(use
 *   case)가 세션·IdGenerator·Clock에서 결정한 값으로 채운다.
 * - `importedFromExploreListingId`는 공개 listing ID provenance다(source private
 *   ID 아님).
 *
 * ## Sanitized-away fields (fake 복원 금지)
 * - proposalReason 없음, places=[], memberOpinions=[], voteCount=0.
 * - bookingUrl/priceRange/confirmedBy/confirmedAt 없음.
 * - bookingStatus는 명시적 unknown인 `NOT_CHECKED`만 사용한다(원본 상태를 추정하지 않는다).
 *
 * ## Accommodation period
 * - 각 public stay를 아직 쓰지 않은 route 하나에 city + nights로 결정적으로
 *   매칭하고(occurrence-aware), period는 그 정확히 매칭된 route의
 *   arrival~departure에서만 파생한다. 같은 도시를 여러 번 방문하는 경우에도 각
 *   stay가 서로 다른 route occurrence에 대응한다. 매칭되는 route가 없으면
 *   period를 지어내지 않고 validation 실패로 이어진다.
 *
 * ## Validation
 * - 최종 plan을 기존 `getPlanPublishValidationErrors` + `TripPlanSchema`로 검증한다.
 *   legacy/incomplete snapshot이 이를 만족하지 못하면 hotel/stay/transport 값을
 *   지어내지 않고 실패(`{ ok: false }`)로 반환한다.
 */
export interface CopyExploreSnapshotParams {
  readonly snapshot: ExplorePlanSnapshot;
  readonly planId: PlanId;
  readonly authorId: ParticipantId;
  readonly authorName: string;
  readonly baseHeadcount: number;
  readonly publishedAt: string;
  readonly listingId: ExploreListingId;
}

export type CopyExploreSnapshotResult =
  | { readonly ok: true; readonly plan: TripPlan }
  | { readonly ok: false; readonly message: string };

const copyStay = (
  stay: ExploreStaySummary,
  route: ExplorePlanSnapshot["routes"][number],
  id: string
): AccommodationSnapshot => {
  // period는 오직 이 stay에 매칭된 정확한 route occurrence에서만 파생한다.
  return {
    id,
    city: stay.city,
    period: `${route.arrivalDate} ~ ${route.departureDate}`,
    nights: stay.nights,
    hotelName: stay.hotelName ?? "",
    isSearching: stay.isSearching,
    // sanitized away: bookingStatus는 명시적 unknown, price/url/confirmed 없음.
    bookingStatus: "NOT_CHECKED",
  };
};

const copyTransport = (
  transport: ExploreTransportSummary,
  id: string
): TransportSnapshot => ({
  id,
  fromCity: transport.fromCity,
  toCity: transport.toCity,
  mode: transport.mode,
  hasTransfer: transport.hasTransfer,
  durationText: transport.durationText,
  // sanitized away: bookingStatus는 명시적 unknown, price/url/confirmed 없음.
  bookingStatus: "NOT_CHECKED",
});

/**
 * 각 public stay를 아직 쓰지 않은 route 하나에 city + nights로 결정적으로
 * 매칭한다. 같은 도시를 여러 번 방문(동일 city의 route occurrence가 여러 개)해도
 * 각 stay가 서로 다른 route에 대응하도록 사용된 route index를 소진한다.
 * 매칭되는 route가 없으면 undefined를 반환해 호출자가 fabricate 없이 실패하게 한다.
 */
const matchStaysToRoutes = (
  stays: ReadonlyArray<ExploreStaySummary>,
  routes: ExplorePlanSnapshot["routes"]
): ReadonlyArray<ExplorePlanSnapshot["routes"][number]> | undefined => {
  const usedRouteIndexes = new Set<number>();
  const matched: Array<ExplorePlanSnapshot["routes"][number]> = [];
  for (const stay of stays) {
    const routeIndex = routes.findIndex(
      (route, index) =>
        !usedRouteIndexes.has(index) &&
        route.city.trim() === stay.city.trim() &&
        getStayNightCount(route) === stay.nights
    );
    if (routeIndex === -1) return undefined;
    usedRouteIndexes.add(routeIndex);
    matched.push(routes[routeIndex]!);
  }
  return matched;
};

export const copyExploreSnapshotToTripPlan = (
  params: CopyExploreSnapshotParams
): CopyExploreSnapshotResult => {
  const { snapshot, planId } = params;

  const routes = snapshot.routes.map((route) => ({
    city: route.city,
    arrivalDate: route.arrivalDate,
    departureDate: route.departureDate,
  }));

  // 각 stay를 사용되지 않은 route occurrence에 city + nights로 매칭한다.
  const matchedRoutes = matchStaysToRoutes(snapshot.stays, snapshot.routes);
  if (!matchedRoutes) {
    return {
      ok: false,
      message: "복사한 숙소 정보가 일정과 일치하지 않습니다.",
    };
  }

  // 내부 ID는 새 planId + kind + stable index로 결정적으로 파생한다(random 미사용).
  const accommodations = snapshot.stays.map((stay, index) =>
    copyStay(stay, matchedRoutes[index]!, `${planId}-stay-${index + 1}`)
  );
  const transports = snapshot.transports.map((transport, index) =>
    copyTransport(transport, `${planId}-transport-${index + 1}`)
  );

  const plan: TripPlan = {
    id: planId,
    title: snapshot.title,
    status: "VOTING",
    revision: RevisionSchema.make(1),
    publishedAt: params.publishedAt,
    authorId: params.authorId,
    authorName: params.authorName,
    baseHeadcount: params.baseHeadcount,
    routes,
    accommodations,
    transports,
    places: [],
    memberOpinions: [],
    voteCount: 0,
    importedFromExploreListingId: params.listingId,
  };

  // legacy/incomplete snapshot을 fake 값으로 메우지 않고 명시적으로 실패한다.
  const validationError = getPlanPublishValidationErrors(plan)[0];
  if (validationError) {
    return { ok: false, message: validationError };
  }
  if (!Schema.is(TripPlanSchema)(plan)) {
    return { ok: false, message: "복사한 여행안 형식이 올바르지 않습니다." };
  }

  return { ok: true, plan };
};
