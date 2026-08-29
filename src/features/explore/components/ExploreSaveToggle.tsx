import { Bookmark, BookmarkCheck } from "lucide-react";

import { Button } from "@/components/ui/button.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { useSessionQuery } from "@/hooks/useSession.ts";
import type { ExploreListingId } from "@/core/domain/ids.ts";

import {
  useExploreSaveStateQuery,
  useToggleExploreSaveMutation,
} from "../save-queries.ts";

/**
 * Explore listing 저장 toggle (RAON-254 DISC-6).
 *
 * ## 접근성
 *
 * 단일 toggle button으로 `aria-pressed`가 실제 저장 상태를 반영한다. accessible
 * name은 현재 상태에 따라 "저장"/"저장됨"으로 바뀌며(sr-only 텍스트로도 제공),
 * 아이콘은 `aria-hidden`이다. focus-visible ring과 최소 touch target은 Button
 * primitive가 보장한다.
 *
 * ## Honest state
 *
 * 실제 persisted 상태를 query로 읽고, mutation은 낙관적으로 바꾼 뒤 실패 시
 * rollback한다(실패를 `저장됨`으로 표시하지 않음). 실패하면 접근 가능한 오류
 * 메시지와 재시도(다시 누르기)를 제공한다. 저장 수/인기 지표는 노출하지 않는다.
 *
 * 비로그인/세션 미준비 시에는 toggle을 렌더하지 않는다(dead/오해 소지 CTA 금지).
 */
export function ExploreSaveToggle({
  listingId,
}: {
  readonly listingId: ExploreListingId;
}) {
  const { data: session, isSuccess: isSessionReady } = useSessionQuery();
  const state = useExploreSaveStateQuery(listingId);
  const mutation = useToggleExploreSaveMutation(listingId);

  // 로그인/세션 미준비 시 toggle 자체를 렌더하지 않는다.
  if (!isSessionReady || !session) {
    return null;
  }

  const saved = state.data?.saved ?? false;
  const isBusy = mutation.isPending;
  const hasFailed = mutation.isError;

  const handleToggle = () => {
    // 실제 저장 상태를 아직 모르면(초기 로드 중) 행동하지 않는다(unknown state에
    // 근거해 잘못된 toggle을 하지 않음). 로드가 끝나면 정상 toggle.
    if (state.isPending || isBusy) return;
    mutation.mutate({ nextSaved: !saved });
  };

  const label = saved ? "저장됨" : "저장";

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <Button
        type="button"
        variant={saved ? "secondary" : "outline"}
        size="lg"
        aria-pressed={saved}
        aria-label={label}
        disabled={isBusy || state.isPending}
        onClick={handleToggle}
        data-slot="explore-save-toggle"
        className="min-w-0"
      >
        {isBusy ? (
          <Spinner className="size-5" aria-hidden="true" />
        ) : saved ? (
          <BookmarkCheck className="size-5" aria-hidden="true" />
        ) : (
          <Bookmark className="size-5" aria-hidden="true" />
        )}
        <span>{label}</span>
      </Button>

      {hasFailed && (
        <p role="alert" className="min-w-0 text-sm text-destructive-strong">
          저장 상태를 바꾸지 못했어요. 다시 시도해주세요.
        </p>
      )}
    </div>
  );
}
