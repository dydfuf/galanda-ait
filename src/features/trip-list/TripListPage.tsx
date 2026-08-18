import { useState } from "react";
import { css } from "@emotion/react";
import { Button } from "@toss/tds-mobile";
import { useNavigate } from "react-router-dom";
import { useTripRoomsQuery } from "../plan-home/queries.ts";
import type { TripRoomViewModel } from "../plan-home/plan-home-view-model.ts";

const pageContainerStyle = css`
  padding: max(16px, env(safe-area-inset-top, 16px)) 20px calc(96px + env(safe-area-inset-bottom, 0px));
  max-width: 600px;
  margin: 0 auto;
  min-height: 100vh;
  box-sizing: border-box;
`;

const pageHeaderStyle = css`
  margin-bottom: 20px;
`;

const pageTitleStyle = css`
  font-size: 22px;
  font-weight: 700;
  margin: 0 0 6px 0;
  color: var(--adaptiveGrey900, #191f28);
  letter-spacing: -0.4px;
`;

const pageSubtitleStyle = css`
  font-size: 13px;
  color: var(--adaptiveGrey600, #6b7684);
  margin: 0;
`;

const tabSegmentContainerStyle = css`
  display: flex;
  background-color: var(--adaptiveGrey100, #f2f4f6);
  border-radius: 10px;
  padding: 3px;
  margin-bottom: 20px;
`;

const tabSegmentButtonStyle = (isActive: boolean) => css`
  flex: 1;
  padding: 8px 0;
  font-size: 13px;
  font-weight: ${isActive ? 700 : 500};
  color: ${isActive ? "var(--adaptiveGrey900, #191f28)" : "var(--adaptiveGrey600, #6b7684)"};
  background-color: ${isActive ? "var(--adaptiveBackground, #ffffff)" : "transparent"};
  border: none;
  border-radius: 8px;
  cursor: pointer;
  box-shadow: ${isActive ? "0 1px 3px rgba(0,0,0,0.08)" : "none"};
  transition: all 0.15s ease;
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
  gap: 16px;
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
  border: 1px solid var(--adaptiveGrey200, #e5e8eb);
  cursor: pointer;
  transition: transform 0.12s ease, box-shadow 0.12s ease;
  display: flex;
  flex-direction: column;
  gap: 12px;

  &:active {
    transform: scale(0.985);
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
  background-color: var(--adaptiveGrey100, #f2f4f6);
  color: var(--adaptiveGrey800, #333d4b);
`;

const memberCountTextStyle = css`
  font-size: 12px;
  color: var(--adaptiveGrey500, #8b95a1);
`;

const roomTitleTextStyle = css`
  font-size: 18px;
  font-weight: 700;
  margin: 0 0 4px 0;
  color: var(--adaptiveGrey900, #191f28);
`;

const roomPeriodTextStyle = css`
  font-size: 13px;
  color: var(--adaptiveGrey600, #6b7684);
  margin: 0;
`;

// TR-01 시안 3의 핵심: 옅은 파란 면의 다음 행동/맥락 박스
const nextActionBoxStyle = css`
  padding: 12px 14px;
  border-radius: 10px;
  background-color: var(--adaptiveBlue50, #e8f3ff);
  color: var(--adaptiveBlue700, #1b64da);
  font-size: 13px;
  font-weight: 600;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  transition: background-color 0.12s ease;

  &:hover {
    background-color: #dbeafe;
  }
`;

