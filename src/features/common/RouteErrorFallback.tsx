import { useNavigate } from "react-router-dom";
import { PageState } from "@/components/galanda/page-state.tsx";

interface RouteErrorFallbackProps {
  title?: string;
  message?: string;
  actionText?: string;
  onAction?: () => void;
}

const DEFAULT_TITLE = "접근할 수 없는 페이지입니다";
const DEFAULT_MESSAGE = "요청하신 경로가 올바르지 않거나 변경되었습니다.";
const DEFAULT_ACTION_TEXT = "여행 목록으로 이동";

export function RouteErrorFallback({
  title,
  message,
  actionText,
  onAction,
}: RouteErrorFallbackProps) {
  const navigate = useNavigate();

  // 빈 문자열로 상태 안내나 action의 accessible name이 사라지지 않게 한다.
  const resolvedTitle = title?.trim() ? title : DEFAULT_TITLE;
  const resolvedMessage = message?.trim() ? message : DEFAULT_MESSAGE;
  const resolvedActionText = actionText?.trim()
    ? actionText
    : DEFAULT_ACTION_TEXT;

  const handleAction = () => {
    if (onAction) {
      onAction();
    } else {
      navigate("/trips", { replace: true });
    }
  };

  return (
    <PageState
      status="error"
      title={resolvedTitle}
      description={resolvedMessage}
      actionText={resolvedActionText}
      onAction={handleAction}
    />
  );
}
