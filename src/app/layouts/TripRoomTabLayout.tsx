import { css } from "@emotion/react";
import { Tab, TopNavigation, TopNavigationBackButton, TopNavigationTextButton } from "@toss/tds-mobile";
import { Outlet, useParams, useLocation, useNavigate } from "react-router-dom";
import { decodeRouteParams, TripParamsSchema } from "../routes/route-params.ts";
import { RouteErrorFallback } from "../../features/common/RouteErrorFallback.tsx";
import { Result } from "effect";
import { useAppNavigation } from "../../hooks/useAppNavigation.ts";

const containerStyle = css`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  min-height: 100dvh;
  flex: 1;
`;

const headerStyle = css`
  position: sticky;
  top: 0;
  z-index: 20;
  background-color: var(--adaptiveBackground, #ffffff);
  border-bottom: 1px solid var(--adaptiveGrey200, #e5e8eb);
`;

const tabContainerStyle = css`
  padding: 0 8px;
`;

const mainStyle = css`
  flex: 1;
  display: flex;
  flex-direction: column;
`;

/** 탭 순서는 아래 Tab.Item 렌더링 순서와 같아야 해요. */
const TAB_PATHS = ["plans", "itinerary"] as const;

export function TripRoomTabLayout() {
  const params = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { goBack } = useAppNavigation();

  const validated = decodeRouteParams(TripParamsSchema, params);
  if (Result.isFailure(validated)) {
    return <RouteErrorFallback message="유효하지 않은 여행방 식별자입니다." />;
  }

  const { tripId } = validated.success;
  const isItineraryTab = location.pathname.endsWith("/itinerary");
  const selectedTabIndex = isItineraryTab ? 1 : 0;

  const handleShareInvite = () => {
    const inviteUrl = `${window.location.origin}/invites/invite-${tripId}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(inviteUrl);
      alert("초대 링크가 클립보드에 복사되었습니다!\n" + inviteUrl);
    } else {
      alert("초대 링크:\n" + inviteUrl);
    }
  };

  const handleTabChange = (index: number) => {
    const nextPath = TAB_PATHS[index] ?? TAB_PATHS[0];
    navigate(`/trips/${tripId}/${nextPath}`, { replace: true });
  };

  return (
    <div css={containerStyle}>
      {/* 상단 내비게이션 (TDS TopNavigation) */}
      <header css={headerStyle}>
        <TopNavigation
          background="transparent"
          leading={<TopNavigationBackButton aria-label="뒤로 가기" onClick={goBack} />}
          content="여행방"
          trailing={
            <TopNavigationTextButton onClick={handleShareInvite}>초대하기</TopNavigationTextButton>
          }
        />

        {/* 탭 내비게이션 (계획 | 일정) */}
        <div css={tabContainerStyle}>
          <Tab ariaLabel="여행방 화면" onChange={handleTabChange}>
            <Tab.Item selected={selectedTabIndex === 0}>계획</Tab.Item>
            <Tab.Item selected={selectedTabIndex === 1}>일정</Tab.Item>
          </Tab>
        </div>
      </header>

      {/* 탭 내부 페이지 렌더링 */}
      <main css={mainStyle}>
        <Outlet context={{ tripId }} />
      </main>
    </div>
  );
}
