import { Schema } from "effect";
import {
  ItineraryIdSchema,
  ParticipantIdSchema,
  PlanIdSchema,
  RevisionSchema,
  TripIdSchema,
} from "./ids.ts";
import {
  AccommodationSnapshotSchema,
  CityStaySchema,
  TransportSnapshotSchema,
  TravelDateSchema,
  type AccommodationSnapshot,
  type TransportSnapshot,
  type TripPlan,
  type TripRoom,
  getPlanPublishValidationErrors,
  getRouteValidationError,
} from "./room.ts";

export const IsoDateTimeSchema = Schema.String.check(
  Schema.makeFilter((value) => {
    const millis = Date.parse(value);
    return Number.isFinite(millis) && new Date(millis).toISOString() === value;
  }, { message: "UTC ISO 날짜-시간이어야 합니다." })
);

export const ItineraryStaySnapshotSchema = Schema.Struct({
  type: Schema.Literal("STAY"),
  date: TravelDateSchema,
  endDate: TravelDateSchema,
  memo: Schema.optional(Schema.String),
  accommodation: AccommodationSnapshotSchema,
});
export type ItineraryStaySnapshot = typeof ItineraryStaySnapshotSchema.Type;

export const ItineraryTransportSnapshotSchema = Schema.Struct({
  type: Schema.Literal("TRANSPORT"),
  date: TravelDateSchema,
  memo: Schema.optional(Schema.String),
  transport: TransportSnapshotSchema,
});
export type ItineraryTransportSnapshot = typeof ItineraryTransportSnapshotSchema.Type;

export const ItinerarySnapshotItemSchema = Schema.Union([
  ItineraryStaySnapshotSchema,
  ItineraryTransportSnapshotSchema,
]);
export type ItinerarySnapshotItem = typeof ItinerarySnapshotItemSchema.Type;

export const ItineraryChangeSchema = Schema.Struct({
  itemId: Schema.String,
  before: ItinerarySnapshotItemSchema,
  after: ItinerarySnapshotItemSchema,
});
export type ItineraryChange = typeof ItineraryChangeSchema.Type;

export const ItineraryAcknowledgementSchema = Schema.Struct({
  participantId: ParticipantIdSchema,
  acknowledgedRevision: RevisionSchema,
  acknowledgedAt: IsoDateTimeSchema,
});
export type ItineraryAcknowledgement =
  typeof ItineraryAcknowledgementSchema.Type;

export const ConfirmedItinerarySnapshotSchema = Schema.Struct({
  planTitle: Schema.String,
  destination: Schema.String,
  differenceSummary: Schema.optional(Schema.String),
  routes: Schema.Array(CityStaySchema).check(Schema.isNonEmpty()),
  items: Schema.Array(ItinerarySnapshotItemSchema).check(Schema.isNonEmpty()),
});
export type ConfirmedItinerarySnapshot = typeof ConfirmedItinerarySnapshotSchema.Type;

export const ConfirmedItinerarySchema = Schema.Struct({
  id: ItineraryIdSchema,
  tripId: TripIdSchema,
  sourcePlanId: PlanIdSchema,
  sourcePlanRevision: RevisionSchema,
  currentRevision: RevisionSchema,
  snapshot: ConfirmedItinerarySnapshotSchema,
  createdBy: ParticipantIdSchema,
  createdAt: IsoDateTimeSchema,
  changedBy: Schema.optional(ParticipantIdSchema),
  changedAt: Schema.optional(IsoDateTimeSchema),
  changes: Schema.optional(Schema.Array(ItineraryChangeSchema)),
});
export type ConfirmedItinerary = typeof ConfirmedItinerarySchema.Type;

export const ItineraryStayPatchSchema = Schema.Struct({
  type: Schema.Literal("STAY"),
  itemId: Schema.String,
  date: TravelDateSchema,
  endDate: TravelDateSchema,
  hotelName: Schema.String,
  memo: Schema.optional(Schema.String),
});

export const ItineraryTransportPatchSchema = Schema.Struct({
  type: Schema.Literal("TRANSPORT"),
  itemId: Schema.String,
  date: TravelDateSchema,
  fromCity: Schema.String,
  toCity: Schema.String,
  mode: Schema.String,
  memo: Schema.optional(Schema.String),
});

