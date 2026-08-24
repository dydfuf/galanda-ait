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
} from "./room.ts";

export const ItineraryStaySnapshotSchema = Schema.Struct({
  type: Schema.Literal("STAY"),
  date: TravelDateSchema,
  endDate: TravelDateSchema,
  accommodation: AccommodationSnapshotSchema,
});
export type ItineraryStaySnapshot = typeof ItineraryStaySnapshotSchema.Type;

export const ItineraryTransportSnapshotSchema = Schema.Struct({
  type: Schema.Literal("TRANSPORT"),
  date: TravelDateSchema,
  transport: TransportSnapshotSchema,
});
export type ItineraryTransportSnapshot = typeof ItineraryTransportSnapshotSchema.Type;

export const ItinerarySnapshotItemSchema = Schema.Union([
  ItineraryStaySnapshotSchema,
  ItineraryTransportSnapshotSchema,
]);
export type ItinerarySnapshotItem = typeof ItinerarySnapshotItemSchema.Type;

export const ConfirmedItinerarySnapshotSchema = Schema.Struct({
  planTitle: Schema.String,
  destination: Schema.String,
  differenceSummary: Schema.optional(Schema.String),
  routes: Schema.Array(CityStaySchema).check(Schema.isNonEmpty()),
  items: Schema.Array(ItinerarySnapshotItemSchema).check(Schema.isNonEmpty()),
});
export type ConfirmedItinerarySnapshot = typeof ConfirmedItinerarySnapshotSchema.Type;

export const IsoDateTimeSchema = Schema.String.check(
  Schema.makeFilter((value) => {
    const millis = Date.parse(value);
    return Number.isFinite(millis) && new Date(millis).toISOString() === value;
  }, { message: "UTC ISO 날짜-시간이어야 합니다." })
);

export const ConfirmedItinerarySchema = Schema.Struct({
  id: ItineraryIdSchema,
  tripId: TripIdSchema,
  sourcePlanId: PlanIdSchema,
  sourcePlanRevision: RevisionSchema,
  currentRevision: RevisionSchema,
  snapshot: ConfirmedItinerarySnapshotSchema,
  createdBy: ParticipantIdSchema,
  createdAt: IsoDateTimeSchema,
});
export type ConfirmedItinerary = typeof ConfirmedItinerarySchema.Type;

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
