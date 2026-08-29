import { PageBody } from "@/components/galanda/page-body.tsx";
import { PageTitle } from "@/components/galanda/page-title.tsx";
import { PageState } from "@/components/galanda/page-state.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { useSessionQuery } from "@/hooks/useSession.ts";
import { toUserMessage } from "@/features/common/error-message.ts";

import { ExploreListingCard } from "@/features/explore/components/ExploreListingCard.tsx";
import { useSavedListingsQuery } from "@/features/explore/save-queries.ts";

/**
 * 내 저장 목록 화면 (RAON-254 / Goal 14 DISC-6, `/me/saved`).
 *
 * 현재 세션의 저장 목록을 최신순으로 보여준다. 서버가 현재 LISTED listing만
 * read-through로 반환하므로 UNLISTED/deleted는 목록에서 사라지고 relist되면 다시
 * 나타난다(정직한 상태). 저장 수/인기 지표는 계산·노출하지 않는다.
 *
 * 상태 계약(ExplorePage와 동일):
 * - 초기 loading/error/empty는 상호 배타적으로 하나만 노출한다.
 * - next-page loading/error/retry는 기존 행을 보존한 채 별도 하단 영역에서 구분한다.
 */
export function SavedListingsPage() {
  const {
    isError: isSessionError,
    error: sessionError,
    refetch: refetchSession,
  } = useSessionQuery();

  const {
    data,
    isPending,
    isError,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
  } = useSavedListingsQuery();

  const items = data?.pages.flatMap((page) => page.items) ?? [];

  const loadNextPage = () => {
    void fetchNextPage();
  };

  const content = isSessionError ? (
    <PageState
      status="error"
      title="로그인 정보를 확인할 수 없어요"
      description={toUserMessage(sessionError, "잠시 후 다시 시도해주세요.")}
      actionText="다시 시도"
      onAction={() => void refetchSession()}
    />
  ) : isPending ? (
    <PageState status="loading" message="저장한 여행 일정을 불러오는 중이에요." />
  ) : isError && items.length === 0 ? (
    <PageState
      status="error"
      title="저장 목록을 불러오지 못했어요"
      description={toUserMessage(error, "잠시 후 다시 시도해주세요.")}
      actionText="다시 시도"
      onAction={() => void refetch()}
    />
  ) : items.length === 0 ? (
    <PageState
      status="empty"
      title="아직 저장한 여행 일정이 없어요"
      description="탐색에서 마음에 드는 여행 일정을 저장하면 이곳에 모여요."
    />
  ) : (
    <div className="flex flex-col gap-6 px-(--app-inline-padding)">
      <section aria-label="저장한 여행 일정" className="flex flex-col gap-3">
        <ul className="flex flex-col gap-3">
          {items.map((entry) => (
            <li key={entry.listing.listingId} className="min-w-0">
              <ExploreListingCard item={entry.listing} />
            </li>
          ))}
        </ul>

        {hasNextPage && (
          <div className="flex flex-col items-center gap-2 py-2">
            {isFetchNextPageError ? (
              <>
                <p role="alert" className="text-base text-destructive-strong">
                  {toUserMessage(error, "다음 목록을 불러오지 못했어요.")}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={loadNextPage}
                >
                  다시 시도
                </Button>
              </>
            ) : isFetchingNextPage ? (
              <output
                className="flex items-center gap-2 text-base text-foreground-muted"
                aria-live="polite"
              >
                <Spinner className="size-5 text-info" aria-hidden="true" />
                <span>더 불러오는 중이에요.</span>
              </output>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={loadNextPage}
              >
                더 보기
              </Button>
            )}
          </div>
        )}
      </section>
    </div>
  );

  return (
    <PageBody safeTop>
      <PageTitle
        title="저장한 여행 일정"
        description="탐색에서 저장한 여행 일정을 모아봐요."
      />
      {content}
    </PageBody>
  );
}
