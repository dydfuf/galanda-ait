import { formatCostRangeText } from "../../core/calculations/plan-cost.ts";
import type { ConfirmedItineraryResponse } from "../../contracts/itinerary.ts";

export interface ItineraryRouteSegment {
  readonly city: string;
  readonly nights: number;
}

export type ItineraryStatus = "AVAILABLE" | "NEED_CHECK" | "FULL" | "SEARCHING";
type StatusColor = "green" | "yellow" | "red" | "elephant";

interface ItineraryItemBase {
  readonly id: string;
  readonly priceText: string;
  readonly bookingStatus: ItineraryStatus;
  readonly statusLabel: string;
  readonly statusColor: StatusColor;
  readonly confirmedInfo: string;
  readonly bookingUrl?: string;
  readonly subText: string;
}

export interface ItineraryStayItem extends ItineraryItemBase {
  readonly type: "STAY";
  readonly city: string;
  readonly hotelName: string;
  readonly period: string;
  readonly periodText: string;
  readonly nights: number;
}

export interface ItineraryTransportItem extends ItineraryItemBase {
  readonly type: "TRANSPORT";
  readonly fromCity: string;
  readonly toCity: string;
  readonly routeTitle: string;
  readonly mode: string;
  readonly hasTransfer: boolean;
  readonly durationText: string;
}

export type ItineraryItem = ItineraryStayItem | ItineraryTransportItem;

export interface ItineraryDateSection {
  readonly id: string;
  readonly dateHeader: string;
  readonly dateStr: string;
  readonly items: ReadonlyArray<ItineraryItem>;
}

export interface ItineraryNeedCheckItem {
  readonly id: string;
  readonly itemType: "STAY" | "TRANSPORT";
  readonly title: string;
  readonly message: string;
  readonly snapshotInfo: string;
  readonly status: "NEED_CHECK" | "FULL" | "SEARCHING";
  readonly statusLabel: string;
  readonly statusColor: "yellow" | "red" | "elephant";
  readonly dateText: string;
}

export interface ItineraryViewModel {
  readonly tripId: string;
  readonly destination: string;
  readonly periodText: string;
  readonly confirmedPlanId: string;
  readonly confirmedPlanTitle: string;
  readonly nights: number;
  readonly days: number;
  readonly route: ReadonlyArray<ItineraryRouteSegment>;
  readonly differenceSummary?: string;
  readonly needCheckCount: number;
  readonly hasNeedCheckDanger: boolean;
  readonly needCheckItems: ReadonlyArray<ItineraryNeedCheckItem>;
  readonly sections: ReadonlyArray<ItineraryDateSection>;
}

