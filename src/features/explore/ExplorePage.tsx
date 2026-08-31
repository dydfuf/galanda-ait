import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";

import { PageBody } from "@/components/galanda/page-body.tsx";
import { PageTitle } from "@/components/galanda/page-title.tsx";
import { PageState } from "@/components/galanda/page-state.tsx";
import { SectionHeader } from "@/components/galanda/section-header.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Field, FieldLabel } from "@/components/ui/field.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import {
  normalizeExploreListingsFilters,
  type ExploreListingsFilters,
} from "@/contracts/explore.ts";
import {
  EXPLORE_SELECTABLE_THEMES,
  isExploreThemeId,
  type ExploreThemeId,
} from "@/core/domain/explore-theme.ts";
import { useSessionQuery } from "@/hooks/useSession.ts";
import { toUserMessage } from "@/features/common/error-message.ts";

import { useExploreListingsQuery } from "./queries.ts";
import { ExploreListingCard } from "./components/ExploreListingCard.tsx";

const themeIdFromUrl = (value: string | null): ExploreThemeId | undefined =>
  isExploreThemeId(value) ? value : undefined;

const filterFromUrl = (
  searchParams: URLSearchParams
): ExploreListingsFilters => ({
  query: searchParams.get("query") ?? undefined,
  destination: searchParams.get("destination") ?? undefined,
  routeCity: searchParams.get("routeCity") ?? undefined,
  themeId: themeIdFromUrl(searchParams.get("themeId")),
  startDate: searchParams.get("startDate") ?? undefined,
  endDate: searchParams.get("endDate") ?? undefined,
});

const filtersToSearchParams = (
  filters: ExploreListingsFilters
): URLSearchParams => {
  const searchParams = new URLSearchParams();
  for (const [name, value] of Object.entries(filters)) {
    if (value) searchParams.set(name, value);
  }
  return searchParams;
};

/**
 * Explore page (RAON-251 → RAON-260 data-backed feed → RAON-270 filters).
 *
 * URL에는 검색/공개 facet 조건만 저장하고 cursor는 TanStack infinite query가
 * 소유한다. query key와 모든 page 요청이 같은 normalized 조건을 사용하므로,
 * 현재 로드된 page를 client-side filtering하지 않고 서버의 전체 LISTED dataset
 * 결과를 그대로 렌더링한다.
 */
