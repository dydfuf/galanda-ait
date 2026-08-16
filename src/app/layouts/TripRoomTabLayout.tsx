import { css } from "@emotion/react";
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
  padding: max(8px, env(safe-area-inset-top, 8px)) 16px 0;
`;

const topRowStyle = css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 44px;
`;

const backButtonStyle = css`
  background: none;
  border: none;
  padding: 8px 6px;
  cursor: pointer;
  font-size: 15px;
  color: var(--adaptiveGrey800, #333d4b);
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  border-radius: 8px;
  transition: opacity 0.15s ease, background-color 0.15s ease;

  &:active {
    opacity: 0.7;
    background-color: var(--adaptiveGrey100, #f2f4f6);
  }
`;

const titleStyle = css`
  font-size: 17px;
  font-weight: 700;
  color: var(--adaptiveGrey900, #191f28);
`;

const inviteButtonStyle = css`
  background: none;
  border: none;
  padding: 8px 10px;
  cursor: pointer;
  font-size: 14px;
  color: var(--adaptiveBlue500, #3182f6);
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  border-radius: 8px;
  transition: opacity 0.15s ease, background-color 0.15s ease;

  &:active {
    opacity: 0.7;
    background-color: var(--adaptiveBlue50, #e8f3ff);
  }
`;

const tabContainerStyle = css`
  display: flex;
  gap: 8px;
  margin-top: 4px;
`;

const tabButtonStyle = (isActive: boolean) => css`
  flex: 1;
  padding: 12px 0;
  text-align: center;
  background: none;
  border: none;
  border-bottom: ${isActive ? "3px solid var(--adaptiveBlue500, #3182f6)" : "3px solid transparent"};
  font-weight: ${isActive ? 700 : 500};
  color: ${isActive ? "var(--adaptiveBlue500, #3182f6)" : "var(--adaptiveGrey500, #8b95a1)"};
  font-size: 15px;
  cursor: pointer;
  transition: color 0.15s ease, border-color 0.15s ease;

  &:active {
    opacity: 0.75;
  }
`;

const mainStyle = css`
  flex: 1;
  display: flex;
  flex-direction: column;
`;

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
  const isPlansTab = location.pathname.endsWith("/plans");
  const isItineraryTab = location.pathname.endsWith("/itinerary");

  const handleShareInvite = () => {
    const inviteUrl = `${window.location.origin}/invites/invite-${tripId}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(inviteUrl);
      alert("초대 링크가 클립보드에 복사되었습니다!\n" + inviteUrl);
    } else {
      alert("초대 링크:\n" + inviteUrl);
    }
  };

  return (
    <div css={containerStyle}>
      {/* 상단 네비게이션 헤더 */}
      <header css={headerStyle}>
        <div css={topRowStyle}>
          <button type="button" onClick={goBack} css={backButtonStyle}>
            ← 뒤로
          </button>

          <span css={titleStyle}>여행방</span>

          <button type="button" onClick={handleShareInvite} css={inviteButtonStyle}>
            초대하기
          </button>
        </div>

        {/* 탭 네비게이션 (계획 | 일정) */}
        <div css={tabContainerStyle}>
          <button
            type="button"
            onClick={() => navigate(`/trips/${tripId}/plans`, { replace: true })}
            css={tabButtonStyle(isPlansTab)}
          >
            계획
          </button>
          <button
            type="button"
            onClick={() => navigate(`/trips/${tripId}/itinerary`, { replace: true })}
            css={tabButtonStyle(isItineraryTab)}
          >
            일정
          </button>
        </div>
      </header>

      {/* 탭 내부 페이지 렌더링 */}
      <main css={mainStyle}>
        <Outlet context={{ tripId }} />
      </main>
    </div>
  );
}
