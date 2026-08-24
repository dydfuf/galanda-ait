import { Schema } from "effect";
import {
  ParticipantIdSchema,
  PlanIdSchema,
  RevisionSchema,
  TripIdSchema,
} from "./ids.ts";

export const PlanStatusSchema = Schema.Literals(["DRAFT", "VOTING", "CONFIRMED"]);
export type PlanStatus = typeof PlanStatusSchema.Type;

export const BookingStatusSchema = Schema.Literals(["AVAILABLE", "NEED_CHECK", "FULL", "NOT_CHECKED"]);
export type BookingStatus = typeof BookingStatusSchema.Type;

export const PriceRangeSchema = Schema.Struct({
  min: Schema.Number,
  max: Schema.Number,
});
export type PriceRange = typeof PriceRangeSchema.Type;

const isValidTravelDate = (value: string): boolean => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

export const TravelDateSchema = Schema.String.check(
  Schema.makeFilter(isValidTravelDate, { message: "YYYY-MM-DD 형식의 유효한 날짜여야 합니다." })
);
export type TravelDate = typeof TravelDateSchema.Type;

export const CityStaySchema = Schema.Struct({
  city: Schema.String,
  arrivalDate: TravelDateSchema,
  departureDate: TravelDateSchema,
});
export type CityStay = typeof CityStaySchema.Type;

export interface PlanDateRange {
  readonly startDate: TravelDate;
  readonly endDate: TravelDate;
}

export const getStayNightCount = (stay: CityStay): number => {
  const nights = Math.round(
    (Date.parse(`${stay.departureDate}T00:00:00Z`) -
      Date.parse(`${stay.arrivalDate}T00:00:00Z`)) /
      86_400_000
  );
  return Number.isFinite(nights) ? nights : 0;
};

export const getPlanDateRange = (
  plan: Pick<TripPlan, "routes">
): PlanDateRange | undefined => {
  const routes = plan.routes ?? [];
  const first = routes[0];
  const last = routes[routes.length - 1];
  return first && last
    ? { startDate: first.arrivalDate, endDate: last.departureDate }
    : undefined;
};

export const getPlanNightCount = (plan: Pick<TripPlan, "routes">): number => {
  const range = getPlanDateRange(plan);
  return range
    ? Math.round((Date.parse(`${range.endDate}T00:00:00Z`) - Date.parse(`${range.startDate}T00:00:00Z`)) / 86_400_000)
    : 0;
};

/** 공백은 허용하지만, 잘못된 체류 구간과 앞 체류와의 겹침은 거부한다. */
export const getRouteValidationError = (
  routes: ReadonlyArray<CityStay>
): string | undefined => {
  for (let index = 0; index < routes.length; index += 1) {
    const stay = routes[index];
    if (stay.arrivalDate >= stay.departureDate) {
      return `${stay.city || "도시"}의 출발일은 도착일 이후여야 합니다.`;
    }
    const previous = routes[index - 1];
    if (previous && previous.departureDate > stay.arrivalDate) {
      return "도시 체류 일정은 서로 겹칠 수 없습니다.";
    }
  }
  return undefined;
};

export const AccommodationSnapshotSchema = Schema.Struct({
  id: Schema.String,
  city: Schema.String,
  period: Schema.String,
  nights: Schema.Number,
  hotelName: Schema.String,
  isSearching: Schema.optional(Schema.Boolean),
  bookingStatus: BookingStatusSchema,
  priceRange: Schema.optional(PriceRangeSchema),
  bookingUrl: Schema.optional(Schema.String),
  confirmedBy: Schema.optional(Schema.String),
  confirmedAt: Schema.optional(Schema.String),
});
export type AccommodationSnapshot = typeof AccommodationSnapshotSchema.Type;

export const TransportSnapshotSchema = Schema.Struct({
  id: Schema.String,
  fromCity: Schema.String,
  toCity: Schema.String,
  mode: Schema.String,
  hasTransfer: Schema.Boolean,
  durationText: Schema.String,
  bookingStatus: BookingStatusSchema,
  priceRange: Schema.optional(PriceRangeSchema),
  bookingUrl: Schema.optional(Schema.String),
  confirmedBy: Schema.optional(Schema.String),
  confirmedAt: Schema.optional(Schema.String),
});
export type TransportSnapshot = typeof TransportSnapshotSchema.Type;

export const PlanMemberOpinionSchema = Schema.Struct({
  userId: ParticipantIdSchema,
  userName: Schema.String,
  reaction: Schema.Literals(["LIKE", "OKAY", "HARD"]),
  reason: Schema.optional(Schema.String),
});
export type PlanMemberOpinion = typeof PlanMemberOpinionSchema.Type;
/** 공개 응답에 포함해도 되는 의견 정보. HARD 사유는 작성자 전용 데이터다. */
export type PublicPlanMemberOpinion = Omit<PlanMemberOpinion, "reason">;

export const TripPlaceSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  category: Schema.String,
  address: Schema.String,
  latitude: Schema.optional(Schema.Number),
  longitude: Schema.optional(Schema.Number),
});
export type TripPlace = typeof TripPlaceSchema.Type;

const PublishedAtSchema = Schema.String.check(
  Schema.makeFilter((value) => {
    const millis = Date.parse(value);
    return Number.isFinite(millis) && new Date(millis).toISOString() === value;
  }, { message: "publishedAt은 UTC ISO 날짜-시간이어야 합니다." })
);

