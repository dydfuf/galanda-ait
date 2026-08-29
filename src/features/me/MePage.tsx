import { Link } from "react-router-dom";

import { PageBody } from "@/components/galanda/page-body.tsx";
import { PageTitle } from "@/components/galanda/page-title.tsx";
import { PageState } from "@/components/galanda/page-state.tsx";
import { useSessionQuery } from "@/hooks/useSession.ts";
import { toUserMessage } from "@/features/common/error-message.ts";

/**
 * My(마이) destination (RAON-248 / Goal 13).
 *
 * Global 탐색의 마이 목적지. 지금은 로그인한 사용자의 표시 이름만 정직하게 보여주는
 * minimal surface다. Goal 14 UI가 확장할 자리를 남겨두되, 존재하지 않는 통계·배지·
 * 활동 내역 같은 fake data를 만들지 않는다.
 */
export function MePage() {
  const { data: session, isPending, isError, error, refetch } =
    useSessionQuery();

  if (isPending) {
    return (
      <PageBody safeTop>
        <PageState status="loading" message="내 정보를 불러오는 중이에요." />
      </PageBody>
    );
  }

  if (isError) {
    return (
      <PageBody safeTop>
        <PageState
          status="error"
          title="내 정보를 확인할 수 없어요"
          description={toUserMessage(error, "잠시 후 다시 시도해주세요.")}
          actionText="다시 시도"
          onAction={() => void refetch()}
        />
      </PageBody>
    );
  }

  return (
    <PageBody safeTop>
      <PageTitle
        title="마이"
        description={
          session?.name
            ? `${session.name}님으로 이용 중이에요.`
            : "내 계정 정보를 여기에서 관리해요."
        }
      />
      <nav className="flex flex-col gap-2 px-(--app-inline-padding)" aria-label="마이 메뉴">
        <Link
          to="/me/saved"
          className="flex min-h-(--touch-target-min) min-w-0 items-center rounded-xl border border-border bg-card px-4 py-3 text-base font-medium text-foreground transition-colors hover:bg-surface-content focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          저장한 여행 일정
        </Link>
      </nav>
    </PageBody>
  );
}
