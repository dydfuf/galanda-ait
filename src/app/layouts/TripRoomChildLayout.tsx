import { css } from "@emotion/react";
import { Outlet, useParams } from "react-router-dom";
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
  padding: max(8px, env(safe-area-inset-top, 8px)) 16px 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 52px;
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
  min-width: 60px;
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
  text-align: center;
  flex: 1;
`;

const spacerStyle = css`
  min-width: 60px;
`;

const mainStyle = css`
  flex: 1;
  display: flex;
  flex-direction: column;
`;

export function TripRoomChildLayout() {
  const params = useParams();
  const { goBack } = useAppNavigation();

  const validated = decodeRouteParams(TripParamsSchema, params);
  if (Result.isFailure(validated)) {
    return <RouteErrorFallback message="유효하지 않은 여행방 식별자입니다." />;
  }

  const { tripId } = validated.success;

  return (
    <div css={containerStyle}>
      {/* 서브페이지 상단 헤더 */}
      <header css={headerStyle}>
        <button type="button" onClick={goBack} css={backButtonStyle}>
          ← 뒤로
        </button>
        <span css={titleStyle}>여행 계획</span>
        <div css={spacerStyle} />
      </header>

      <main css={mainStyle}>
        <Outlet context={{ tripId }} />
      </main>
    </div>
  );
}