const nextActionLabelStyle = css`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const nextActionArrowStyle = css`
  font-weight: 700;
  color: var(--adaptiveBlue600, #1b64da);
`;

const confirmedActionBoxStyle = css`
  padding: 12px 14px;
  border-radius: 10px;
  background-color: var(--adaptiveGreen50, #f0fbf4);
  color: var(--adaptiveGreen700, #15803d);
  font-size: 13px;
  font-weight: 600;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const fixedCtaContainerStyle = css`
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  max-width: 600px;
  margin: 0 auto;
  background-color: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-top: 1px solid var(--adaptiveGrey200, #e5e8eb);
  padding: 12px 20px calc(14px + env(safe-area-inset-bottom, 0px));
  z-index: 30;
  box-sizing: border-box;
`;

export function TripListPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"ONGOING" | "PAST">("ONGOING");
  const { data: rooms, isLoading, isError, error } = useTripRoomsQuery();

  const getNextAction = (room: TripRoomViewModel) => {
    if (room.confirmedPlanTitle) {
      return {
        text: `✓ 확정된 일정: ${room.confirmedPlanTitle}`,
        actionText: "일정 확인하기",
        path: `/trips/${room.id}/itinerary`,
        isConfirmed: true,
      };
    }
    if (room.plans.length >= 2) {
      return {
        text: `후보 여행안 ${room.plans.length}개 조율 중`,
        actionText: "여행안 비교하기",
        path: `/trips/${room.id}/plans/compare?left=${room.plans[0].id}&right=${room.plans[1].id}`,
        isConfirmed: false,
      };
    }
    if (room.plans.length === 1) {
      return {
        text: `제안된 여행안: ${room.plans[0].title}`,
        actionText: "의견 남기기",
        path: `/trips/${room.id}/plans/${room.plans[0].id}`,
        isConfirmed: false,
      };
    }
    return {
      text: "첫 여행안을 만들어보세요",
      actionText: "여행안 만들기",
      path: `/trips/${room.id}/plans/new`,
      isConfirmed: false,
    };
  };

  // 진행 중인 여행 / 지난 여행 필터링 (기획 명세 기준)
  const now = new Date();
  const ongoingRooms = rooms?.filter((r) => {
    if (!r.endDate) return true;
    const end = new Date(r.endDate);
    return end >= now || isNaN(end.getTime());
  }) ?? [];

  const pastRooms = rooms?.filter((r) => {
    if (!r.endDate) return false;
    const end = new Date(r.endDate);
    return end < now && !isNaN(end.getTime());
  }) ?? [];

  const displayRooms = activeTab === "ONGOING" ? ongoingRooms : pastRooms;

  return (
    <div css={pageContainerStyle}>
      <header css={pageHeaderStyle}>
        <h1 css={pageTitleStyle}>내 여행 목록</h1>
        <p css={pageSubtitleStyle}>참여 중인 여행을 확인하고 새 여행을 시작하세요.</p>
      </header>

      {/* 세그먼트 탭: 진행 중인 여행 / 지난 여행 */}
      <div css={tabSegmentContainerStyle}>
        <button
          type="button"
          onClick={() => setActiveTab("ONGOING")}
          css={tabSegmentButtonStyle(activeTab === "ONGOING")}
        >
          진행 중인 여행 ({ongoingRooms.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("PAST")}
          css={tabSegmentButtonStyle(activeTab === "PAST")}
        >
          지난 여행 ({pastRooms.length})
        </button>
      </div>

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
          {displayRooms.length === 0 ? (
            <div css={emptyCardStyle}>
              <div css={emptyIconStyle}>✈️</div>
              <p css={emptyTitleStyle}>
                {activeTab === "ONGOING" ? "진행 중인 여행이 없습니다" : "지난 여행 기록이 없습니다"}
              </p>
              <p css={emptyDescStyle}>
                {activeTab === "ONGOING"
                  ? "새로운 여행방을 만들고 친구들을 초대해보세요."
                  : "다녀온 여행 기록이 이곳에 보관됩니다."}
              </p>
              {activeTab === "ONGOING" && (
                <Button size="medium" type="button" onClick={() => navigate("/trips/new")}>
                  새 여행 만들기
                </Button>
              )}
            </div>
          ) : (
            displayRooms.map((room) => {
              const nextAction = getNextAction(room);

              return (
                <div
                  key={room.id}
                  onClick={() => navigate(`/trips/${room.id}`)}
                  css={roomCardStyle}
                >
                  <div css={roomHeaderStyle}>
                    <span css={destinationBadgeStyle}>📍 {room.destination}</span>
                    <span css={memberCountTextStyle}>참여 {room.memberCount}명</span>
                  </div>

                  <div>
                    <h2 css={roomTitleTextStyle}>{room.title}</h2>
                    <p css={roomPeriodTextStyle}>
                      {room.period} · {room.memberNames}
                    </p>
                  </div>

                  {/* TR-01 시안 3 핵심: 옅은 파란 면의 행동 지점 */}
                  {nextAction.isConfirmed ? (
                    <div
                      css={confirmedActionBoxStyle}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(nextAction.path);
                      }}
                    >
                      <span css={nextActionLabelStyle}>{nextAction.text}</span>
                      <span css={nextActionArrowStyle}>→</span>
                    </div>
                  ) : (
                    <div
                      css={nextActionBoxStyle}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(nextAction.path);
                      }}
                    >
                      <span css={nextActionLabelStyle}>
                        <span>💡</span>
                        <span>{nextAction.text}</span>
                      </span>
                      <span css={nextActionArrowStyle}>{nextAction.actionText} →</span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TR-01 시안 3 고정 하단 CTA */}
      <div css={fixedCtaContainerStyle}>
        <Button
          display="block"
          size="large"
          type="button"
          onClick={() => navigate("/trips/new")}
        >
          새 여행 만들기
        </Button>
      </div>
    </div>
  );
}
