import { useMutation, useQueryClient } from "@tanstack/react-query";

import { importExplorePlan } from "../../app/api-client.ts";
import type { ExploreListingId } from "../../core/domain/ids.ts";
import type {
  ImportExplorePlanRequest,
  ImportExplorePlanResponse,
} from "../../contracts/explore.ts";
import { tripRoomKeys } from "../plan-home/queries.ts";

/**
 * Explore snapshot import mutation (RAON-262 DISC-8).
 *
 * ## Atomic truth (no optimistic success)
 *
 * import API는 원자적 진실이다. 성공을 낙관적으로 표시하지 않으며, 화면은
 * `mutateAsync`가 resolve된 뒤에만 성공 처리(navigate/announce)한다. 실패하면
 * 어떤 성공 상태도 만들지 않는다(navigate 없음).
 *
 * ## Cache invalidation before success
 *
 * imported plan이 즉시 `/trips`(list)와 `/trips/:tripId`(detail)에 보이도록,
 * 성공 시 모든 `tripRoomKeys.all` query를 invalidate하고 **await**한다.
 * `onSuccess`가 반환한 Promise를 react-query가 기다리므로, `mutateAsync`는 캐시
 * 무효화가 끝난 뒤에야 resolve된다 → 호출 화면은 navigate 전에 list/detail이
 * 최신 상태를 보게 된다.
 */
export const useImportExplorePlanMutation = (listingId: ExploreListingId) => {
  const queryClient = useQueryClient();

  return useMutation<
    ImportExplorePlanResponse,
    Error,
    ImportExplorePlanRequest["target"]
  >({
    mutationFn: (target) => importExplorePlan(listingId, target),
    onSuccess: async () => {
      // navigate 전에 반드시 최신화한다. 모든 trip-rooms query(list + 모든 detail)를
      // invalidate하고 완료를 기다린다(atomic API가 진실이므로 낙관적 처리 금지).
      await queryClient.invalidateQueries({ queryKey: tripRoomKeys.all });
    },
  });
};
