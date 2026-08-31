import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge.tsx";
import { getExploreThemeLabel } from "@/core/domain/explore-theme.ts";
import type { ExploreListingItem } from "../../../contracts/explore.ts";

/**
 * Explore listing focused detail 본문 (RAON-263 DISC-5).
 *
 * public snapshot의 허용 필드만, allowlist 순서로 렌더링한다:
 *   1. 제목(title) / 목적지(destination)
 *   2. 경로 + 각 구간 날짜(routes with per-stop dates)
 *   3. 기간(date range / duration)
 *   4. sanitized 숙소(stays)
 *   5. sanitized 교통(transports)
 *   6. 작성자 표시명(author)
 *
 * 금지: booking URL/status/price, 확정자, private trip/plan/place/participant ID,
 * member opinion, HARD reason, proposal/draft, differenceSummary, fake
 * popularity/image/count. snapshot에는 이 필드들이 애초에 없으므로 구조적으로도
 * 노출 불가능하다.
 *
 * action(save/import 등)은 이 presentational 본문이 소유하지 않는다. 호출자가
 * 별도 `action` slot으로 주입하며, action이 없으면 slot DOM 자체를 렌더하지
 * 않는다(dead CTA 금지).
 */

const formatShortDate = (date: string): string => {
  const match = /^(?:\d{4})-(\d{2})-(\d{2})$/.exec(date);
  return match ? `${Number(match[1])}.${Number(match[2])}` : date;
};

const formatDuration = (
  nightCount: number,
  startDate: string,
  endDate: string
): string => {
  const dayCount = nightCount + 1;
  const period = `${formatShortDate(startDate)} ~ ${formatShortDate(endDate)}`;
  return `${nightCount}박 ${dayCount}일 · ${period}`;
};

const formatStayLabel = (
  stay: ExploreListingItem["snapshot"]["stays"][number]
): string => {
  const nights = `${stay.nights}박`;
  if (stay.isSearching) {
    return `${nights} · 숙소 찾는 중`;
  }
  if (!stay.hotelName) {
    return `${nights} · 숙소 미정`;
  }
  return `${nights} · ${stay.hotelName}`;
};

const formatTransportLabel = (
  transport: ExploreListingItem["snapshot"]["transports"][number]
): string => {
  const parts: string[] = [];
  if (transport.mode.trim()) parts.push(transport.mode.trim());
  if (transport.durationText.trim()) parts.push(transport.durationText.trim());
  parts.push(transport.hasTransfer ? "환승" : "직통");
  return parts.join(" · ");
};

interface ExploreListingDetailContentProps {
  readonly item: ExploreListingItem;
  /**
   * save/import 등 action slot. 준비된 action이 있을 때만 전달한다. 없으면
   * (undefined) slot DOM 자체를 렌더하지 않는다(dead CTA 금지, DISC-6/7에서 채움).
   */
  readonly action?: ReactNode;
}

export function ExploreListingDetailContent({
  item,
  action,
}: ExploreListingDetailContentProps) {
  const { snapshot } = item;
  const durationText = formatDuration(
    snapshot.dateRange.nightCount,
    snapshot.dateRange.startDate,
    snapshot.dateRange.endDate
  );

  return (
    <article
      data-slot="explore-listing-detail"
      className="flex min-w-0 flex-col gap-6 px-(--app-inline-padding)"
    >
      {/* 1. 제목 / 목적지 */}
      <header className="flex min-w-0 flex-col gap-1">
        <h1 className="min-w-0 text-[22px] leading-tight font-bold text-foreground [overflow-wrap:anywhere]">
          {snapshot.title}
        </h1>
        <p className="min-w-0 text-base text-foreground-muted [overflow-wrap:anywhere]">
          <span className="sr-only">목적지</span>
          {snapshot.destination}
        </p>
      </header>

      {(snapshot.themeIds?.length ?? 0) > 0 && (
        <section aria-label="여행 테마" className="flex min-w-0 flex-wrap gap-2">
          {snapshot.themeIds?.map((themeId) => (
            <Badge key={themeId} variant="info">
              {getExploreThemeLabel(themeId)}
            </Badge>
          ))}
        </section>
      )}

      {/* 2. 경로 + 각 구간 날짜 */}
      <section aria-label="경로" className="flex min-w-0 flex-col gap-2">
        <h2 className="text-[15px] font-semibold text-foreground">경로</h2>
        <ol className="flex min-w-0 flex-col gap-1.5">
          {snapshot.routes.map((route, index) => (
            <li
              key={`${route.city}-${route.arrivalDate}-${index}`}
              className="flex min-w-0 flex-col gap-0.5 text-base text-foreground [overflow-wrap:anywhere]"
            >
              <span className="min-w-0 font-medium">{route.city}</span>
              <span className="min-w-0 text-sm text-foreground-muted">
                {formatShortDate(route.arrivalDate)} ~{" "}
                {formatShortDate(route.departureDate)}
              </span>
            </li>
          ))}
        </ol>
      </section>

      {/* 3. 기간 */}
      <section aria-label="기간" className="flex min-w-0 flex-col gap-1">
        <h2 className="text-[15px] font-semibold text-foreground">기간</h2>
        <p className="min-w-0 text-base text-foreground-muted [overflow-wrap:anywhere]">
          {durationText}
        </p>
      </section>

      {/* 4. 숙소 (sanitized) */}
      {snapshot.stays.length > 0 && (
        <section aria-label="숙소" className="flex min-w-0 flex-col gap-2">
          <h2 className="text-[15px] font-semibold text-foreground">숙소</h2>
          <ul className="flex min-w-0 flex-col gap-1.5">
            {snapshot.stays.map((stay, index) => (
              <li
                key={`${stay.city}-${index}`}
                className="flex min-w-0 flex-col gap-0.5 text-base text-foreground [overflow-wrap:anywhere]"
              >
                <span className="min-w-0 font-medium">{stay.city}</span>
                <span className="min-w-0 text-sm text-foreground-muted">
                  {formatStayLabel(stay)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 5. 교통 (sanitized) */}
      {snapshot.transports.length > 0 && (
        <section aria-label="교통" className="flex min-w-0 flex-col gap-2">
          <h2 className="text-[15px] font-semibold text-foreground">교통</h2>
          <ul className="flex min-w-0 flex-col gap-1.5">
            {snapshot.transports.map((transport, index) => (
              <li
                key={`${transport.fromCity}-${transport.toCity}-${index}`}
                className="flex min-w-0 flex-col gap-0.5 text-base text-foreground [overflow-wrap:anywhere]"
              >
                <span className="min-w-0 font-medium">
                  {transport.fromCity} → {transport.toCity}
                </span>
                <span className="min-w-0 text-sm text-foreground-muted">
                  {formatTransportLabel(transport)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 6. 작성자 */}
      <footer className="min-w-0">
        <p className="min-w-0 text-sm text-foreground-subtle [overflow-wrap:anywhere]">
          <span className="sr-only">작성자</span>
          {snapshot.author.displayName}
        </p>
      </footer>

      {/*
        action slot: save/import가 준비되면(DISC-6/7) 여기 주입한다. 준비 전에는
        action이 undefined이므로 이 블록 자체가 렌더되지 않는다(dead CTA DOM 금지).
      */}
      {action != null && (
        <div data-slot="explore-listing-detail-action" className="min-w-0">
          {action}
        </div>
      )}
    </article>
  );
}
