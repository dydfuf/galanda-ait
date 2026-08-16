import { css } from "@emotion/react";

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
  readonly bookingStatus: "AVAILABLE" | "NEED_CHECK" | "SEARCHING";
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

const listContainerStyle = css`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const stayCardStyle = css`
  background-color: var(--adaptiveBackground, #ffffff);
  border-radius: 14px;
  padding: 16px 18px;
  border: 1px solid var(--adaptiveGrey200, #e5e8eb);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.03);
`;

const stayHeaderStyle = css`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
`;

const stayLocationStyle = css`
  font-size: 13px;
  font-weight: 700;
  color: var(--adaptiveBlue500, #3182f6);
`;

const badgeStyle = (bg: string, color: string) => css`
  font-size: 11px;
  font-weight: 600;
  padding: 3px 6px;
  border-radius: 4px;
  background-color: ${bg};
  color: ${color};
`;

const stayHotelNameStyle = css`
  font-size: 16px;
  font-weight: 700;
  color: var(--adaptiveGrey900, #191f28);
  margin: 0 0 6px 0;
`;

const stayPriceTextStyle = css`
  font-size: 13px;
  color: var(--adaptiveGrey800, #333d4b);
  font-weight: 600;
  margin: 0 0 4px 0;
`;

const stayFooterStyle = css`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid var(--adaptiveGrey100, #f2f4f6);
`;

const stayConfirmedInfoStyle = css`
  font-size: 11px;
  color: var(--adaptiveGrey500, #8b95a1);
`;

const stayLinkStyle = css`
  font-size: 12px;
  color: var(--adaptiveBlue500, #3182f6);
  text-decoration: none;
  font-weight: 600;

  &:hover {
    text-decoration: underline;
  }
`;

const transportCardStyle = css`
  background-color: var(--adaptiveGrey50, #f9fafb);
  border-radius: 12px;
  padding: 12px 16px;
  border: 1px dashed var(--adaptiveGrey300, #d1d6db);
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const transportHeaderStyle = css`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const transportTitleStyle = css`
  font-size: 12px;
  font-weight: 700;
  color: var(--adaptiveGrey700, #4e5968);
`;

const transportBadgeStyle = (bg: string, color: string) => css`
  font-size: 11px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  background-color: ${bg};
  color: ${color};
`;

const transportBodyStyle = css`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
`;

const transportModeStyle = css`
  color: var(--adaptiveGrey900, #191f28);
  font-weight: 600;
`;

const transportPriceStyle = css`
  font-weight: 600;
  color: var(--adaptiveGrey800, #333d4b);
`;

const transportFooterStyle = css`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 4px;
`;

const transportConfirmedInfoStyle = css`
  font-size: 11px;
  color: var(--adaptiveGrey500, #8b95a1);
`;

const transportLinkStyle = css`
  font-size: 11px;
  color: var(--adaptiveBlue500, #3182f6);
  text-decoration: none;
  font-weight: 600;

  &:hover {
    text-decoration: underline;
  }
`;

export function DetailTimeline({ items }: DetailTimelineProps) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "AVAILABLE":
        return { label: "예약 가능", bg: "var(--adaptiveGreen50, #f0fbf4)", color: "var(--adaptiveGreen600, #15803d)" };
      case "FULL":
        return { label: "만실", bg: "var(--adaptiveRed50, #fdf2f3)", color: "var(--adaptiveRed600, #e0383e)" };
      case "NEED_CHECK":
        return { label: "확인 필요", bg: "var(--adaptiveYellow50, #fff8e1)", color: "var(--adaptiveYellow600, #b78103)" };
      case "SEARCHING":
      default:
        return { label: "찾는 중", bg: "var(--adaptiveGrey100, #f2f4f6)", color: "var(--adaptiveGrey600, #6b7684)" };
    }
  };

  return (
    <div css={listContainerStyle}>
      {items.map((item, idx) => {
        if (item.type === "STAY" && item.stay) {
          const stay = item.stay;
          const badge = getStatusBadge(stay.bookingStatus);

          return (
            <div key={stay.id || idx} css={stayCardStyle}>
              {/* 체류 헤더 */}
              <div css={stayHeaderStyle}>
                <span css={stayLocationStyle}>
                  📍 {stay.city} ({stay.period} · {stay.nights}박)
                </span>
                <span css={badgeStyle(badge.bg, badge.color)}>
                  {badge.label}
                </span>
              </div>

              {/* 숙소명 */}
              <h4 css={stayHotelNameStyle}>
                {stay.hotelName}
              </h4>

              {/* 가격 및 기준 */}
              <p css={stayPriceTextStyle}>
                {stay.priceText}
              </p>

              {/* 확인자 정보 및 외부 링크 */}
              <div css={stayFooterStyle}>
                <span css={stayConfirmedInfoStyle}>
                  {stay.confirmedInfo}
                </span>

                {stay.bookingUrl && (
                  <a
                    href={stay.bookingUrl}
                    target="_blank"
                    rel="noreferrer"
                    css={stayLinkStyle}
                  >
                    예약 정보 보기 ↗
                  </a>
                )}
              </div>
            </div>
          );
        }

        if (item.type === "TRANSPORT" && item.transport) {
          const transport = item.transport;
          const badge = getStatusBadge(transport.bookingStatus);

          return (
            <div key={transport.id || idx} css={transportCardStyle}>
              <div css={transportHeaderStyle}>
                <span css={transportTitleStyle}>
                  🚆 이동: {transport.fromCity} → {transport.toCity}
                </span>
                <span css={transportBadgeStyle(badge.bg, badge.color)}>
                  {badge.label}
                </span>
              </div>

              <div css={transportBodyStyle}>
                <span css={transportModeStyle}>
                  {transport.mode} · {transport.hasTransfer ? "환승 필요" : "직통"} ({transport.durationText})
                </span>
                <span css={transportPriceStyle}>
                  {transport.priceText}
                </span>
              </div>

              <div css={transportFooterStyle}>
                <span css={transportConfirmedInfoStyle}>
                  {transport.confirmedInfo}
                </span>
                {transport.bookingUrl && (
                  <a
                    href={transport.bookingUrl}
                    target="_blank"
                    rel="noreferrer"
                    css={transportLinkStyle}
                  >
                    교통편 보기 ↗
                  </a>
                )}
              </div>
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}
