import { Link } from "react-router-dom";
import { BookmarkCheck, MapPinned } from "lucide-react";

import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { toLocalTravelDate } from "@/core/domain/room.ts";
import { useSessionQuery } from "@/hooks/useSession.ts";
import { toUserMessage } from "@/features/common/error-message.ts";
import { useSavedListingsQuery } from "@/features/explore/save-queries.ts";
import type { SavedListingItem } from "@/contracts/explore-save.ts";
import { getHomeTripDayLabel } from "./HomeTripDashboard.tsx";

/**
 * Home `저장한 여행 아이디어` section (RAON-256 DISC-9).
 *
 * 이미 존재하는 persisted saved-listing capability(`useSavedListingsQuery`,
 * participant-scoped `/api/me/saved`, LISTED-only read-through)를 Home에 통합한다.
 * RAON-246 Home dashboard/NBA는 외부 Backlog blocker이므로 여기서 대시보드/추천을
 * 지어내지 않는다.
 *
 * ## 정직한 상태 / privacy
 *
 * - server savedAt 순서를 그대로 유지하고, 앞에서부터 compact limit만큼만 보여준다.
 * - public allowlist만 렌더한다: 제목, 경로(방문 도시), 기간(박수/일수·날짜),
 *   저장 시각(savedAt), 그리고 detail link용 public `listingId`.
 * - private Trip/Plan/participant/booking/opinion 필드나 fake image/count/activity/
 *   recommendation은 절대 만들지 않는다.
 * - 서버가 UNLISTED/deleted listing을 read-through에서 제외하므로 여기 오지 않는다.
 *   존재하지 않는 카드를 대신 만들지 않는다.
 *
 * ## 격리
 *
 * 이 section의 loading/error/empty는 Home의 제목/바로 가기/핵심 콘텐츠를 숨기거나
 * 막지 않는다(독립적으로 composed됨). error가 있어도 cached row는 보존하되,
 * 최신 목록을 확인하지 못했다는 비차단 오류와 retry를 함께 보여 stale data를
 * 최신 상태처럼 오인시키지 않는다.
 *
 * ## Query key
 *
 * Home은 `/me/saved`와 동일한 `useSavedListingsQuery`(같은 `exploreSaveKeys.
 * savedList(participantId)` key, 같은 page size)를 공유한다. 따라서 save/unsave
 * mutation의 `savedList` invalidation이 Home query에도 그대로 도달한다(별도
 * page-size key를 도입하지 않는다).
 */

/** Home에서 보여줄 최근 저장 항목의 명시적 상한. */
export const HOME_SAVED_COMPACT_LIMIT = 3;

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
  routes: SavedListingItem["listing"]["snapshot"]["routes"]
): string => routes.map((route) => route.city).join(" → ");

