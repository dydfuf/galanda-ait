import { formatCostRangeText } from "../../core/calculations/plan-cost.ts";
import type { ConfirmedItineraryResponse } from "../../contracts/itinerary.ts";

export interface ItineraryRouteSegment {
  readonly city: string;
  readonly nights: number;
}

export type ItineraryStatus = "AVAILABLE" | "NEED_CHECK" | "FULL" | "SEARCHING";
export type ItineraryStatusTone = "success" | "warning" | "danger" | "neutral";

interface ItineraryItemBase {
  readonly id: string;
  readonly priceText: string;
  readonly bookingStatus: ItineraryStatus;
  readonly statusLabel: string;
  readonly statusTone: ItineraryStatusTone;
  readonly confirmedInfo: string;
  readonly bookingUrl?: string;
  readonly subText: string;
  readonly memo?: string;
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
  readonly statusTone: Exclude<ItineraryStatusTone, "success">;
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

const displayValue = (value: string, fallback: string): string =>
  value.trim().length > 0 ? value : fallback;

export function getStayStatusBadge(status: ItineraryStatus): {
  readonly label: string;
  readonly tone: ItineraryStatusTone;
} {
  switch (status) {
    case "AVAILABLE":
      return { label: "예약 완료", tone: "success" };
    case "NEED_CHECK":
      return { label: "확인 필요", tone: "warning" };
    case "FULL":
      return { label: "만실", tone: "danger" };
    default:
      return { label: "확인 전", tone: "neutral" };
  }
}

export function getTransportStatusBadge(status: ItineraryStatus): {
  readonly label: string;
  readonly tone: ItineraryStatusTone;
} {
  switch (status) {
    case "AVAILABLE":
      return { label: "예매 가능", tone: "success" };
    case "NEED_CHECK":
      return { label: "확인 필요", tone: "warning" };
    case "FULL":
      return { label: "매진", tone: "danger" };
    default:
      return { label: "확인 전", tone: "neutral" };
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
  const sections: Array<{
    readonly id: string;
    readonly dateStr: string;
    readonly items: ItineraryItem[];
  }> = [];
  const dateSectionOccurrences = new Map<string, number>();

  const appendToDateSection = (dateStr: string, item: ItineraryItem): void => {
    const currentSection = sections.at(-1);
    if (currentSection?.dateStr === dateStr) {
      currentSection.items.push(item);
      return;
    }

    const occurrence = (dateSectionOccurrences.get(dateStr) ?? 0) + 1;
    dateSectionOccurrences.set(dateStr, occurrence);
    sections.push({
      id:
        occurrence === 1
          ? `section-${dateStr}`
          : `section-${dateStr}-${occurrence}`,
      dateStr,
      items: [item],
    });
  };

  for (const item of snapshot.items) {
    if (item.type === "STAY") {
      const accommodation = item.accommodation;
      const status: ItineraryStatus =
        accommodation.bookingStatus === "NOT_CHECKED" || accommodation.isSearching
          ? "SEARCHING"
          : accommodation.bookingStatus;
      const badge = getStayStatusBadge(status);
      const city = displayValue(accommodation.city, "도시 미정");
      const hotelName = displayValue(accommodation.hotelName, "숙소 이름 미정");
      const stayNights = daysBetween(item.date, item.endDate);
      const viewItem: ItineraryStayItem = {
        type: "STAY",
        id: accommodation.id,
        city,
        hotelName,
        period: displayValue(accommodation.period, "숙박 기간 미정"),
        periodText: formatPeriodText(item.date, item.endDate),
        nights: stayNights,
        priceText: priceText(accommodation.priceRange),
        bookingStatus: status,
        statusLabel: badge.label,
        statusTone: badge.tone,
        confirmedInfo: confirmationText(
          accommodation.confirmedBy,
          accommodation.confirmedAt,
        ),
        bookingUrl: accommodation.bookingUrl,
        subText: `${stayNights}박 · ${badge.label}`,
        memo: item.memo,
      };
      appendToDateSection(item.date, viewItem);
      if (status !== "AVAILABLE") {
        needCheckItems.push({
          id: `need-check-stay-${accommodation.id}`,
          itemType: "STAY",
          title: hotelName,
          message: `${city} 숙소 예약 상태를 확인해주세요.`,
          snapshotInfo: viewItem.confirmedInfo,
          status:
            status === "FULL"
              ? "FULL"
              : status === "NEED_CHECK"
                ? "NEED_CHECK"
                : "SEARCHING",
          statusLabel: badge.label,
          statusTone:
            status === "FULL"
              ? "danger"
              : status === "NEED_CHECK"
                ? "warning"
                : "neutral",
          dateText: item.date,
        });
      }
      continue;
    }

    const transport = item.transport;
    const status: ItineraryStatus =
      transport.bookingStatus === "NOT_CHECKED" ? "SEARCHING" : transport.bookingStatus;
    const badge = getTransportStatusBadge(status);
    const fromCity = displayValue(transport.fromCity, "출발지 미정");
    const toCity = displayValue(transport.toCity, "도착지 미정");
    const mode = displayValue(transport.mode, "이동 수단 미정");
    const durationText = displayValue(transport.durationText, "소요 시간 미정");
    const viewItem: ItineraryTransportItem = {
      type: "TRANSPORT",
      id: transport.id,
      fromCity,
      toCity,
      routeTitle: `${fromCity} → ${toCity}`,
      mode,
      hasTransfer: transport.hasTransfer,
      durationText,
      priceText: priceText(transport.priceRange),
      bookingStatus: status,
      statusLabel: badge.label,
      statusTone: badge.tone,
      confirmedInfo: confirmationText(
        transport.confirmedBy,
        transport.confirmedAt,
      ),
      bookingUrl: transport.bookingUrl,
      subText: `${mode} · ${badge.label}`,
      memo: item.memo,
    };
    appendToDateSection(item.date, viewItem);
    if (status !== "AVAILABLE") {
      needCheckItems.push({
        id: `need-check-transport-${transport.id}`,
        itemType: "TRANSPORT",
        title: viewItem.routeTitle,
        message: `${viewItem.routeTitle} 교통 예약 상태를 확인해주세요.`,
        snapshotInfo: viewItem.confirmedInfo,
        status:
          status === "FULL"
            ? "FULL"
            : status === "NEED_CHECK"
              ? "NEED_CHECK"
              : "SEARCHING",
        statusLabel: badge.label,
        statusTone:
          status === "FULL"
            ? "danger"
            : status === "NEED_CHECK"
              ? "warning"
              : "neutral",
        dateText: item.date,
      });
    }
  }

  return {
    tripId: itinerary.tripId,
    destination: displayValue(snapshot.destination, "여행지 미정"),
    periodText: formatPeriodText(
      firstRoute.arrivalDate,
      lastRoute.departureDate,
    ),
    confirmedPlanId: itinerary.sourcePlanId,
    confirmedPlanTitle: displayValue(
      snapshot.planTitle,
      "확정 여행안 제목 미정",
    ),
    nights,
    days: nights + 1,
    route: snapshot.routes.map((route) => ({
      city: displayValue(route.city, "도시 미정"),
      nights: daysBetween(route.arrivalDate, route.departureDate),
    })),
    differenceSummary: snapshot.differenceSummary,
    needCheckCount: needCheckItems.length,
    hasNeedCheckDanger: needCheckItems.some(({ status }) => status === "FULL"),
    needCheckItems,
    sections: sections.map(({ id, dateStr, items }) => ({
      id,
      dateStr,
      dateHeader: formatKoreanDate(parseYMD(dateStr)!),
      items,
    })),
  };
}
