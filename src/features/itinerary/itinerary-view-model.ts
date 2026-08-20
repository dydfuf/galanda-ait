import type {
  CityStay,
  TripPlan,
  TripRoom,
} from "../../core/domain/room.ts";
import { formatCostRangeText } from "../../core/calculations/plan-cost.ts";

export type ItineraryStatus = "AVAILABLE" | "NEED_CHECK" | "FULL" | "SEARCHING";

export interface ItineraryStayItem {
  readonly type: "STAY";
  readonly id: string;
  readonly city: string;
  readonly hotelName: string;
  readonly period: string;
  readonly periodText: string;
  readonly nights: number;
  readonly priceText: string;
  readonly bookingStatus: ItineraryStatus;
  readonly statusLabel: string;
  readonly statusColor: "green" | "yellow" | "red" | "elephant";
  readonly confirmedInfo: string;
  readonly bookingUrl?: string;
  readonly subText: string;
  /** Future compatibility (RAON-144): revision / ack status */
  readonly ackStatus?: "CHANGED" | "UNACKNOWLEDGED" | "ACKNOWLEDGED";
}

export interface ItineraryTransportItem {
  readonly type: "TRANSPORT";
  readonly id: string;
  readonly fromCity: string;
  readonly toCity: string;
  readonly routeTitle: string;
  readonly mode: string;
  readonly hasTransfer: boolean;
  readonly durationText: string;
  readonly priceText: string;
  readonly bookingStatus: ItineraryStatus;
  readonly statusLabel: string;
  readonly statusColor: "green" | "yellow" | "red" | "elephant";
  readonly confirmedInfo: string;
  readonly bookingUrl?: string;
  readonly subText: string;
  /** Future compatibility (RAON-144): revision / ack status */
  readonly ackStatus?: "CHANGED" | "UNACKNOWLEDGED" | "ACKNOWLEDGED";
}

export type ItineraryItem = ItineraryStayItem | ItineraryTransportItem;