export interface YMD {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

export function parseYMD(dateStr?: string): YMD | null {
  if (!dateStr) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? { year, month, day }
    : null;
}

export const formatKoreanDate = (ymd: YMD): string =>
  `${ymd.month}월 ${ymd.day}일`;

export const formatDotDate = (ymd: YMD, includeYear = false): string =>
  includeYear ? `${ymd.year}.${ymd.month}.${ymd.day}` : `${ymd.month}.${ymd.day}`;

export function formatPeriodText(startDate: string, endDate: string): string {
  const start = parseYMD(startDate);
  const end = parseYMD(endDate);
  if (!start || !end) return "일정 미정";
  return start.year === end.year
    ? `${formatDotDate(start)} ~ ${formatDotDate(end)}`
    : `${formatDotDate(start, true)} ~ ${formatDotDate(end, true)}`;
}

const daysBetween = (start: string, end: string): number =>
  Math.round(
    (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) /
      86_400_000
  );

export function getStayStatusBadge(status: ItineraryStatus): {
  readonly label: string;
  readonly color: StatusColor;
} {
  switch (status) {
    case "AVAILABLE":
      return { label: "예약 완료", color: "green" };
    case "NEED_CHECK":
      return { label: "확인 필요", color: "yellow" };
    case "FULL":
      return { label: "만실", color: "red" };
    default:
      return { label: "확인 전", color: "elephant" };
  }
}

export function getTransportStatusBadge(status: ItineraryStatus): {
  readonly label: string;
  readonly color: StatusColor;
} {
  switch (status) {
    case "AVAILABLE":
      return { label: "예매 가능", color: "green" };
    case "NEED_CHECK":
      return { label: "확인 필요", color: "yellow" };
    case "FULL":
      return { label: "매진", color: "red" };
    default:
      return { label: "확인 전", color: "elephant" };
  }
}

const priceText = (price?: { readonly min: number; readonly max: number }): string =>
  price ? `그룹 총액 ${formatCostRangeText(price.min, price.max)}` : "가격 미정";

const confirmationText = (by?: string, at?: string): string =>
  by || at ? `${by ?? "확정자"} · ${at ?? "확정 당시"}` : "확정 당시 snapshot";

export function toItineraryViewModel(
  itinerary: ConfirmedItineraryResponse
): ItineraryViewModel {
  const { snapshot } = itinerary;
  const firstRoute = snapshot.routes[0]!;
  const lastRoute = snapshot.routes.at(-1)!;
  const nights = daysBetween(firstRoute.arrivalDate, lastRoute.departureDate);
  const needCheckItems: ItineraryNeedCheckItem[] = [];
  const sections = new Map<string, ItineraryItem[]>();

  for (const item of snapshot.items) {
    if (item.type === "STAY") {
      const accommodation = item.accommodation;
      const status: ItineraryStatus =
        accommodation.bookingStatus === "NOT_CHECKED" || accommodation.isSearching
          ? "SEARCHING"
          : accommodation.bookingStatus;
      const badge = getStayStatusBadge(status);
      const viewItem: ItineraryStayItem = {
        type: "STAY",
        id: accommodation.id,
        city: accommodation.city,
        hotelName: accommodation.hotelName,
        period: accommodation.period,
        periodText: formatPeriodText(item.date, item.endDate),
        nights: daysBetween(item.date, item.endDate),
        priceText: priceText(accommodation.priceRange),
        bookingStatus: status,
        statusLabel: badge.label,
        statusColor: badge.color,
        confirmedInfo: confirmationText(accommodation.confirmedBy, accommodation.confirmedAt),
        bookingUrl: accommodation.bookingUrl,
        subText: `${daysBetween(item.date, item.endDate)}박 · ${badge.label}`,
      };
      sections.set(item.date, [...(sections.get(item.date) ?? []), viewItem]);
      if (status !== "AVAILABLE") {
        needCheckItems.push({
          id: `need-check-stay-${accommodation.id}`,
          itemType: "STAY",
          title: accommodation.hotelName,
          message: `${accommodation.city} 숙소 예약 상태를 확인해주세요.`,
          snapshotInfo: viewItem.confirmedInfo,
          status: status === "FULL" ? "FULL" : status === "NEED_CHECK" ? "NEED_CHECK" : "SEARCHING",
          statusLabel: badge.label,
          statusColor: status === "FULL" ? "red" : status === "NEED_CHECK" ? "yellow" : "elephant",
          dateText: item.date,
        });
      }
      continue;
    }

    const transport = item.transport;
    const status: ItineraryStatus =
      transport.bookingStatus === "NOT_CHECKED" ? "SEARCHING" : transport.bookingStatus;
    const badge = getTransportStatusBadge(status);
    const viewItem: ItineraryTransportItem = {
      type: "TRANSPORT",
      id: transport.id,
      fromCity: transport.fromCity,
      toCity: transport.toCity,
      routeTitle: `${transport.fromCity} → ${transport.toCity}`,
      mode: transport.mode,
      hasTransfer: transport.hasTransfer,
      durationText: transport.durationText,
      priceText: priceText(transport.priceRange),
      bookingStatus: status,
      statusLabel: badge.label,
      statusColor: badge.color,
      confirmedInfo: confirmationText(transport.confirmedBy, transport.confirmedAt),
      bookingUrl: transport.bookingUrl,
      subText: `${transport.mode} · ${badge.label}`,
    };
    sections.set(item.date, [...(sections.get(item.date) ?? []), viewItem]);
    if (status !== "AVAILABLE") {
      needCheckItems.push({
        id: `need-check-transport-${transport.id}`,
        itemType: "TRANSPORT",
        title: viewItem.routeTitle,
        message: `${viewItem.routeTitle} 교통 예약 상태를 확인해주세요.`,
        snapshotInfo: viewItem.confirmedInfo,
        status: status === "FULL" ? "FULL" : status === "NEED_CHECK" ? "NEED_CHECK" : "SEARCHING",
        statusLabel: badge.label,
        statusColor: status === "FULL" ? "red" : status === "NEED_CHECK" ? "yellow" : "elephant",
        dateText: item.date,
      });
    }
  }

  return {
    tripId: itinerary.tripId,
    destination: snapshot.destination,
    periodText: formatPeriodText(firstRoute.arrivalDate, lastRoute.departureDate),
    confirmedPlanId: itinerary.sourcePlanId,
    confirmedPlanTitle: snapshot.planTitle,
    nights,
    days: nights + 1,
    route: snapshot.routes.map((route) => ({
      city: route.city,
      nights: daysBetween(route.arrivalDate, route.departureDate),
    })),
    differenceSummary: snapshot.differenceSummary,
    needCheckCount: needCheckItems.length,
    hasNeedCheckDanger: needCheckItems.some(({ status }) => status === "FULL"),
    needCheckItems,
    sections: [...sections.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dateStr, items]) => ({
        id: `section-${dateStr}`,
        dateStr,
        dateHeader: formatKoreanDate(parseYMD(dateStr)!),
        items,
      })),
  };
}
