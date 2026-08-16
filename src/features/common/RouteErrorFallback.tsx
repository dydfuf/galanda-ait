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

export function RouteErrorFallback({
  title = "접근할 수 없는 페이지입니다",
  message = "요청하신 경로가 올바르지 않거나 변경되었습니다.",
  actionText = "여행 목록으로 이동",
  onAction,
}: RouteErrorFallbackProps) {
  const navigate = useNavigate();

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
        {title}
      </h2>
      <p css={messageStyle}>
        {message}
      </p>
      <Button size="medium" type="button" onClick={handleAction}>
        {actionText}
      </Button>
    </div>
  );
}
