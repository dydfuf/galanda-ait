import { css } from "@emotion/react";
import { Button } from "@/components/ui/button.tsx";
import { useParams, useNavigate } from "react-router-dom";
import { decodeRouteParams, InviteParamsSchema } from "../../app/routes/route-params.ts";
import { RouteErrorFallback } from "../common/RouteErrorFallback.tsx";
import { Result } from "effect";
import { useState } from "react";
import { useTripRoomRawQuery } from "../plan-detail/queries.ts";
import { appRuntime } from "../../app/runtime.ts";
import { joinTripRoom } from "../../core/usecases/join-room.ts";
import { getTripRoomDisplayDate } from "../../core/domain/room.ts";
import { TripIdSchema } from "../../core/domain/ids.ts";
import { useQueryClient } from "@tanstack/react-query";
import { tripRoomKeys } from "../plan-home/queries.ts";
import { toUserMessage } from "../common/error-message.ts";

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

const errorMessageStyle = css`
  font-size: 13px;
  color: var(--adaptiveRed600, #e0383e);
  margin: 12px 0 0 0;
  line-height: 1.5;
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

export function InvitePage(): JSX.Element {
  const params = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isAccepting, setIsAccepting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const validated = decodeRouteParams(InviteParamsSchema, params);
  const inviteToken = Result.isSuccess(validated) ? validated.success.inviteToken : "";
  const { data: room, isLoading, isError } = useTripRoomRawQuery(inviteToken);

  if (Result.isFailure(validated)) {
    return (
      <RouteErrorFallback
        title="유효하지 않은 초대장"
        message="초대 링크가 만료되었거나 올바르지 않습니다."
      />
    );
  }


  const handleAccept = async (): Promise<void> => {
    if (!room) return;
    setIsAccepting(true);
    setErrorMsg(null);
    try {
      await appRuntime.runPromise(
        joinTripRoom({
          roomId: TripIdSchema.make(room.id),
        })
      );
      queryClient.invalidateQueries({ queryKey: tripRoomKeys.all });
      navigate(`/trips/${room.id}/plans`, { replace: true });
    } catch (err: unknown) {
      // 비로그인·세션 조회 실패 등 참여 실패 사유를 화면에 그대로 전달한다
      setIsAccepting(false);
      setErrorMsg(toUserMessage(err, "여행방에 참여하지 못했어요. 다시 시도해주세요."));
    }
  };

  if (isLoading) {
    return (
      <div css={pageContainerStyle}>
        <p style={{ color: "var(--adaptiveGrey500, #8b95a1)" }}>초대장 정보를 확인하는 중...</p>
      </div>
    );
  }

  if (isError || !room) {
    return (
      <div css={pageContainerStyle}>
        <div css={cardStyle}>
          <span css={iconStyle}>⚠️</span>
          <h1 css={titleStyle}>여행방을 찾을 수 없어요</h1>
          <p css={descriptionStyle}>
            초대 링크의 여행방이 이미 삭제되었거나 존재하지 않습니다.
          </p>
          <Button
            type="button"
            size="lg"
            className="w-full"
            onClick={() => navigate("/trips", { replace: true })}
          >
            내 여행 목록으로 가기
          </Button>
        </div>
      </div>
    );
  }

  const hostName = room.members[0]?.name ?? "호스트";

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
          <strong>{hostName}</strong>님이 <strong>{room.title}</strong>에<br />
          함께하자고 초대장을 보냈습니다.
        </p>

        <div css={summaryBoxStyle}>
          <div css={summaryRowStyle}>
            <span css={summaryLabelStyle}>목적지: </span>{room.destination}
          </div>
          <div css={summaryRowStyle}>
            <span css={summaryLabelStyle}>일정: </span>{(() => { const range = getTripRoomDisplayDate(room); return range ? `${range.startDate} ~ ${range.endDate}` : "일정 미정"; })()}
          </div>
          <div>
            <span css={summaryLabelStyle}>참여 인원: </span>
            <code css={codeStyle}>
              {room.members.length}명 참여 중
            </code>
          </div>
        </div>

        <Button
          type="button"
          size="xl"
          className="w-full"
          disabled={isAccepting}
          onClick={handleAccept}
        >
          {isAccepting ? "참여하는 중..." : "초대 수락하고 참여하기"}
        </Button>

        {errorMsg && (
          <p css={errorMessageStyle} role="alert">
            {errorMsg}
          </p>
        )}
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