export const TripPlanSchema = Schema.Struct({
  id: PlanIdSchema,
  title: Schema.String,
  status: PlanStatusSchema,
  revision: Schema.optional(
    RevisionSchema.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(1))
  ),
  publishedAt: Schema.optional(PublishedAtSchema),
  proposalReason: Schema.optional(Schema.String),
  authorId: Schema.optional(ParticipantIdSchema),
  authorName: Schema.optional(Schema.String),
  baseHeadcount: Schema.optional(Schema.Number),
  routes: Schema.optional(Schema.Array(CityStaySchema)),
  accommodations: Schema.optional(Schema.Array(AccommodationSnapshotSchema)),
  transports: Schema.optional(Schema.Array(TransportSnapshotSchema)),
  places: Schema.Array(TripPlaceSchema),
  clonedFromPlanId: Schema.optional(PlanIdSchema),
  differenceSummary: Schema.optional(Schema.String),
  memberOpinions: Schema.optional(Schema.Array(PlanMemberOpinionSchema)),
  voteCount: Schema.Number,
});
export type TripPlan = typeof TripPlanSchema.Type;

export const getPlanPublishValidationErrors = (
  plan: Pick<
    TripPlan,
    | "title"
    | "baseHeadcount"
    | "routes"
    | "accommodations"
    | "transports"
  >
): ReadonlyArray<string> => {
  const errors: string[] = [];
  const routes = plan.routes ?? [];
  const accommodations = plan.accommodations ?? [];
  const transports = plan.transports ?? [];

  if (!plan.title.trim()) errors.push("여행안 제목을 입력해주세요.");
  if (!Number.isInteger(plan.baseHeadcount) || (plan.baseHeadcount ?? 0) < 1) {
    errors.push("기준 인원수는 1명 이상이어야 합니다.");
  }
  if (routes.length === 0) {
    errors.push("최소 1개 이상의 방문 도시를 추가해주세요.");
  } else {
    const incompleteRoute = routes.find(
      ({ city, arrivalDate, departureDate }) =>
        !city.trim() || !arrivalDate || !departureDate
    );
    if (incompleteRoute) {
      errors.push(`${incompleteRoute.city || "도시"}의 도착일과 출발일을 입력해주세요.`);
    }
    const routeError = getRouteValidationError(routes);
    if (routeError) errors.push(routeError);

    const missingAccommodation =
      accommodations.length < routes.length ||
      routes.some((route) =>
        !accommodations.some(
          (stay) =>
            stay.city.trim() === route.city.trim() &&
            Boolean(stay.period.trim()) &&
            stay.nights === getStayNightCount(route) &&
            Boolean(stay.isSearching || stay.hotelName.trim())
        )
      );
    if (missingAccommodation) {
      errors.push("각 방문 도시의 숙소 또는 숙소 찾는 중 상태를 추가해주세요.");
    }

    const requiredTransportCount = routes.length + 1;
    if (transports.length < requiredTransportCount) {
      errors.push(`출국·도시 간 이동·귀국 교통을 ${requiredTransportCount}개 추가해주세요.`);
    }
  }

  if (accommodations.some((stay) =>
    !stay.city.trim() ||
    !stay.period.trim() ||
    !Number.isInteger(stay.nights) ||
    stay.nights < 1 ||
    (stay.isSearching ? Boolean(stay.hotelName.trim()) : !stay.hotelName.trim())
  )) {
    errors.push("각 방문 도시의 숙소 또는 숙소 찾는 중 상태를 추가해주세요.");
  }

  const incompleteTransport = transports.find(
    (transport) =>
      !transport.fromCity.trim() ||
      !transport.toCity.trim() ||
      (transport.bookingStatus !== "NOT_CHECKED" &&
        (!transport.mode.trim() || !transport.durationText.trim()))
  );
  if (incompleteTransport) {
    errors.push("교통 구간의 출발지·도착지와 확인 상태를 입력해주세요.");
  }

  const invalidPriceRange = [...accommodations, ...transports].find(
    ({ priceRange }) =>
      priceRange &&
      (!Number.isFinite(priceRange.min) ||
        !Number.isFinite(priceRange.max) ||
        priceRange.min < 0 ||
        priceRange.max < priceRange.min)
  );
  if (invalidPriceRange) {
    errors.push("가격 범위는 0원 이상이며 최소 금액이 최대 금액보다 클 수 없습니다.");
  }

  return [...new Set(errors)];
};

export const TripMemberSchema = Schema.Struct({
  id: ParticipantIdSchema,
  name: Schema.String,
  role: Schema.Literals(["HOST", "MEMBER"]),
});
export type TripMember = typeof TripMemberSchema.Type;

export const TripRoomSchema = Schema.Struct({
  id: TripIdSchema,
  title: Schema.String,
  destination: Schema.String,
  revision: RevisionSchema,
  members: Schema.Array(TripMemberSchema),
  plans: Schema.Array(TripPlanSchema),
  confirmedPlanId: Schema.optional(PlanIdSchema),
});
export type TripRoom = typeof TripRoomSchema.Type;

export const getConfirmedPlan = (room: TripRoom): TripPlan | undefined =>
  room.plans.find((plan) => plan.id === room.confirmedPlanId);

export const getTripRoomDisplayDate = (
  room: TripRoom
): PlanDateRange | undefined => {
  const plan = getConfirmedPlan(room);
  return plan ? getPlanDateRange(plan) : undefined;
};

export const UserSessionSchema = Schema.Struct({
  participantId: ParticipantIdSchema,
  participantIds: Schema.Array(ParticipantIdSchema),
  accountType: Schema.Literals(["GUEST", "REGISTERED"]),
  name: Schema.String,
  isAuthenticated: Schema.Boolean,
});
export type UserSession = typeof UserSessionSchema.Type;
