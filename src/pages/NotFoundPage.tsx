import { css } from "@emotion/react";
import { Button } from "@/components/ui/button.tsx";
import { useNavigate } from "react-router-dom";

const containerStyle = css`
  padding: max(48px, env(safe-area-inset-top, 48px)) 24px calc(32px + env(safe-area-inset-bottom, 0px));
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 70vh;
  min-height: 70dvh;
  flex: 1;
`;

const iconStyle = css`
  font-size: 48px;
  margin-bottom: 16px;
`;

const titleStyle = css`
  font-size: 22px;
  font-weight: 700;
  margin: 0 0 8px 0;
  color: var(--foreground);
`;

const descStyle = css`
  font-size: 14px;
  color: var(--foreground-subtle);
  margin: 0 0 24px 0;
  line-height: 1.5;
`;

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div css={containerStyle}>
      <div css={iconStyle}>
        🔍
      </div>
      <h1 css={titleStyle}>
        페이지를 찾을 수 없습니다
      </h1>
      <p css={descStyle}>
        요청하신 페이지가 삭제되었거나 주소가 잘못되었습니다.
      </p>
      <Button
        type="button"
        size="lg"
        onClick={() => navigate("/trips", { replace: true })}
      >
        여행 목록으로 이동
      </Button>
    </div>
  );
}
