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

  // 2. 날짜별 섹션 생성 (Chronological Timeline Scheduling)
  const startYMD = parseYMD(room.startDate);
  const normalize = (s?: string) => (s ? s.trim().toLowerCase().replace(/\s+/g, "") : "");

  interface ScheduledStay {
    readonly acc: (typeof accommodations)[number];
    readonly index: number;
    readonly startYMD?: YMD;
    readonly endYMD?: YMD;
    readonly startDay: number;
    readonly endDay: number;
    readonly orderKey: number;
  }

  const scheduledStays: ScheduledStay[] = [];
  let currentStayYMD: YMD | undefined = startYMD ?? undefined;
  let currentDay = 1;

  for (let i = 0; i < accommodations.length; i++) {
    const acc = accommodations[i];
    const stayNights = acc.nights || 1;
    const stayStartYMD = currentStayYMD;
    const stayEndYMD = currentStayYMD ? addDaysToYMD(currentStayYMD, stayNights) : undefined;
    const startDay = currentDay;
    const endDay = currentDay + stayNights;
    const orderKey = i * 10 + 5; // e.g., 5, 15, 25...

    scheduledStays.push({
      acc,
      index: i,
      startYMD: stayStartYMD,
      endYMD: stayEndYMD,
      startDay,
      endDay,
      orderKey,
    });

    currentStayYMD = stayEndYMD;
    currentDay = endDay;
  }

  interface TimelineEvent {
    readonly orderKey: number;
    readonly type: "STAY" | "TRANSPORT";
    readonly stayItem?: ItineraryStayItem;
    readonly transItem?: ItineraryTransportItem;
    readonly dateHeader: string;
    readonly dateStr?: string;
    readonly id: string;
  }

  const events: TimelineEvent[] = [];

  // 숙소 이벤트 등록
  for (const stay of scheduledStays) {
    const acc = stay.acc;
    const stayStatus: ItineraryStatus =
      acc.bookingStatus === "NOT_CHECKED" || acc.isSearching
        ? "SEARCHING"
        : acc.bookingStatus;
    const statusBadge = getStayStatusBadge(stayStatus);
    const priceText = acc.priceRange
      ? `그룹 총액 ${formatCostRangeText(acc.priceRange.min, acc.priceRange.max)} (${headcount}명 기준)`
      : "가격 미정";
    const subText = `${stay.acc.nights || 1}박 · ${statusBadge.label}`;
    const itemPeriodText =
      stay.startYMD && stay.endYMD
        ? `${formatDotDate(stay.startYMD)} ~ ${formatDotDate(stay.endYMD)}`
        : acc.period;
    const dateHeader = stay.startYMD
      ? `${formatKoreanDate(stay.startYMD)} · ${acc.city}`
      : `Day ${stay.startDay} · ${acc.city}`;

    const stayItem: ItineraryStayItem = {
      type: "STAY",
      id: acc.id || `stay-${stay.index}`,
      city: acc.city,
      hotelName: acc.hotelName,
      period: acc.period,
      periodText: itemPeriodText,
      nights: stay.acc.nights || 1,
      priceText,
      bookingStatus: stayStatus,
      statusLabel: statusBadge.label,
      statusColor: statusBadge.color,
      confirmedInfo: `${acc.confirmedBy ?? authorName} · ${acc.confirmedAt ?? "최근 확인"}`,
      bookingUrl: acc.bookingUrl,
      subText,
    };

    events.push({
      orderKey: stay.orderKey,
      type: "STAY",
      stayItem,
      dateHeader,
      dateStr: stay.startYMD
        ? `${stay.startYMD.year}-${String(stay.startYMD.month).padStart(2, "0")}-${String(stay.startYMD.day).padStart(2, "0")}`
        : undefined,
      id: `section-stay-${acc.id || stay.index}`,
    });
  }

  // 교통편 이벤트 등록 (독립적 시간순 배치)
  for (let j = 0; j < transports.length; j++) {
    const trans = transports[j];
    const fromCity = normalize(trans.fromCity);
    const toCity = normalize(trans.toCity);

    let transOrderKey: number;
    let transYMD: YMD | undefined;
    let transDay: number | undefined;

    if (scheduledStays.length === 0) {
      transYMD = startYMD ? (j === 0 ? startYMD : addDaysToYMD(startYMD, j)) : undefined;
      transDay = j + 1;
      transOrderKey = j * 10;
    } else {
      const firstStay = scheduledStays[0];
      const lastStay = scheduledStays[scheduledStays.length - 1];

      // 1) 인바운드 이동 (첫 숙소 도착 전)
      const isInbound =
        j === 0 &&
        toCity === normalize(firstStay.acc.city) &&
        fromCity !== normalize(firstStay.acc.city);

      // 2) 도시 간 이동 (숙소 k -> 숙소 k+1)
      let transferMatchIndex = -1;
      for (let k = 0; k < scheduledStays.length - 1; k++) {
        const currentStayCity = normalize(scheduledStays[k].acc.city);
        const nextStayCity = normalize(scheduledStays[k + 1].acc.city);
        if (fromCity === currentStayCity && toCity === nextStayCity) {
          transferMatchIndex = k;
          break;
        }
      }

      if (isInbound) {
        transYMD = firstStay.startYMD;
        transDay = firstStay.startDay;
        transOrderKey = firstStay.orderKey - 2 + j * 0.01;
      } else if (transferMatchIndex !== -1) {
        const stayK = scheduledStays[transferMatchIndex];
        transYMD = stayK.endYMD;
        transDay = stayK.endDay;
        transOrderKey = stayK.orderKey + 2 + j * 0.01;
      } else if (
        fromCity === normalize(lastStay.acc.city) &&
        toCity !== normalize(lastStay.acc.city)
      ) {
        // 3) 아웃바운드 이동 (마지막 숙소 체크아웃 후)
        transYMD = lastStay.endYMD;
        transDay = lastStay.endDay;
        transOrderKey = lastStay.orderKey + 2 + j * 0.01;
      } else {
        // 4) 도시 매칭 폴백
        const fromStayIdx = scheduledStays.findIndex(
          (s) => normalize(s.acc.city) === fromCity
        );
        const toStayIdx = scheduledStays.findIndex(
          (s) => normalize(s.acc.city) === toCity
        );

        if (fromStayIdx !== -1) {
          const stayFrom = scheduledStays[fromStayIdx];
          transYMD = stayFrom.endYMD;
          transDay = stayFrom.endDay;
          transOrderKey = stayFrom.orderKey + 2 + j * 0.01;
        } else if (toStayIdx !== -1) {
          const stayTo = scheduledStays[toStayIdx];
          transYMD = stayTo.startYMD;
          transDay = stayTo.startDay;
          transOrderKey = stayTo.orderKey - 2 + j * 0.01;
        } else {
          // 5) 순서 기반 fallback
          if (j === 0 && transports.length > scheduledStays.length) {
            transYMD = firstStay.startYMD;
            transDay = firstStay.startDay;
            transOrderKey = firstStay.orderKey - 2 + j * 0.01;
          } else {
            const targetIdx = Math.min(j, scheduledStays.length - 1);
            const targetStay = scheduledStays[targetIdx];
            transYMD = targetStay.endYMD;
            transDay = targetStay.endDay;
            transOrderKey = targetStay.orderKey + 2 + j * 0.01;
          }
        }
      }
    }

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
      : transDay
        ? `Day ${transDay} · 이동`
        : "이동";

    const transItem: ItineraryTransportItem = {
      type: "TRANSPORT",
      id: trans.id || `trans-${j}`,
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

    events.push({
      orderKey: transOrderKey,
      type: "TRANSPORT",
      transItem,
      dateHeader,
      dateStr: transYMD
        ? `${transYMD.year}-${String(transYMD.month).padStart(2, "0")}-${String(transYMD.day).padStart(2, "0")}`
        : undefined,
      id: `section-trans-${trans.id || j}`,
    });
  }

  // 3. 시간 순서대로 정렬 후 섹션 생성
  events.sort((a, b) => a.orderKey - b.orderKey);

  const sections: ItineraryDateSection[] = events.map((event) => ({
    id: event.id,
    dateHeader: event.dateHeader,
    dateStr: event.dateStr,
    items:
      event.type === "STAY" && event.stayItem
        ? [event.stayItem]
        : event.transItem
          ? [event.transItem]
          : [],
  }));

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
