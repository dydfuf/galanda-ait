import { css } from "@emotion/react";
import { Button } from "@toss/tds-mobile";
import { useNavigate } from "react-router-dom";

interface RouteErrorFallbackProps {
  title?: string;
  message?: string;
  actionText?: string;
  onAction?: () => void;
}

const containerStyle = css`
  padding: 48px 24px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 50vh;
  min-height: 50dvh;
  flex: 1;
`;

const iconBoxStyle = css`
  width: 56px;
  height: 56px;
  border-radius: 28px;
  background-color: var(--adaptiveRed50, #fdf2f3);
  color: var(--adaptiveRed500, #f04452);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 16px;
`;

const titleStyle = css`
  font-size: 20px;
  font-weight: 700;
  margin: 0 0 8px 0;
  color: var(--adaptiveGrey900, #191f28);
`;

const messageStyle = css`
  font-size: 14px;
  color: var(--adaptiveGrey500, #8b95a1);
  margin: 0 0 24px 0;
  line-height: 1.5;
`;

const DEFAULT_TITLE = "접근할 수 없는 페이지입니다";
const DEFAULT_MESSAGE = "요청하신 경로가 올바르지 않거나 변경되었습니다.";

export function RouteErrorFallback({
  title,
  message,
  actionText = "여행 목록으로 이동",
  onAction,
}: RouteErrorFallbackProps) {
  const navigate = useNavigate();

  // 빈 문자열이 전달돼도 안내 문구가 사라지지 않도록 기본값으로 대체한다
  const resolvedTitle = title?.trim() ? title : DEFAULT_TITLE;
  const resolvedMessage = message?.trim() ? message : DEFAULT_MESSAGE;

  const handleAction = () => {
    if (onAction) {
      onAction();
    } else {
      navigate("/trips", { replace: true });
    }
  };

  return (
    <div css={containerStyle}>
      <div css={iconBoxStyle}>
        !
      </div>
      <h2 css={titleStyle}>
        {resolvedTitle}
      </h2>
      <p css={messageStyle}>
        {resolvedMessage}
      </p>
      <Button size="medium" type="button" onClick={handleAction}>
        {actionText}
      </Button>
    </div>
  );
}
