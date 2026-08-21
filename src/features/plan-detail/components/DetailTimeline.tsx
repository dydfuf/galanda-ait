import { Badge } from "@/components/ui/badge.tsx";
import { ItemDescription, ItemTitle } from "@/components/ui/item.tsx";
import { MobileList, MobileListItem } from "@/components/galanda/mobile-list.tsx";
import { ExternalLink } from "@/components/galanda/external-link.tsx";

export interface StaySection {
  readonly id: string;
  readonly city: string;
  readonly period: string;
  readonly nights: number;
  readonly hotelName: string;
  readonly priceText: string;
  readonly bookingStatus: "AVAILABLE" | "NEED_CHECK" | "FULL" | "SEARCHING";
  readonly confirmedInfo: string;
  readonly bookingUrl?: string;
}

export interface TransportSection {
  readonly id: string;
  readonly fromCity: string;
  readonly toCity: string;
  readonly mode: string;
  readonly hasTransfer: boolean;
  readonly durationText: string;
  readonly priceText: string;
  readonly bookingStatus: "AVAILABLE" | "NEED_CHECK" | "FULL" | "SEARCHING";
  readonly confirmedInfo: string;
  readonly bookingUrl?: string;
}

export interface TimelineItem {
  readonly type: "STAY" | "TRANSPORT";
  readonly stay?: StaySection;
  readonly transport?: TransportSection;
}

interface DetailTimelineProps {
  readonly items: ReadonlyArray<TimelineItem>;
}

type StatusBadge = {
  readonly label: string;
  readonly variant: "success" | "danger" | "warning" | "neutral";
};

const getStatusBadge = (status: string): StatusBadge => {
  switch (status) {
    case "AVAILABLE":
      return { label: "예약 가능", variant: "success" };
    case "FULL":
      return { label: "만실", variant: "danger" };
    case "NEED_CHECK":
      return { label: "확인 필요", variant: "warning" };
    default:
      return { label: "아직 확인 전", variant: "neutral" };
  }
};

export function DetailTimeline({ items }: DetailTimelineProps) {
  if (items.length === 0) {
    return (
      <MobileList aria-label="숙소와 교통 상세">
        <MobileListItem>
          <p className="text-[15px] text-muted-foreground">
            숙소·교통 정보가 아직 등록되지 않았어요.
          </p>
        </MobileListItem>
      </MobileList>
    );
  }

  return (
    <MobileList aria-label="숙소와 교통 상세">
      {items.map((item, index) => {
        if (item.type === "STAY" && item.stay) {
          const stay = item.stay;
          const status = getStatusBadge(stay.bookingStatus);

          return (
            <MobileListItem
              key={stay.id || index}
              leading={<Badge variant="info">숙소</Badge>}
              trailing={<Badge variant={status.variant}>{status.label}</Badge>}
            >
              <ItemTitle>
                {stay.city} · {stay.period} · {stay.nights}박
              </ItemTitle>
              <ItemTitle className="text-[14px] text-secondary-foreground">
                {stay.hotelName}
              </ItemTitle>
              <ItemDescription>{stay.priceText}</ItemDescription>
              <ItemDescription className="text-muted-foreground/80">
                {stay.confirmedInfo}
              </ItemDescription>
              {stay.bookingUrl && (
                <ExternalLink href={stay.bookingUrl} className="mt-1">
                  예약 정보 보기 ↗
                </ExternalLink>
              )}
            </MobileListItem>
          );
        }

        if (item.type === "TRANSPORT" && item.transport) {
          const transport = item.transport;
          const status = getStatusBadge(transport.bookingStatus);

          return (
            <MobileListItem
              key={transport.id || index}
              leading={<Badge variant="neutral">이동</Badge>}
              trailing={<Badge variant={status.variant}>{status.label}</Badge>}
            >
              <ItemTitle>
                {transport.fromCity} → {transport.toCity}
              </ItemTitle>
              <ItemDescription>
                {transport.mode} · {transport.hasTransfer ? "환승 필요" : "직통"} ·{" "}
                {transport.durationText}
              </ItemDescription>
              <ItemDescription>{transport.priceText}</ItemDescription>
              <ItemDescription className="text-muted-foreground/80">
                {transport.confirmedInfo}
              </ItemDescription>
              {transport.bookingUrl && (
                <ExternalLink href={transport.bookingUrl} className="mt-1">
                  교통 정보 보기 ↗
                </ExternalLink>
              )}
            </MobileListItem>
          );
        }

        return null;
      })}
    </MobileList>
  );
}