export const ItineraryItemPatchSchema = Schema.Union([
  ItineraryStayPatchSchema,
  ItineraryTransportPatchSchema,
]);
export type ItineraryItemPatch = typeof ItineraryItemPatchSchema.Type;

const cloneAccommodation = (value: AccommodationSnapshot): AccommodationSnapshot => ({
  ...value,
  priceRange: value.priceRange ? { ...value.priceRange } : undefined,
});

const cloneTransport = (value: TransportSnapshot): TransportSnapshot => ({
  ...value,
  priceRange: value.priceRange ? { ...value.priceRange } : undefined,
});

export const buildConfirmedItinerarySnapshot = (
  plan: TripPlan,
  destination: string
): ConfirmedItinerarySnapshot | undefined => {
  const routes = plan.routes ?? [];
  const accommodations = [...(plan.accommodations ?? [])];
  const transports = plan.transports ?? [];
  if (
    routes.length === 0 ||
    accommodations.length !== routes.length ||
    transports.length !== routes.length + 1
  ) {
    return undefined;
  }

  const matchedAccommodations: AccommodationSnapshot[] = [];
  for (const route of routes) {
    const index = accommodations.findIndex(
      ({ city }) => city.trim() === route.city.trim()
    );
    if (index === -1) return undefined;
    const [accommodation] = accommodations.splice(index, 1);
    if (!accommodation) return undefined;
    matchedAccommodations.push(accommodation);
  }

  const firstRoute = routes[0];
  const firstTransport = transports[0];
  if (!firstRoute || !firstTransport) return undefined;
  const items: ItinerarySnapshotItem[] = [
    {
      type: "TRANSPORT",
      date: firstRoute.arrivalDate,
      transport: cloneTransport(firstTransport),
    },
  ];

  for (let index = 0; index < routes.length; index += 1) {
    const route = routes[index];
    const accommodation = matchedAccommodations[index];
    if (!route || !accommodation) return undefined;
    items.push({
      type: "STAY",
      date: route.arrivalDate,
      endDate: route.departureDate,
      accommodation: cloneAccommodation(accommodation),
    });
    if (index < routes.length - 1) {
      const nextRoute = routes[index + 1];
      const transport = transports[index + 1];
      if (!nextRoute || !transport) return undefined;
      items.push({
        type: "TRANSPORT",
        date: nextRoute.arrivalDate,
        transport: cloneTransport(transport),
      });
    }
  }

  items.push({
    type: "TRANSPORT",
    date: routes.at(-1)!.departureDate,
    transport: cloneTransport(transports.at(-1)!),
  });

  return {
    planTitle: plan.title,
    destination,
    differenceSummary: plan.differenceSummary,
    routes: routes.map((route) => ({ ...route })),
    items,
  };
};

export type PlanConfirmability =
  | { readonly kind: "CONFIRMED" }
  | { readonly kind: "INVALID_PUBLISH"; readonly message: string }
  | { readonly kind: "INVALID_SNAPSHOT" }
  | { readonly kind: "CONFIRMABLE"; readonly snapshot: ConfirmedItinerarySnapshot };

/** 확정 use case와 NBA가 공유하는 순수 확정 가능성 판정이다. */
export const getPlanConfirmability = (
  room: TripRoom,
  plan: TripPlan,
): PlanConfirmability => {
  if (room.confirmedPlanId !== undefined || plan.status === "CONFIRMED") {
    return { kind: "CONFIRMED" };
  }

  const validationError = getPlanPublishValidationErrors(plan)[0];
  if (plan.status !== "VOTING" || !plan.revision || validationError) {
    return {
      kind: "INVALID_PUBLISH",
      message: validationError ?? "공개된 여행안 revision만 확정할 수 있습니다.",
    };
  }

  const snapshot = buildConfirmedItinerarySnapshot(plan, room.destination);
  return snapshot
    ? { kind: "CONFIRMABLE", snapshot }
    : { kind: "INVALID_SNAPSHOT" };
};

export const isPlanConfirmable = (
  room: TripRoom,
  plan: TripPlan,
): boolean => getPlanConfirmability(room, plan).kind === "CONFIRMABLE";

