import { Navigate, Outlet, useLocation } from "react-router-dom";
import { PageState } from "@/components/galanda/page-state.tsx";
import { useSessionQuery } from "@/hooks/useSession.ts";
import { toUserMessage } from "@/features/common/error-message.ts";
import { getSessionRedirect } from "@/platform/auth.ts";

export function SessionRoute({ registered = false }: { registered?: boolean }) {
  const location = useLocation();
  const { data: session, isPending, isError, error, refetch } = useSessionQuery();

  if (isPending) {
    return <PageState status="loading" message="로그인 정보를 확인하는 중이에요." />;
  }
  if (isError) {
    return (
      <PageState
        status="error"
        title="로그인 정보를 확인할 수 없어요"
        description={toUserMessage(error, "잠시 후 다시 시도해주세요.")}
        actionText="다시 시도"
        onAction={() => void refetch()}
      />
    );
  }

  const returnTo = `${location.pathname}${location.search}${location.hash}`;
  const redirectTo = getSessionRedirect(session, returnTo, registered);
  if (redirectTo) return <Navigate to={redirectTo} replace />;

  return <Outlet />;
}
