import { css } from "@emotion/react";
import { Button } from "@toss/tds-mobile";
import { useNavigate } from "react-router-dom";
import { useTripRoomsQuery } from "../plan-home/queries.ts";

const pageContainerStyle = css`
  padding: max(20px, env(safe-area-inset-top, 20px)) 20px calc(40px + env(safe-area-inset-bottom, 0px));
`;

const pageHeaderStyle = css`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 24px;
`;

const pageTitleStyle = css`
  font-size: 22px;
  font-weight: 700;
  margin: 0 0 4px 0;
  color: var(--adaptiveGrey900, #191f28);
`;

const pageSubtitleStyle = css`
  font-size: 13px;
  color: var(--adaptiveGrey500, #8b95a1);
  margin: 0;
`;

const loadingContainerStyle = css`
  padding: 48px 20px;
  text-align: center;
`;

const loadingTextStyle = css`
  color: var(--adaptiveGrey500, #8b95a1);
  font-size: 14px;
`;

const errorContainerStyle = css`
  padding: 32px 20px;
  text-align: center;
`;

const errorTextStyle = css`
  color: var(--adaptiveRed500, #f04452);
  font-size: 14px;
`;

const listStackStyle = css`
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

const emptyCardStyle = css`
  background-color: var(--adaptiveBackground, #ffffff);
  border-radius: 16px;
  padding: 48px 20px;
  text-align: center;
  border: 1px solid var(--adaptiveGrey200, #e5e8eb);
`;

const emptyIconStyle = css`
  font-size: 36px;
  margin-bottom: 12px;
`;

const emptyTitleStyle = css`
  color: var(--adaptiveGrey900, #191f28);
  font-size: 16px;
  font-weight: 700;
  margin: 0 0 6px 0;
`;

const emptyDescStyle = css`
  color: var(--adaptiveGrey500, #8b95a1);
  font-size: 13px;
  margin: 0 0 20px 0;
`;

const roomCardStyle = css`
  background-color: var(--adaptiveBackground, #ffffff);
  border-radius: 16px;
  padding: 18px 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  border: 1px solid var(--adaptiveGrey200, #e5e8eb);
  cursor: pointer;
  transition: transform 0.12s ease, box-shadow 0.12s ease;
  display: flex;
  flex-direction: column;
  gap: 10px;

  &:active {
    transform: scale(0.985);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.02);
  }
`;

const roomHeaderStyle = css`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const destinationBadgeStyle = css`
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 700;
  background-color: var(--adaptiveBlue50, #e8f3ff);
  color: var(--adaptiveBlue600, #1b64da);
`;

const memberCountTextStyle = css`
  font-size: 12px;
  color: var(--adaptiveGrey500, #8b95a1);
`;

const roomTitleTextStyle = css`
  font-size: 17px;
  font-weight: 700;
  margin: 0 0 4px 0;
  color: var(--adaptiveGrey900, #191f28);
`;

const roomPeriodTextStyle = css`
  font-size: 13px;
  color: var(--adaptiveGrey500, #8b95a1);
  margin: 0;
`;

const confirmedPlanBoxStyle = css`
  padding: 8px 12px;
  border-radius: 8px;
  background-color: var(--adaptiveGreen50, #f0fbf4);
  color: var(--adaptiveGreen600, #15803d);
  font-size: 12px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 4px;
`;

const unconfirmedPlanBoxStyle = css`
  padding: 8px 12px;
  border-radius: 8px;
  background-color: var(--adaptiveGrey50, #f9fafb);
  color: var(--adaptiveGrey700, #4e5968);
  font-size: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const adjustLinkStyle = css`
  color: var(--adaptiveBlue500, #3182f6);
  font-weight: 600;
`;

export function TripListPage() {
  const navigate = useNavigate();
  const { data: rooms, isLoading, isError, error } = useTripRoomsQuery();

  return (
    <div css={pageContainerStyle}>
      <header css={pageHeaderStyle}>
        <div>
          <h1 css={pageTitleStyle}>
            내 여행 목록
          </h1>
          <p css={pageSubtitleStyle}>
            친구들과 함께 계획 중인 여행을 확인하세요.
          </p>
        </div>

        <Button size="small" type="button" onClick={() => navigate("/trips/new")}>
          + 여행 만들기
        </Button>
      </header>

      {isLoading && (
        <div css={loadingContainerStyle}>
          <p css={loadingTextStyle}>여행 목록을 불러오는 중...</p>
        </div>
      )}

      {isError && (
        <div css={errorContainerStyle}>
          <p css={errorTextStyle}>
            오류가 발생했습니다: {error instanceof Error ? error.message : "알 수 없는 오류"}
          </p>
        </div>
      )}

      {rooms && (
        <div css={listStackStyle}>
          {rooms.length === 0 ? (
            <div css={emptyCardStyle}>
              <div css={emptyIconStyle}>✈️</div>
              <p css={emptyTitleStyle}>
                참여 중인 여행이 없습니다
              </p>
              <p css={emptyDescStyle}>
                새로운 여행방을 만들고 친구들을 초대해보세요.
              </p>
              <Button size="medium" type="button" onClick={() => navigate("/trips/new")}>
                첫 여행방 만들기
              </Button>
            </div>
          ) : (
            rooms.map((room) => (
              <div
                key={room.id}
                onClick={() => navigate(`/trips/${room.id}`)}
                css={roomCardStyle}
              >
                <div css={roomHeaderStyle}>
                  <span css={destinationBadgeStyle}>
                    {room.destination}
                  </span>
                  <span css={memberCountTextStyle}>
                    참여 {room.memberCount}명
                  </span>
                </div>

                <div>
                  <h2 css={roomTitleTextStyle}>
                    {room.title}
                  </h2>
                  <p css={roomPeriodTextStyle}>
                    {room.period} · {room.memberNames}
                  </p>
                </div>

                {room.confirmedPlanTitle ? (
                  <div css={confirmedPlanBoxStyle}>
                    <span>✓ 확정된 일정:</span>
                    <span>{room.confirmedPlanTitle}</span>
                  </div>
                ) : (
                  <div css={unconfirmedPlanBoxStyle}>
                    <span>후보 여행안 {room.plans.length}개 조율 중</span>
                    <span css={adjustLinkStyle}>조율하기 →</span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
