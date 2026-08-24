export const TRIP_ROOM_SECTIONS = ["plans", "itinerary"] as const;

export type TripRoomSection = (typeof TRIP_ROOM_SECTIONS)[number];

export function getTripRoomSection(pathname: string): TripRoomSection {
  return pathname.endsWith("/itinerary") ? "itinerary" : "plans";
}

export function getTripRoomSectionPath(tripId: string, value: unknown): string {
  const section = TRIP_ROOM_SECTIONS.find((candidate) => candidate === value) ?? "plans";
  return `/trips/${tripId}/${section}`;
}
