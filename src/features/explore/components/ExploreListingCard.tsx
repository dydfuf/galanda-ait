import { Link } from "react-router-dom";

import type { ExploreListingItem } from "../../../contracts/explore.ts";
import { ExploreSaveToggle } from "./ExploreSaveToggle.tsx";

/**
 * Explore feed 카드 (RAON-260 DISC-4 → RAON-263 DISC-5 detail link → RAON-254
 * DISC-6 save toggle).
 *
 * public snapshot의 허용 필드만 렌더링한다: 제목, 경로(방문 도시), 기간(박수/일수와
 * 날짜 범위), 작성자 표시명. impression/save/import 같은 인기 지표, 이미지/썸네일,
 * 저장 수 등은 실제 데이터가 없으므로 만들지 않는다(fake popularity/image/count 금지).
 *
 * 카드의 제목/경로/기간 영역이 `/explore/:listingId` focused detail로 이동하는
 * native link다(버튼으로 route를 흉내내지 않는다). save toggle은 link **밖**의
 * 형제 요소로 두어 nested interactive(link 안의 button)를 만들지 않는다. 긴
 * 제목/경로도 leaf가 min-w-0 + overflow-wrap:anywhere로 줄바꿈되어 잘리지 않으며,
 * focus-visible ring과 accessible name(제목)을 보장한다.
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

const formatRoute = (
  routes: ExploreListingItem["snapshot"]["routes"]
): string => routes.map((route) => route.city).join(" → ");

export function ExploreListingCard({ item }: { item: ExploreListingItem }) {
  const { snapshot } = item;
  const routeText = formatRoute(snapshot.routes);
  const durationText = formatDuration(
    snapshot.dateRange.nightCount,
    snapshot.dateRange.startDate,
    snapshot.dateRange.endDate
  );

  return (
    <div
      data-slot="explore-listing-card"
      className="flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-card p-4 transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring"
    >
      <Link
        to={`/explore/${encodeURIComponent(item.listingId)}`}
        // accessible name은 제목(h3)이 제공한다. link는 제목을 참조한다.
        aria-labelledby={`explore-card-title-${item.listingId}`}
        className="flex min-w-0 flex-col gap-2 rounded-md hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <h3
          id={`explore-card-title-${item.listingId}`}
          className="min-w-0 text-[17px] leading-snug font-bold text-foreground [overflow-wrap:anywhere]"
        >
          {snapshot.title}
        </h3>

        <dl className="flex min-w-0 flex-col gap-1 text-base text-foreground-muted">
          <div className="flex min-w-0 gap-1.5">
            <dt className="sr-only">경로</dt>
            <dd className="min-w-0 [overflow-wrap:anywhere]">{routeText}</dd>
          </div>
          <div className="flex min-w-0 gap-1.5">
            <dt className="sr-only">기간</dt>
            <dd className="min-w-0 [overflow-wrap:anywhere]">{durationText}</dd>
          </div>
        </dl>

        <p className="min-w-0 text-sm text-foreground-subtle [overflow-wrap:anywhere]">
          <span className="sr-only">작성자</span>
          {snapshot.author.displayName}
        </p>
      </Link>

      {/* save toggle: link 밖의 형제. nested interactive를 만들지 않는다. */}
      <div className="min-w-0">
        <ExploreSaveToggle listingId={item.listingId} />
      </div>
    </div>
  );
}
