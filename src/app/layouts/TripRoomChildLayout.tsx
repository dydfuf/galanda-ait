import { css } from "@emotion/react";
import { TopNavigation, TopNavigationBackButton } from "@toss/tds-mobile";
import { Outlet, useParams, useLocation } from "react-router-dom";
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

const mainStyle = css`
  flex: 1;
  display: flex;
  flex-direction: column;
`;

/** 현재 경로에 맞는 상단 내비게이션 제목을 정해요. */
function resolveTitle(pathname: string): string {
  if (pathname.includes("/plans/new")) {
    return "새 여행안";
  }
  if (pathname.endsWith("/plans/compare")) {
    return "여행안 비교";
  }
  if (pathname.includes("/edit")) {
    return "여행안 수정";
  }
  return "여행안 상세";
}

export function TripRoomChildLayout() {
  const params = useParams();
  const location = useLocation();
  const { goBack, platformNavigation } = useAppNavigation();

  const validated = decodeRouteParams(TripParamsSchema, params);
  if (Result.isFailure(validated)) {
    return <RouteErrorFallback message="유효하지 않은 여행방 식별자입니다." />;
  }

  const { tripId } = validated.success;

  return (
    <div css={containerStyle}>
      {/* Apps in Toss에서는 shell이 navigation을 소유하고, 브라우저에서만 TDS fallback을 보여줘요. */}
      {!platformNavigation && (
        <header css={headerStyle}>
          <TopNavigation
            background="transparent"
            leading={<TopNavigationBackButton aria-label="뒤로 가기" onClick={goBack} />}
            content={resolveTitle(location.pathname)}
          />
        </header>
      )}

      <main css={mainStyle}>
        <Outlet context={{ tripId }} />
      </main>
    </div>
  );
}