export function ExplorePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawSearch = searchParams.toString();
  const filters = useMemo(
    () =>
      normalizeExploreListingsFilters(
        filterFromUrl(new URLSearchParams(rawSearch))
      ),
    [rawSearch]
  );
  const canonicalSearch = useMemo(
    () => filtersToSearchParams(filters).toString(),
    [filters]
  );
  const [draftFilters, setDraftFilters] =
    useState<ExploreListingsFilters>(filters);
  const [filterError, setFilterError] = useState<string | null>(null);
  const hasFilters = Object.values(filters).some(Boolean);
  const hasDraftFilters = Object.values(
    normalizeExploreListingsFilters(draftFilters)
  ).some(Boolean);

  // back/forward/direct URL을 form에 반영하되 form subtree는 remount하지 않아
  // submit/reset button의 keyboard focus를 보존한다. 비정규 URL은 replace한다.
  useEffect(() => {
    setDraftFilters(filters);
    if (rawSearch !== canonicalSearch) {
      setSearchParams(new URLSearchParams(canonicalSearch), { replace: true });
    }
  }, [canonicalSearch, filters, rawSearch, setSearchParams]);

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
  } = useExploreListingsQuery(filters);

  const items = data?.pages.flatMap((page) => page.items) ?? [];

  const handleFilterSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextFilters = normalizeExploreListingsFilters(draftFilters);

    if (
      nextFilters.startDate &&
      nextFilters.endDate &&
      nextFilters.startDate > nextFilters.endDate
    ) {
      setFilterError("시작일은 종료일보다 늦을 수 없어요.");
      return;
    }

    setFilterError(null);
    setDraftFilters(nextFilters);
    setSearchParams(filtersToSearchParams(nextFilters));
  };

  const updateDraftFilter = <Key extends keyof ExploreListingsFilters>(
    name: Key,
    value: ExploreListingsFilters[Key]
  ) => {
    setDraftFilters((current) => ({ ...current, [name]: value }));
  };

  const resetFilters = () => {
    setFilterError(null);
    setDraftFilters({});
    setSearchParams(new URLSearchParams());
  };

  const loadNextPage = () => {
    void fetchNextPage();
  };

  const sectionTitle = hasFilters ? "검색 결과" : "새로 공개된 여행 일정";
  const sectionDescription = hasFilters
    ? "선택한 조건에 맞는 최신 공개 일정이에요."
    : "가장 최근에 공개된 일정부터 둘러보세요.";

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
      title={
        hasFilters
          ? "조건에 맞는 여행 일정이 없어요"
          : "아직 공개된 여행 일정이 없어요"
      }
      description={
        hasFilters
          ? "검색어나 테마, 날짜 범위를 바꿔보세요."
          : "여행 일정이 공개되면 이곳에서 둘러볼 수 있어요."
      }
      {...(hasFilters
        ? { actionText: "필터 초기화", onAction: resetFilters }
        : {})}
    />
  ) : (
    <section aria-label={sectionTitle} className="flex min-w-0 flex-col pb-2">
      <SectionHeader
        title={sectionTitle}
        description={sectionDescription}
        className="pt-0"
      />

      <div className="flex min-w-0 flex-col gap-4 px-(--app-inline-padding)">
        <ul className="flex min-w-0 flex-col gap-4">
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
      </div>
    </section>
  );

  return (
    <PageBody safeTop>
      <PageTitle
        title="탐색"
        description="다른 사람들이 공개한 여행 일정을 둘러보세요."
      />

      <form
        role="search"
        aria-label="공개 여행 일정 검색"
        onSubmit={handleFilterSubmit}
        className="mx-(--app-inline-padding) mb-6 flex min-w-0 flex-col gap-4 rounded-xl border border-border bg-card p-4"
      >
        <Field>
          <FieldLabel htmlFor="explore-query">일정 검색</FieldLabel>
          <Input
            id="explore-query"
            name="query"
            type="search"
            maxLength={100}
            value={draftFilters.query ?? ""}
            onChange={(event) => updateDraftFilter("query", event.target.value)}
            placeholder="제목, 목적지, 경유 도시"
          />
        </Field>

        <fieldset className="flex min-w-0 flex-col gap-2">
          <legend className="text-sm leading-none font-medium text-foreground">
            여행 테마
          </legend>
          <div className="flex min-w-0 flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={draftFilters.themeId === undefined ? "default" : "outline"}
              aria-pressed={draftFilters.themeId === undefined}
              onClick={() => updateDraftFilter("themeId", undefined)}
            >
              전체
            </Button>
            {EXPLORE_SELECTABLE_THEMES.map((theme) => (
              <Button
                key={theme.id}
                type="button"
                size="sm"
                variant={draftFilters.themeId === theme.id ? "default" : "outline"}
                aria-pressed={draftFilters.themeId === theme.id}
                onClick={() => updateDraftFilter("themeId", theme.id)}
              >
                {theme.label}
              </Button>
            ))}
          </div>
        </fieldset>

        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="explore-destination">목적지</FieldLabel>
            <Input
              id="explore-destination"
              name="destination"
              maxLength={100}
              value={draftFilters.destination ?? ""}
              onChange={(event) =>
                updateDraftFilter("destination", event.target.value)
              }
              placeholder="예: 오사카"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="explore-route-city">경유 도시</FieldLabel>
            <Input
              id="explore-route-city"
              name="routeCity"
              maxLength={100}
              value={draftFilters.routeCity ?? ""}
              onChange={(event) =>
                updateDraftFilter("routeCity", event.target.value)
              }
              placeholder="예: 교토"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="explore-start-date">
              겹치는 기간 시작일
            </FieldLabel>
            <Input
              id="explore-start-date"
              name="startDate"
              type="date"
              value={draftFilters.startDate ?? ""}
              onChange={(event) =>
                updateDraftFilter("startDate", event.target.value)
              }
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="explore-end-date">
              겹치는 기간 종료일
            </FieldLabel>
            <Input
              id="explore-end-date"
              name="endDate"
              type="date"
              value={draftFilters.endDate ?? ""}
              onChange={(event) =>
                updateDraftFilter("endDate", event.target.value)
              }
            />
          </Field>
        </div>
        <p className="text-base text-foreground-muted">
          선택한 기간과 하루라도 겹치는 공개 일정을 찾아요.
        </p>

        {filterError && (
          <p role="alert" className="text-base text-destructive-strong">
            {filterError}
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={resetFilters}
            disabled={!hasDraftFilters}
          >
            초기화
          </Button>
          <Button type="submit">검색하기</Button>
        </div>
      </form>

      {content}
    </PageBody>
  );
}
