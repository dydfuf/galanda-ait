import { Badge } from "@/components/ui/badge.tsx";
import { ItemDescription, ItemTitle } from "@/components/ui/item.tsx";
import { MobileList, MobileListItem } from "@/components/galanda/mobile-list.tsx";
import { ExternalLink } from "@/components/galanda/external-link.tsx";
import { PlanningIcon } from "@/components/galanda/planning-icon.tsx";

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

const getStatusBadge = (status: StaySection["bookingStatus"]): StatusBadge => {
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
      <MobileList aria-label="숙소와 교통 상세" className="bg-surface-content">
        <MobileListItem>
          <p className="text-base leading-relaxed text-muted-foreground">
            숙소·교통 정보가 아직 등록되지 않았어요.
          </p>
        </MobileListItem>
      </MobileList>
    );
  }

  return (
    <MobileList aria-label="숙소와 교통 상세" className="bg-surface-content">
      {items.map((item) => {
        if (item.type === "STAY" && item.stay) {
          const stay = item.stay;
          const status = getStatusBadge(stay.bookingStatus);

          return (
            <MobileListItem
              key={stay.id}
              leading={
                <div className="flex flex-col items-center gap-1 text-primary">
                  <PlanningIcon name="stay" size={20} />
                  <Badge variant="info">숙소</Badge>
                </div>
              }
              trailing={<Badge variant={status.variant}>{status.label}</Badge>}
            >
              <ItemTitle>
                {stay.city} · {stay.period} ·{" "}
                {stay.nights > 0 ? `${stay.nights}박` : "숙박 수 미정"}
              </ItemTitle>
              <ItemTitle className="text-base text-secondary-foreground">
                {stay.hotelName}
              </ItemTitle>
              <ItemDescription className="text-base">
                {stay.priceText}
              </ItemDescription>
              <ItemDescription className="text-sm text-muted-foreground">
                {stay.confirmedInfo}
              </ItemDescription>
              {stay.bookingUrl && (
                <ExternalLink
                  href={stay.bookingUrl}
                  className="mt-1 inline-flex max-w-full items-start gap-1.5 [overflow-wrap:anywhere]"
                >
                  <PlanningIcon name="ticket" size={20} />
                  <span className="min-w-0">예약 정보 보기</span>
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
              key={transport.id}
              leading={
                <div className="flex flex-col items-center gap-1 text-muted-foreground">
                  <PlanningIcon name="route" size={20} />
                  <Badge variant="neutral">이동</Badge>
                </div>
              }
              trailing={<Badge variant={status.variant}>{status.label}</Badge>}
            >
              <ItemTitle>
                {transport.fromCity} → {transport.toCity}
              </ItemTitle>
              <ItemDescription className="text-base">
                {transport.mode} ·{" "}
                {transport.hasTransfer ? "환승 필요" : "직통"} ·{" "}
                {transport.durationText}
              </ItemDescription>
              <ItemDescription className="text-base">
                {transport.priceText}
              </ItemDescription>
              <ItemDescription className="text-sm text-muted-foreground">
                {transport.confirmedInfo}
              </ItemDescription>
              {transport.bookingUrl && (
                <ExternalLink
                  href={transport.bookingUrl}
                  className="mt-1 inline-flex max-w-full items-start gap-1.5 [overflow-wrap:anywhere]"
                >
                  <PlanningIcon name="ticket" size={20} />
                  <span className="min-w-0">교통 정보 보기</span>
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