export const reviseConfirmedItinerary = (
  itinerary: ConfirmedItinerary,
  patches: ReadonlyArray<ItineraryItemPatch>,
  changedBy: typeof ParticipantIdSchema.Type,
  changedAt: string
): ConfirmedItinerary | string => {
  if (patches.length === 0) return "변경할 일정 항목이 없습니다.";
  const seen = new Set<string>();
  const items = [...itinerary.snapshot.items];
  const changes: ItineraryChange[] = [];

  for (const patch of patches) {
    if (seen.has(patch.itemId)) return "같은 일정 항목을 중복 변경할 수 없습니다.";
    seen.add(patch.itemId);
    const index = items.findIndex((item) =>
      item.type === "STAY"
        ? item.accommodation.id === patch.itemId
        : item.transport.id === patch.itemId
    );
    const before = items[index];
    if (!before || before.type !== patch.type) return "변경할 일정 항목을 찾을 수 없습니다.";
    if (
      patch.type === "STAY" &&
      before.type === "STAY" &&
      !patch.hotelName.trim() &&
      !before.accommodation.isSearching
    ) {
      return "숙소 이름을 입력해주세요.";
    }
    if (
      patch.type === "TRANSPORT" &&
      before.type === "TRANSPORT" &&
      (!patch.fromCity.trim() ||
        !patch.toCity.trim() ||
        (!patch.mode.trim() && before.transport.bookingStatus !== "NOT_CHECKED"))
    ) {
      return "이동 출발지, 도착지와 수단을 입력해주세요.";
    }

    const after: ItinerarySnapshotItem =
      patch.type === "STAY" && before.type === "STAY"
        ? {
            ...before,
            date: patch.date,
            endDate: patch.endDate,
            memo: patch.memo?.trim() || undefined,
            accommodation: {
              ...before.accommodation,
              hotelName: patch.hotelName.trim(),
              isSearching:
                patch.hotelName.trim() !== before.accommodation.hotelName &&
                patch.hotelName.trim()
                  ? false
                  : before.accommodation.isSearching,
              period:
                patch.date !== before.date || patch.endDate !== before.endDate
                  ? `${patch.date} ~ ${patch.endDate}`
                  : before.accommodation.period,
              nights:
                patch.date !== before.date || patch.endDate !== before.endDate
                  ? Math.round(
                      (Date.parse(`${patch.endDate}T00:00:00Z`) -
                        Date.parse(`${patch.date}T00:00:00Z`)) /
                        86_400_000
                    )
                  : before.accommodation.nights,
            },
          }
        : patch.type === "TRANSPORT" && before.type === "TRANSPORT"
          ? {
              ...before,
              date: patch.date,
              memo: patch.memo?.trim() || undefined,
              transport: {
                ...before.transport,
                fromCity: patch.fromCity.trim(),
                toCity: patch.toCity.trim(),
                mode: patch.mode.trim(),
              },
            }
          : before;
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      items[index] = after;
      changes.push({ itemId: patch.itemId, before, after });
    }
  }

  if (changes.length === 0) return "변경된 일정 내용이 없습니다.";
  const stays = items.filter((item): item is ItineraryStaySnapshot => item.type === "STAY");
  const routes = stays.map(({ date, endDate, accommodation }) => ({
    city: accommodation.city,
    arrivalDate: date,
    departureDate: endDate,
  }));
  const routeError = getRouteValidationError(routes);
  if (routeError) return routeError;
  const first = routes[0];
  const last = routes.at(-1);
  if (!first || !last) return "숙소 일정이 필요합니다.";
  if (items.some(({ date }) => date < first.arrivalDate || date > last.departureDate)) {
    return "이동 날짜는 여행 기간 안이어야 합니다.";
  }
  const transports = items.filter(
    (item): item is ItineraryTransportSnapshot => item.type === "TRANSPORT"
  );
  if (
    transports[0]?.date !== first.arrivalDate ||
    transports.at(-1)?.date !== last.departureDate
  ) {
    return "출국과 귀국 이동 날짜는 첫 도착일과 마지막 출발일에 맞아야 합니다.";
  }

  return {
    ...itinerary,
    currentRevision: RevisionSchema.make(itinerary.currentRevision + 1),
    snapshot: { ...itinerary.snapshot, routes, items },
    changedBy,
    changedAt,
    changes,
  };
};