const formatSavedAt = (savedAt: string): string => {
  const time = Date.parse(savedAt);
  if (Number.isNaN(time)) return "";
  const d = new Date(time);
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()} 저장`;
};

function SavedIdeaRow({ entry }: { entry: SavedListingItem }) {
  const { listing, savedAt } = entry;
  const { snapshot } = listing;
  const routeText = formatRoute(snapshot.routes);
  const durationText = formatDuration(
    snapshot.dateRange.nightCount,
    snapshot.dateRange.startDate,
    snapshot.dateRange.endDate,
  );
  const savedAtText = formatSavedAt(savedAt);
  const dayLabel = getHomeTripDayLabel(
    snapshot.dateRange.startDate,
    snapshot.dateRange.endDate,
    toLocalTravelDate(new Date()),
  );
  const titleId = `home-saved-title-${listing.listingId}`;

  return (
    <li className="min-w-0 border-b border-border last:border-b-0">
      <Link
        to={`/explore/${encodeURIComponent(listing.listingId)}`}
        aria-labelledby={titleId}
        className="group flex min-w-0 items-center gap-3 rounded-xl px-2 py-3 text-foreground! no-underline! transition-colors hover:bg-muted/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <span
          aria-hidden="true"
          className="grid size-18 shrink-0 place-items-center overflow-hidden rounded-xl bg-primary-muted text-primary"
        >
          <span className="flex flex-col items-center gap-1">
            <MapPinned className="size-6" />
            <span className="max-w-14 truncate text-xs font-bold">
              {snapshot.destination}
            </span>
          </span>
        </span>

        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <h3
            id={titleId}
            className="min-w-0 text-[15px] leading-snug font-bold text-foreground [overflow-wrap:anywhere]"
          >
            {snapshot.title}
          </h3>
          <span className="min-w-0 text-sm text-foreground-muted [overflow-wrap:anywhere]">
            {routeText}
          </span>
          <span className="min-w-0 text-sm text-foreground-subtle [overflow-wrap:anywhere]">
            {durationText}
          </span>
          {savedAtText && (
            <span className="min-w-0 text-xs text-foreground-subtle [overflow-wrap:anywhere]">
              <span className="sr-only">저장 시각</span>
              {savedAtText}
            </span>
          )}
        </span>

        <span className="flex shrink-0 flex-col items-end justify-between self-stretch py-1">
          {dayLabel ? <Badge variant="info">{dayLabel}</Badge> : <span />}
          <span className="text-foreground-muted" title="저장됨">
            <BookmarkCheck className="size-5" aria-hidden="true" />
            <span className="sr-only">저장됨</span>
          </span>
        </span>
      </Link>
    </li>
  );
}

export function SavedIdeasSection() {
  const {
    isError: isSessionError,
    refetch: refetchSession,
  } = useSessionQuery();

  const { data, isPending, isError, error, refetch } = useSavedListingsQuery();

  const allItems = data?.pages.flatMap((page) => page.items) ?? [];
  const items = allItems.slice(0, HOME_SAVED_COMPACT_LIMIT);
  const hasItems = items.length > 0;

  // section body만 상태에 따라 바뀐다. 제목/전체 보기 link는 항상 유지되며,
  // 이 section 자체가 Home의 다른 콘텐츠를 가리지 않는다.
  let body: React.ReactNode;
  if (isSessionError) {
    // 세션 오류도 section-local 상태로 제한하고 독립 재시도를 제공한다.
    body = (
      <div className="flex flex-col items-start gap-2">
        <p role="alert" className="text-sm text-destructive-strong">
          로그인 정보를 확인할 수 없어 저장한 여행 아이디어를 불러오지 못했어요.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void refetchSession()}
        >
          로그인 정보 다시 확인
        </Button>
      </div>
    );
  } else if (isError && !hasItems) {
    // 초기 오류(캐시된 행 없음): 재시도 액션과 함께 안내한다.
    body = (
      <div className="flex flex-col items-start gap-2">
        <p role="alert" className="text-sm text-destructive-strong">
          {toUserMessage(error, "저장한 여행 아이디어를 불러오지 못했어요.")}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void refetch()}
        >
          다시 시도
        </Button>
      </div>
    );
  } else if (isPending) {
    body = (
      <output
        className="flex items-center gap-2 text-sm text-foreground-muted"
        aria-live="polite"
      >
        <Spinner className="size-4 text-info" aria-hidden="true" />
        <span>저장한 여행 아이디어를 불러오는 중이에요.</span>
      </output>
    );
  } else if (!hasItems) {
    body = (
      <p className="text-sm text-foreground-muted">
        아직 저장한 여행 아이디어가 없어요. 탐색에서 마음에 드는 여행 일정을
        저장해보세요.
      </p>
    );
  } else {
    // 캐시된 행은 유지하되 background/refetch 오류를 함께 밝혀 stale 목록을
    // 최신처럼 보이게 하지 않는다.
    body = (
      <div className="flex min-w-0 flex-col gap-3">
        <ul className="overflow-hidden rounded-2xl border border-border bg-card px-1">
          {items.map((entry) => (
            <SavedIdeaRow key={entry.listing.listingId} entry={entry} />
          ))}
        </ul>
        {isError && (
          <div className="flex flex-col items-start gap-2">
            <p role="alert" className="text-sm text-destructive-strong">
              최신 저장 목록을 확인하지 못했어요. 표시된 내용은 이전에 불러온
              목록이에요.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void refetch()}
            >
              목록 다시 확인
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <section aria-labelledby="home-saved-heading" className="flex min-w-0 flex-col gap-3">
      <div className="flex min-w-0 items-baseline justify-between gap-2">
        <h2
          id="home-saved-heading"
          className="min-w-0 text-[17px] leading-snug font-bold text-foreground [overflow-wrap:anywhere]"
        >
          저장한 여행 아이디어
        </h2>
        <Link
          to="/me/saved"
          className="shrink-0 text-sm font-medium text-info no-underline! hover:underline! focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          전체 보기
        </Link>
      </div>
      {body}
    </section>
  );
}
