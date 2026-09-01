import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";

import {
  getExploreSaveState,
  getSavedListings,
  saveExploreListing,
  unsaveExploreListing,
} from "../../app/api-client.ts";
import type { ExploreListingId } from "../../core/domain/ids.ts";
import type {
  ExploreSaveStateResponse,
  SavedListingsResponse,
} from "../../contracts/explore-save.ts";
import { useSessionQuery } from "../../hooks/useSession.ts";
import { exploreKeys } from "./queries.ts";

/** 한 페이지 크기. 서버 상한(SAVED_LISTINGS_MAX_LIMIT=50) 안이다. */
export const SAVED_FEED_PAGE_SIZE = 20;

export const exploreSaveKeys = {
  all: ["explore", "save"] as const,
  /**
   * 단건 저장 상태. session participant를 key에 포함해 다른 세션/식별자로 캐시가
   * 새지 않도록 한다(다른 사용자의 상태를 읽거나 표시하지 않음).
   */
  state: (
    listingId: ExploreListingId,
    participantId: string
  ): readonly ["explore", "save", "state", ExploreListingId, string] =>
    [...exploreSaveKeys.all, "state", listingId, participantId] as const,
  /** 저장 목록. session participant를 key에 포함한다. */
  savedList: (
    participantId: string
  ): readonly ["explore", "save", "list", string] =>
    [...exploreSaveKeys.all, "list", participantId] as const,
};

type SavedCursor = string | undefined;

/**
 * 단건 저장 상태 query (RAON-254 DISC-6).
 *
 * session이 준비된 뒤에만 활성화한다(저장은 authenticated session을 요구). 실제
 * persisted 상태를 조회하므로 새로고침/다른 기기와 일치한다. QueryClient가 retry를
 * 비활성화하므로 401/오류가 무한 재시도되지 않는다.
 */
export const useExploreSaveStateQuery = (listingId: ExploreListingId) => {
  const { data: session, isSuccess: isSessionReady } = useSessionQuery();
  const participantId = session?.participantId ?? "anonymous";

  return useQuery<ExploreSaveStateResponse, Error>({
    queryKey: exploreSaveKeys.state(listingId, participantId),
    queryFn: ({ signal }) => getExploreSaveState(listingId, signal),
    enabled: Boolean(listingId) && isSessionReady && Boolean(session),
  });
};

/**
 * 저장/해제 mutation (RAON-254 DISC-6).
 *
 * ## Honest state / rollback
 *
 * optimistic UI를 쓰되, 실패를 절대 `저장됨`으로 표시하지 않는다. mutate 시 state
 * cache를 낙관적으로 바꾸고, 실패하면 이전 값으로 **rollback**한다(사용자는 retry
 * 가능). 성공/실패 모두 settle 후 실제 persisted 상태로 invalidate해 서버 진실과
 * 일치시킨다. 저장 목록도 함께 invalidate한다.
 *
 * server는 save/unsave 응답으로 실제 저장 상태와 aggregate(`{ saved, saveCount }`)를
 * 돌려주므로, 성공 시 그 값으로 state cache를 확정한다. count는 optimistic
 * 변경하지 않는다.
 */
export const useToggleExploreSaveMutation = (listingId: ExploreListingId) => {
  const queryClient = useQueryClient();
  const { data: session } = useSessionQuery();
  const participantId = session?.participantId ?? "anonymous";
  const stateKey = exploreSaveKeys.state(listingId, participantId);
  const savedListKey = exploreSaveKeys.savedList(participantId);

  return useMutation<
    ExploreSaveStateResponse,
    Error,
    { readonly nextSaved: boolean },
    { readonly previous: ExploreSaveStateResponse | undefined }
  >({
    mutationFn: ({ nextSaved }) =>
      nextSaved ? saveExploreListing(listingId) : unsaveExploreListing(listingId),
    onMutate: async ({ nextSaved }) => {
      // in-flight 조회가 낙관적 값을 덮어쓰지 않도록 취소한다.
      await queryClient.cancelQueries({ queryKey: stateKey });
      const previous =
        queryClient.getQueryData<ExploreSaveStateResponse>(stateKey);
      if (previous) {
        queryClient.setQueryData<ExploreSaveStateResponse>(stateKey, {
          saved: nextSaved,
          saveCount: previous.saveCount,
        });
      }
      return { previous };
    },
    onError: (_error, _variables, context) => {
      // 실패 시 이전 값으로 rollback(실패를 성공으로 표시하지 않음).
      if (context) {
        queryClient.setQueryData(stateKey, context.previous);
      }
    },
    onSuccess: (data) => {
      // 서버가 돌려준 실제 상태로 확정한다.
      queryClient.setQueryData<ExploreSaveStateResponse>(stateKey, data);
    },
    onSettled: () => {
      // 서버 진실과 최종 동기화 + 저장 목록 갱신.
      void queryClient.invalidateQueries({ queryKey: stateKey });
      void queryClient.invalidateQueries({ queryKey: savedListKey });
      void queryClient.invalidateQueries({ queryKey: exploreKeys.all });
      void queryClient.invalidateQueries({
        queryKey: exploreKeys.detail(listingId),
      });
    },
  });
};

/**
 * 내 저장 목록 infinite query (RAON-254 DISC-6, `/me/saved`).
 *
 * - session이 준비된 뒤에만 활성화한다.
 * - keyset pagination: 서버가 준 opaque `nextCursor`를 다음 페이지 param으로 쓴다.
 * - 현재 LISTED listing만 반환되므로 UNLISTED/deleted는 목록에서 사라진다(정직한 상태).
 */
export const useSavedListingsQuery = () => {
  const { data: session, isSuccess: isSessionReady } = useSessionQuery();
  const participantId = session?.participantId ?? "anonymous";

  return useInfiniteQuery<
    SavedListingsResponse,
    Error,
    InfiniteData<SavedListingsResponse, SavedCursor>,
    readonly ["explore", "save", "list", string],
    SavedCursor
  >({
    queryKey: exploreSaveKeys.savedList(participantId),
    initialPageParam: undefined,
    queryFn: ({ pageParam, signal }) =>
      getSavedListings(
        { limit: SAVED_FEED_PAGE_SIZE, cursor: pageParam },
        signal
      ),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: isSessionReady && Boolean(session),
  });
};

// exploreKeys re-export 편의를 위해 노출(detail invalidation 필요 시 사용).
export { exploreKeys };
