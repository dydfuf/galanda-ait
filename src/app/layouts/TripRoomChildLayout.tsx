import { Outlet, useParams, useLocation } from "react-router-dom";
import { decodeRouteParams, TripParamsSchema } from "../routes/route-params.ts";
import { RouteErrorFallback } from "../../features/common/RouteErrorFallback.tsx";
import { Result } from "effect";
import { useAppNavigation } from "../../hooks/useAppNavigation.ts";
import { PageHeader } from "@/components/galanda/page-header.tsx";
import { getTripRoomNavigationTitle } from "./trip-room-navigation.ts";

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
    <div className="flex min-h-dvh flex-1 flex-col">
      {/* AIT native navigation이 back/title을 소유하므로 Web/PWA에서만 header를 렌더링해요. */}
      {!platformNavigation && (
        <PageHeader
          sticky
          bordered
          safeTop
          title={getTripRoomNavigationTitle(location.pathname)}
          back={{ onClick: () => void goBack() }}
        />
      )}

      <main className="flex flex-1 flex-col">
        <Outlet context={{ tripId }} />
      </main>
    </div>
  );
}
