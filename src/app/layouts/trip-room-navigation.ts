export const TRIP_ROOM_SECTIONS = ["plans", "itinerary"] as const;

export type TripRoomSection = (typeof TRIP_ROOM_SECTIONS)[number];

function normalizePathname(pathname: string): string {
  const normalized = pathname.replace(/\/+$/, "");
  return normalized || "/";
}

export function getTripRoomSection(pathname: string): TripRoomSection {
  const normalized = normalizePathname(pathname);
  return normalized.endsWith("/itinerary") ? "itinerary" : "plans";
}

export function getTripRoomSectionPath(tripId: string, value: unknown): string {
  const section = TRIP_ROOM_SECTIONS.find((candidate) => candidate === value) ?? "plans";
  return `/trips/${tripId}/${section}`;
}

/** Web PageHeader에 표시할 현재 여행방 route 제목을 정해요. */
export function getTripRoomNavigationTitle(pathname: string): string {
  const normalized = normalizePathname(pathname);

  if (normalized.endsWith("/itinerary/edit")) {
    return "일정 수정";
  }
  if (normalized.includes("/plans/new")) {
    return "새 여행안";
  }
  if (normalized.endsWith("/plans/compare")) {
    return "여행안 비교";
  }
  if (normalized.includes("/edit")) {
    return "여행안 수정";
  }
  if (normalized.endsWith("/plans") || normalized.endsWith("/itinerary")) {
    return "여행방";
  }
  return "여행안 상세";
}
