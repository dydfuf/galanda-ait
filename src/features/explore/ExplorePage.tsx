import { PageBody } from "@/components/galanda/page-body.tsx";
import { PageTitle } from "@/components/galanda/page-title.tsx";
import { PageState } from "@/components/galanda/page-state.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { useSessionQuery } from "@/hooks/useSession.ts";
import { toUserMessage } from "@/features/common/error-message.ts";

import { useExploreListingsQuery } from "./queries.ts";
import { ExploreListingCard } from "./components/ExploreListingCard.tsx";

/**
 * Explore page (RAON-251 lazy honest state → RAON-260 data-backed feed).
 *
 * v1 primary section은 실제 정렬 의미(`listedAt DESC`)와 일치하는 "새로 공개된 여행
 * 일정"이다. theme/city section이나 인기 지표는 실제 집계가 없으므로 만들지 않는다.
 *
 * 상태 계약:
 * - 초기 loading/error/empty는 상호 배타적으로 하나만 노출한다.
 * - next-page loading/error/retry는 기존 행을 보존한 채 별도 하단 영역에서 구분해
 *   보여준다(초기 상태와 섞지 않는다).
 */
export function ExplorePage() {
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
  } = useExploreListingsQuery();

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
    <PageState status="loading" message="공개된 여행 일정을 불러오는 중이에요." />
  ) : isError && items.length === 0 ? (
    <PageState
      status="error"
      title="여행 일정을 불러오지 못했어요"
      description={toUserMessage(error, "잠시 후 다시 시도해주세요.")}
      actionText="다시 시도"
      onAction={() => void refetch()}
    />
  ) : items.length === 0 ? (
    <PageState
      status="empty"
      title="아직 공개된 여행 일정이 없어요"
      description="여행 일정이 공개되면 이곳에서 둘러볼 수 있어요."
    />
  ) : (
    <div className="flex flex-col gap-6 px-(--app-inline-padding)">
      <section aria-label="새로 공개된 여행 일정" className="flex flex-col gap-3">
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li key={item.listingId} className="min-w-0">
              <ExploreListingCard item={item} />
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
        title="탐색"
        description="다른 사람들이 공개한 여행 일정을 둘러보세요."
      />
      {content}
    </PageBody>
  );
}
