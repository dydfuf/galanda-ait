import { MapPinned } from "lucide-react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge.tsx";
import { getExploreThemeLabel } from "@/core/domain/explore-theme.ts";
import type { ExploreListingItem } from "../../../contracts/explore.ts";
import { ExploreSaveToggle } from "./ExploreSaveToggle.tsx";

/**
 * Explore feed 카드 (RAON-260 DISC-4 → RAON-263 DISC-5 detail link → RAON-254
 * DISC-6 save toggle).
 *
 * public snapshot의 허용 필드만 렌더링한다: 제목, 목적지/경로(방문 도시), 기간
 * (박수/일수와 날짜 범위), 작성자 표시명과 listing envelope의 공개일. 이미지나
 * impression/save/import 같은 인기 지표, 저장 수 등은 실제 데이터가 없으므로 만들지
 * 않는다(fake popularity/image/count 금지).
 *
 * 카드의 정보 영역이 `/explore/:listingId` focused detail로 이동하는 native link다.
 * save toggle은 link **밖**의 형제 요소로 두어 nested interactive(link 안의 button)를
 * 만들지 않는다. 긴 제목/경로도 leaf가 min-w-0 + overflow-wrap:anywhere로 줄바꿈되어
 * 잘리지 않으며, focus-visible ring과 accessible name(제목)을 보장한다.
 */

const formatShortDate = (date: string): string => {
  const match = /^(?:\d{4})-(\d{2})-(\d{2})$/.exec(date);
  return match ? `${Number(match[1])}.${Number(match[2])}` : date;
};

const formatDuration = (
  nightCount: number,
  startDate: string,
  endDate: string,
): string => {
  const dayCount = nightCount + 1;
  const period = `${formatShortDate(startDate)} ~ ${formatShortDate(endDate)}`;
  return `${nightCount}박 ${dayCount}일 · ${period}`;
};

const formatRoute = (
  routes: ExploreListingItem["snapshot"]["routes"],
): string =>
  routes
    .map((route) => route.city.trim())
    .filter(Boolean)
    .join(" → ");

const formatPublicDate = (listedAt: string): string => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(listedAt);
  return match ? `${match[1]}.${match[2]}.${match[3]}` : listedAt;
};

const getVisualDestination = (
  snapshot: ExploreListingItem["snapshot"],
): string | undefined => {
  const destination = snapshot.destination.trim();
  if (destination) return destination;
  return snapshot.routes.map((route) => route.city.trim()).find(Boolean);
};

export function ExploreListingCard({ item }: { item: ExploreListingItem }) {
  const { snapshot } = item;
  const visualDestination = getVisualDestination(snapshot);
  const routeText = formatRoute(snapshot.routes);
  const durationText = formatDuration(
    snapshot.dateRange.nightCount,
    snapshot.dateRange.startDate,
    snapshot.dateRange.endDate,
  );
  const authorName = snapshot.author.displayName.trim();

  return (
    <article
      data-slot="explore-listing-card"
      className="flex min-w-0 flex-col gap-3 rounded-2xl border border-border bg-card p-3 transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring"
    >
      <Link
        to={`/explore/${encodeURIComponent(item.listingId)}`}
        // accessible name은 제목(h3)이 제공한다. link는 제목을 참조한다.
        aria-labelledby={`explore-card-title-${item.listingId}`}
        className="flex min-w-0 flex-col gap-4 rounded-xl hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <div
          data-slot="explore-destination-visual"
          className="flex min-h-36 min-w-0 flex-col items-start justify-end gap-3 rounded-xl border border-primary-border-weak bg-primary-muted p-4 text-primary"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-full border border-primary-border bg-card">
            <MapPinned className="size-6" aria-hidden="true" />
          </span>
          {visualDestination ? (
            <p className="min-w-0 text-lg leading-snug font-bold [overflow-wrap:anywhere]">
              <span className="sr-only">목적지 </span>
              {visualDestination}
            </p>
          ) : (
            <span className="sr-only">목적지 정보 없음</span>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-3 px-1">
          <h3
            id={`explore-card-title-${item.listingId}`}
            className="min-w-0 text-lg leading-snug font-bold text-foreground [overflow-wrap:anywhere]"
          >
            {snapshot.title}
          </h3>

          {(snapshot.themeIds?.length ?? 0) > 0 && (
            <ul aria-label="여행 테마" className="flex min-w-0 flex-wrap gap-1.5">
              {snapshot.themeIds?.map((themeId) => (
                <li key={themeId}>
                  <Badge variant="info">{getExploreThemeLabel(themeId)}</Badge>
                </li>
              ))}
            </ul>
          )}

          <dl className="flex min-w-0 flex-col gap-2 rounded-xl bg-surface-subtle p-3 text-sm text-foreground-muted">
            {routeText && (
              <div className="flex min-w-0 flex-col gap-0.5">
                <dt className="font-semibold text-foreground-subtle">여행 경로</dt>
                <dd className="min-w-0 [overflow-wrap:anywhere]">{routeText}</dd>
              </div>
            )}
            <div className="flex min-w-0 flex-col gap-0.5">
              <dt className="font-semibold text-foreground-subtle">여행 기간</dt>
              <dd className="min-w-0 [overflow-wrap:anywhere]">{durationText}</dd>
            </div>
          </dl>

          <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm text-foreground-subtle">
            {authorName && (
              <p className="min-w-0 [overflow-wrap:anywhere]">
                <span className="sr-only">작성자 </span>
                {authorName}
              </p>
            )}
            <p className="min-w-0 [overflow-wrap:anywhere]">
              공개일 {formatPublicDate(item.listedAt)}
            </p>
          </div>
        </div>
      </Link>

      {/* save toggle: link 밖의 형제. nested interactive를 만들지 않는다. */}
      <div className="flex min-w-0 justify-end border-t border-border px-1 pt-3">
        <ExploreSaveToggle listingId={item.listingId} />
      </div>
    </article>
  );
}
