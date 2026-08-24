import { Outlet, useParams, useLocation } from "react-router-dom";
import { decodeRouteParams, TripParamsSchema } from "../routes/route-params.ts";
import { RouteErrorFallback } from "../../features/common/RouteErrorFallback.tsx";
import { Result } from "effect";
import { useAppNavigation } from "../../hooks/useAppNavigation.ts";
import { PageHeader } from "@/components/galanda/page-header.tsx";

/** 현재 경로에 맞는 상단 내비게이션 제목을 정해요. */
function resolveTitle(pathname: string): string {
  if (pathname.endsWith("/itinerary/edit")) {
    return "일정 수정";
  }
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
    <div className="flex min-h-dvh flex-1 flex-col">
      {/* Apps in Toss에서는 shell이 navigation을 소유하고, 브라우저에서만 헤더를 보여줘요. */}
      {!platformNavigation && (
        <PageHeader
          sticky
          bordered
          title={resolveTitle(location.pathname)}
          back={{ onClick: () => void goBack() }}
        />
      )}

      <main className="flex flex-1 flex-col">
        <Outlet context={{ tripId }} />
      </main>
    </div>
  );
}
