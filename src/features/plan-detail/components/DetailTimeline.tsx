import { css } from "@emotion/react";
import { Badge, List, ListRow, Text } from "@toss/tds-mobile";

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

const contentsStyle = css`
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const linkStyle = css`
  width: fit-content;
  margin-top: 4px;
  color: var(--adaptiveBlue500, #3182f6);
  font-size: 12px;
  font-weight: 600;
  text-decoration: none;
`;

type StatusBadge = {
  readonly label: string;
  readonly color: "green" | "red" | "yellow" | "elephant";
};

const getStatusBadge = (status: string): StatusBadge => {
  switch (status) {
    case "AVAILABLE":
      return { label: "예약 가능", color: "green" };
    case "FULL":
      return { label: "만실", color: "red" };
    case "NEED_CHECK":
      return { label: "확인 필요", color: "yellow" };
    default:
      return { label: "아직 확인 전", color: "elephant" };
  }
};

export function DetailTimeline({ items }: DetailTimelineProps) {
  if (items.length === 0) {
    return (
      <List aria-label="숙소와 교통 상세">
        <ListRow
          border="none"
          verticalPadding="medium"
          horizontalPadding="small"
          contents={
            <Text typography="t6" color="var(--adaptiveGrey600, #6b7684)">
              숙소·교통 정보가 아직 등록되지 않았어요.
            </Text>
          }
        />
      </List>
    );
  }

  return (
    <List aria-label="숙소와 교통 상세">
      {items.map((item, index) => {
        if (item.type === "STAY" && item.stay) {
          const stay = item.stay;
          const status = getStatusBadge(stay.bookingStatus);

          return (
            <ListRow
              key={stay.id || index}
              border="indented"
              verticalPadding="medium"
              horizontalPadding="small"
              left={<Badge size="small" variant="weak" color="blue">숙소</Badge>}
              right={<Badge size="small" variant="weak" color={status.color}>{status.label}</Badge>}
              contents={
                <div css={contentsStyle}>
                  <Text typography="t6" fontWeight="bold" color="var(--adaptiveGrey900, #191f28)">
                    {stay.city} · {stay.period} · {stay.nights}박
                  </Text>
                  <Text typography="t6" fontWeight="bold" color="var(--adaptiveGrey800, #333d4b)">
                    {stay.hotelName}
                  </Text>
                  <Text typography="t7" color="var(--adaptiveGrey700, #4e5968)">
                    {stay.priceText}
                  </Text>
                  <Text typography="t7" color="var(--adaptiveGrey500, #8b95a1)">
                    {stay.confirmedInfo}
                  </Text>
                  {stay.bookingUrl && (
                    <a href={stay.bookingUrl} target="_blank" rel="noreferrer" css={linkStyle}>
                      예약 정보 보기 ↗
                    </a>
                  )}
                </div>
              }
            />
          );
        }

        if (item.type === "TRANSPORT" && item.transport) {
          const transport = item.transport;
          const status = getStatusBadge(transport.bookingStatus);

          return (
            <ListRow
              key={transport.id || index}
              border="indented"
              verticalPadding="medium"
              horizontalPadding="small"
              left={<Badge size="small" variant="weak" color="elephant">이동</Badge>}
              right={<Badge size="small" variant="weak" color={status.color}>{status.label}</Badge>}
              contents={
                <div css={contentsStyle}>
                  <Text typography="t6" fontWeight="bold" color="var(--adaptiveGrey900, #191f28)">
                    {transport.fromCity} → {transport.toCity}
                  </Text>
                  <Text typography="t7" color="var(--adaptiveGrey700, #4e5968)">
                    {transport.mode} · {transport.hasTransfer ? "환승 필요" : "직통"} · {transport.durationText}
                  </Text>
                  <Text typography="t7" color="var(--adaptiveGrey700, #4e5968)">
                    {transport.priceText}
                  </Text>
                  <Text typography="t7" color="var(--adaptiveGrey500, #8b95a1)">
                    {transport.confirmedInfo}
                  </Text>
                  {transport.bookingUrl && (
                    <a href={transport.bookingUrl} target="_blank" rel="noreferrer" css={linkStyle}>
                      교통 정보 보기 ↗
                    </a>
                  )}
                </div>
              }
            />
          );
        }

        return null;
      })}
    </List>
  );
}