export interface ItineraryDateSection {
  readonly id: string;
  readonly dateHeader: string;
  readonly dateStr?: string;
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
  readonly roomTitle: string;
  readonly destination: string;
  readonly periodText: string;
  readonly isConfirmed: boolean;
  readonly confirmedPlanId?: string;
  readonly confirmedPlanTitle?: string;
  readonly nights: number;
  readonly days: number;
  readonly route: ReadonlyArray<CityStay>;
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
  const match = /^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/.exec(dateStr.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    Number.isNaN(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }
  return { year, month, day };
}

export function addDaysToYMD(ymd: YMD, days: number): YMD {
  const d = new Date(ymd.year, ymd.month - 1, ymd.day);
  d.setDate(d.getDate() + days);
  return {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
  };
}

export function formatKoreanDate(ymd: YMD): string {
  return `${ymd.month}월 ${ymd.day}일`;
}

export function formatDotDate(ymd: YMD, includeYear = false): string {
  if (includeYear) {
    return `${ymd.year}.${ymd.month}.${ymd.day}`;
  }
  return `${ymd.month}.${ymd.day}`;
}

export function formatPeriodText(startDateStr?: string, endDateStr?: string): string {
  const start = parseYMD(startDateStr);
  const end = parseYMD(endDateStr);
  if (!start && !end) return "일정 미정";
  if (start && !end) return `${formatDotDate(start)} ~`;
  if (!start && end) return `~ ${formatDotDate(end)}`;
  if (start && end) {
    if (start.year !== end.year) {
      return `${formatDotDate(start, true)} ~ ${formatDotDate(end, true)}`;
    }
    return `${formatDotDate(start)} ~ ${formatDotDate(end)}`;
  }
  return "일정 미정";
}

export function getStayStatusBadge(status: ItineraryStatus): {
  readonly label: string;
  readonly color: "green" | "yellow" | "red" | "elephant";
} {
  switch (status) {
    case "AVAILABLE":
      return { label: "예약 완료", color: "green" };
    case "NEED_CHECK":
      return { label: "확인 필요", color: "yellow" };
    case "FULL":
      return { label: "만실", color: "red" };
    case "SEARCHING":
    default:
      return { label: "확인 전", color: "elephant" };
  }
}

export function getTransportStatusBadge(status: ItineraryStatus): {
  readonly label: string;
  readonly color: "green" | "yellow" | "red" | "elephant";
} {
  switch (status) {
    case "AVAILABLE":
      return { label: "예매 가능", color: "green" };
    case "NEED_CHECK":
      return { label: "확인 필요", color: "yellow" };
    case "FULL":
      return { label: "매진", color: "red" };
    case "SEARCHING":
    default:
      return { label: "확인 전", color: "elephant" };
  }
}

export function toItineraryViewModel(
  room: TripRoom,
  _currentUserId?: string
): ItineraryViewModel {
  const isConfirmed = Boolean(room.confirmedPlanId);
  const confirmedPlan: TripPlan | undefined = room.confirmedPlanId
    ? room.plans.find((p) => p.id === room.confirmedPlanId)
    : undefined;

  const periodText = formatPeriodText(room.startDate, room.endDate);

  if (!isConfirmed || !confirmedPlan) {
    return {
      tripId: room.id,
      roomTitle: room.title,
      destination: room.destination,
      periodText,
      isConfirmed: false,
      confirmedPlanId: undefined,
      confirmedPlanTitle: undefined,
      nights: 0,
      days: 0,
      route: [],
      differenceSummary: undefined,
      needCheckCount: 0,
      hasNeedCheckDanger: false,
      needCheckItems: [],
      sections: [],
    };
  }

  const authorName =
    confirmedPlan.authorName ??
    room.members.find((m) => m.id === confirmedPlan.authorId)?.name ??
    (room.members[0]?.name ?? "작성자");
  const headcount =
    confirmedPlan.baseHeadcount ?? (room.members.length > 0 ? room.members.length : 1);

  const route: ReadonlyArray<CityStay> =
    confirmedPlan.routes && confirmedPlan.routes.length > 0
      ? confirmedPlan.routes
      : confirmedPlan.places.length > 0
        ? confirmedPlan.places.slice(0, 3).map((place, pIdx) => ({
            city: place.name.split(" ")[0] || room.destination,
            nights: pIdx === 0 ? 1 : 2,
          }))
        : [{ city: room.destination, nights: 1 }];

  const nights = route.reduce((acc, curr) => acc + curr.nights, 0) || 1;
  const days = nights + 1;

  const accommodations = confirmedPlan.accommodations ?? [];
  const transports = confirmedPlan.transports ?? [];

  // 1. 확인 필요 항목 집계 (Need-Check)
  const needCheckItems: ItineraryNeedCheckItem[] = [];

  for (const acc of accommodations) {
    const isUnchecked = acc.bookingStatus === "NOT_CHECKED" || acc.isSearching;
    const isFull = acc.bookingStatus === "FULL";
    const isNeedCheck = acc.bookingStatus === "NEED_CHECK";

    if (isFull || isNeedCheck || isUnchecked) {
      const status: "FULL" | "NEED_CHECK" | "SEARCHING" = isFull
        ? "FULL"
        : isUnchecked
          ? "SEARCHING"
          : "NEED_CHECK";
      const statusBadge = getStayStatusBadge(status);
      const statusColor: "yellow" | "red" | "elephant" =
        status === "FULL" ? "red" : status === "NEED_CHECK" ? "yellow" : "elephant";
      const message = isFull
        ? `${acc.city} 숙소(${acc.hotelName})가 현재 만실 상태예요`
        : isUnchecked
          ? `${acc.city} 숙소(${acc.hotelName}) 예약 상태를 아직 확인하지 않았어요`
          : `${acc.city} 숙소(${acc.hotelName}) 잔여 객실 확인이 필요해요`;

      needCheckItems.push({
        id: `need-check-stay-${acc.id}`,
        itemType: "STAY",
        title: acc.hotelName,
        message,
        snapshotInfo: isUnchecked
          ? "아직 예약 상태를 확인하지 않았어요"
          : `${acc.confirmedBy ?? authorName} · ${acc.confirmedAt ?? "최근"} 확인`,
        status,
        statusLabel: statusBadge.label,
        statusColor,
        dateText: acc.city,
      });
    }
  }

  for (const trans of transports) {
    const isUnchecked = trans.bookingStatus === "NOT_CHECKED";
    const isFull = trans.bookingStatus === "FULL";
    const isNeedCheck = trans.bookingStatus === "NEED_CHECK";

    if (isFull || isNeedCheck || isUnchecked) {
      const status: "FULL" | "NEED_CHECK" | "SEARCHING" = isFull
        ? "FULL"
        : isUnchecked
          ? "SEARCHING"
          : "NEED_CHECK";
      const statusBadge = getTransportStatusBadge(status);
      const statusColor: "yellow" | "red" | "elephant" =
        status === "FULL" ? "red" : status === "NEED_CHECK" ? "yellow" : "elephant";
      const message = isFull
        ? `${trans.fromCity} → ${trans.toCity} 교통편이 매진/불가 상태예요`
        : isUnchecked
          ? `${trans.fromCity} → ${trans.toCity} 교통 예약 상태를 아직 확인하지 않았어요`
          : `${trans.fromCity} → ${trans.toCity} 교통 예약 확인이 필요해요`;

      needCheckItems.push({
        id: `need-check-trans-${trans.id}`,
        itemType: "TRANSPORT",
        title: `${trans.fromCity} → ${trans.toCity}`,
        message,
        snapshotInfo: isUnchecked
          ? "아직 예약 상태를 확인하지 않았어요"
          : `${trans.confirmedBy ?? authorName} · ${trans.confirmedAt ?? "최근"} 확인`,
        status,
        statusLabel: statusBadge.label,
        statusColor,
        dateText: `${trans.fromCity} → ${trans.toCity}`,
      });
    }
  }

  // 2. 날짜별 섹션 생성 (Date Sections)
  const sections: ItineraryDateSection[] = [];
  const startYMD = parseYMD(room.startDate);
  let currentYMD: YMD | undefined = startYMD ?? undefined;
  let currentDay = 1;

  const maxLen = Math.max(accommodations.length, transports.length);

  for (let i = 0; i < maxLen; i++) {
    const acc = accommodations[i];
    if (acc) {
      const stayStartYMD = currentYMD;
      const stayNights = acc.nights || 1;
      const stayEndYMD = currentYMD ? addDaysToYMD(currentYMD, stayNights) : undefined;
      const stayStatus: ItineraryStatus =
        acc.bookingStatus === "NOT_CHECKED" || acc.isSearching
          ? "SEARCHING"
          : acc.bookingStatus;

      const statusBadge = getStayStatusBadge(stayStatus);
      const priceText = acc.priceRange
        ? `그룹 총액 ${formatCostRangeText(acc.priceRange.min, acc.priceRange.max)} (${headcount}명 기준)`
        : "가격 미정";
      const subText = `${stayNights}박 · ${statusBadge.label}`;
      const itemPeriodText =
        stayStartYMD && stayEndYMD
          ? `${formatDotDate(stayStartYMD)} ~ ${formatDotDate(stayEndYMD)}`
          : acc.period;

      const dateHeader = stayStartYMD
        ? `${formatKoreanDate(stayStartYMD)} · ${acc.city}`
        : `Day ${currentDay} · ${acc.city}`;

      const stayItem: ItineraryStayItem = {
        type: "STAY",
        id: acc.id || `stay-${i}`,
        city: acc.city,
        hotelName: acc.hotelName,
        period: acc.period,
        periodText: itemPeriodText,
        nights: stayNights,
        priceText,
        bookingStatus: stayStatus,
        statusLabel: statusBadge.label,
        statusColor: statusBadge.color,
        confirmedInfo: `${acc.confirmedBy ?? authorName} · ${acc.confirmedAt ?? "최근 확인"}`,
        bookingUrl: acc.bookingUrl,
        subText,
      };

      sections.push({
        id: `section-stay-${acc.id || i}`,
        dateHeader,
        dateStr: stayStartYMD
          ? `${stayStartYMD.year}-${String(stayStartYMD.month).padStart(2, "0")}-${String(stayStartYMD.day).padStart(2, "0")}`
          : undefined,
        items: [stayItem],
      });

      currentDay += stayNights;
      currentYMD = stayEndYMD;
    }

    const trans = transports[i];
    if (trans) {
      const transYMD = currentYMD;
      const transStatus: ItineraryStatus =
        trans.bookingStatus === "NOT_CHECKED" ? "SEARCHING" : trans.bookingStatus;
      const statusBadge = getTransportStatusBadge(transStatus);
      const priceText = trans.priceRange
        ? `그룹 총액 ${formatCostRangeText(trans.priceRange.min, trans.priceRange.max)}`
        : "가격 미정";
      const subText = `${trans.mode} · ${statusBadge.label}`;
      const routeTitle = `${trans.fromCity} → ${trans.toCity}`;

      const dateHeader = transYMD
        ? `${formatKoreanDate(transYMD)} · 이동`
        : "이동";

      const transItem: ItineraryTransportItem = {
        type: "TRANSPORT",
        id: trans.id || `trans-${i}`,
        fromCity: trans.fromCity,
        toCity: trans.toCity,
        routeTitle,
        mode: trans.mode,
        hasTransfer: trans.hasTransfer,
        durationText: trans.durationText,
        priceText,
        bookingStatus: transStatus,
        statusLabel: statusBadge.label,
        statusColor: statusBadge.color,
        confirmedInfo: `${trans.confirmedBy ?? authorName} · ${trans.confirmedAt ?? "최근 확인"}`,
        bookingUrl: trans.bookingUrl,
        subText,
      };

      sections.push({
        id: `section-trans-${trans.id || i}`,
        dateHeader,
        dateStr: transYMD
          ? `${transYMD.year}-${String(transYMD.month).padStart(2, "0")}-${String(transYMD.day).padStart(2, "0")}`
          : undefined,
        items: [transItem],
      });
    }
  }

  return {
    tripId: room.id,
    roomTitle: room.title,
    destination: room.destination,
    periodText,
    isConfirmed: true,
    confirmedPlanId: confirmedPlan.id,
    confirmedPlanTitle: confirmedPlan.title,
    nights,
    days,
    route,
    differenceSummary: confirmedPlan.differenceSummary,
    needCheckCount: needCheckItems.length,
    hasNeedCheckDanger: needCheckItems.some((item) => item.status === "FULL"),
    needCheckItems,
    sections,
  };
}
