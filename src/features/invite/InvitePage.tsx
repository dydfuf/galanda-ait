import { css } from "@emotion/react";
import { Button } from "@toss/tds-mobile";
import { useParams, useNavigate } from "react-router-dom";
import { decodeRouteParams, InviteParamsSchema } from "../../app/routes/route-params.ts";
import { RouteErrorFallback } from "../common/RouteErrorFallback.tsx";
import { Result } from "effect";
import { useState } from "react";

const pageContainerStyle = css`
  padding: max(24px, env(safe-area-inset-top, 24px)) 20px calc(32px + env(safe-area-inset-bottom, 0px));
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 80vh;
  min-height: 80dvh;
  flex: 1;
`;

const cardStyle = css`
  background-color: var(--adaptiveBackground, #ffffff);
  border-radius: 20px;
  padding: 32px 24px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
  border: 1px solid var(--adaptiveGrey200, #e5e8eb);
  max-width: 400px;
  width: 100%;
  text-align: center;
  box-sizing: border-box;
`;

const iconStyle = css`
  display: inline-block;
  font-size: 36px;
  margin-bottom: 16px;
`;

const titleStyle = css`
  font-size: 20px;
  font-weight: 700;
  margin: 0 0 8px 0;
  color: var(--adaptiveGrey900, #191f28);
`;

const descriptionStyle = css`
  font-size: 14px;
  color: var(--adaptiveGrey600, #6b7684);
  margin: 0 0 24px 0;
  line-height: 1.5;
`;

const summaryBoxStyle = css`
  background-color: var(--adaptiveGrey50, #f9fafb);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 24px;
  text-align: left;
  font-size: 13px;
  color: var(--adaptiveGrey700, #4e5968);
  border: 1px solid var(--adaptiveGrey100, #f2f4f6);
`;

const summaryRowStyle = css`
  margin-bottom: 6px;
`;

const summaryLabelStyle = css`
  color: var(--adaptiveGrey500, #8b95a1);
`;

const codeStyle = css`
  font-size: 12px;
  background-color: var(--adaptiveGrey100, #eceef0);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: inherit;
  font-weight: 600;
`;

const backHomeLinkStyle = css`
  margin-top: 16px;
  background: none;
  border: none;
  font-size: 13px;
  color: var(--adaptiveGrey500, #8b95a1);
  cursor: pointer;
  padding: 6px 10px;

  &:hover {
    color: var(--adaptiveGrey800, #333d4b);
  }
`;

export function InvitePage() {
  const params = useParams();
  const navigate = useNavigate();
  const [isAccepting, setIsAccepting] = useState(false);

  const validated = decodeRouteParams(InviteParamsSchema, params);
  if (Result.isFailure(validated)) {
    return (
      <RouteErrorFallback
        title="유효하지 않은 초대장"
        message="초대 링크가 만료되었거나 올바르지 않습니다."
      />
    );
  }

  const { inviteToken } = validated.success;

  const handleAccept = () => {
    setIsAccepting(true);
    setTimeout(() => {
      setIsAccepting(false);
      // Mock: 참여 완료 후 해당 여행방으로 이동
      navigate("/trips/room-1", { replace: true });
    }, 600);
  };

  return (
    <div css={pageContainerStyle}>
      <div css={cardStyle}>
        <span css={iconStyle}>
          💌
        </span>
        <h1 css={titleStyle}>
          여행에 초대받았어요!
        </h1>
        <p css={descriptionStyle}>
          <strong>민수</strong>님이 <strong>2026 제주 힐링 여행</strong>에<br />
          함께하자고 초대장을 보냈습니다.
        </p>

        <div css={summaryBoxStyle}>
          <div css={summaryRowStyle}>
            <span css={summaryLabelStyle}>목적지: </span>제주도
          </div>
          <div css={summaryRowStyle}>
            <span css={summaryLabelStyle}>일정: </span>2026.09.12 ~ 09.15
          </div>
          <div>
            <span css={summaryLabelStyle}>초대 코드: </span>
            <code css={codeStyle}>
              {inviteToken}
            </code>
          </div>
        </div>

        <Button
          display="block"
          size="large"
          type="button"
          disabled={isAccepting}
          onClick={handleAccept}
        >
          {isAccepting ? "참여하는 중..." : "초대 수락하고 참여하기"}
        </Button>
      </div>

      <button
        type="button"
        onClick={() => navigate("/trips", { replace: true })}
        css={backHomeLinkStyle}
      >
        ← 내 여행 목록으로 돌아가기
      </button>
    </div>
  );
}
