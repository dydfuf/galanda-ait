import { useCallback, useEffect, useRef, useState } from "react";
import { Outlet, useParams, useLocation, useNavigate } from "react-router-dom";
import { Bell, Share2 } from "lucide-react";
import { decodeRouteParams, TripParamsSchema } from "../routes/route-params.ts";
import { RouteErrorFallback } from "../../features/common/RouteErrorFallback.tsx";
import { Result } from "effect";
import { useAppNavigation } from "../../hooks/useAppNavigation.ts";
import { PageHeader } from "@/components/galanda/page-header.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import { shareTripInvite } from "../../features/invite/share-trip-invite.ts";
import { ActivityDrawer } from "../../features/activity/components/ActivityDrawer.tsx";
import { OfflineStatusBanner } from "@/components/galanda/OfflineStatusBanner.tsx";
import { useTripRoomsQuery } from "../../features/plan-home/queries.ts";
import {
  getTripRoomNavigationTitle,
  getTripRoomSection,
  getTripRoomSectionPath,
} from "./trip-room-navigation.ts";

export function TripRoomTabLayout() {
  const params = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { goBack, platformNavigation } = useAppNavigation();
  const [failedAccessoryTripId, setFailedAccessoryTripId] = useState<string>();
  const [isActivityOpen, setIsActivityOpen] = useState(false);
  const [platformTopInset, setPlatformTopInset] = useState(
    platformNavigation?.contentTopInset ?? 0,
  );
  const accessoryRegistrationId = useRef(0);
  const isCurrentAccessoryRegistration = useCallback(
    (registrationId: number) =>
      registrationId === accessoryRegistrationId.current,
    [],
  );

  const validated = decodeRouteParams(TripParamsSchema, params);
  const tripId = Result.isSuccess(validated) ? validated.success.tripId : "";
  const selectedTab = getTripRoomSection(location.pathname);

  const { data: trips } = useTripRoomsQuery();
  const currentTripOverview = trips?.find((t) => t.id === tripId);
  const unreadCount = currentTripOverview?.activitySummary?.unreadCount ?? 0;

  useEffect(
    () => platformNavigation?.subscribeContentTopInset(setPlatformTopInset),
    [platformNavigation],
  );

  useEffect(() => {
    if (!platformNavigation || !tripId) return;

    const registrationId = ++accessoryRegistrationId.current;
    let isActive = true;

    const registration = platformNavigation.addAccessoryButton({
      id: "galanda-share-invite",
      title: "공유",
      iconName: "icon-share-mono",
      callback: () => void shareTripInvite(tripId),
    });

    void registration.then(
      () => {
        if (isActive) setFailedAccessoryTripId(undefined);
      },
      () => {
        if (isActive) setFailedAccessoryTripId(tripId);
      },
    );

    return () => {
      isActive = false;
      const removeIfCurrent = () => {
        if (isCurrentAccessoryRegistration(registrationId)) {
          platformNavigation.removeAccessoryButton();
        }
      };

      void registration.then(removeIfCurrent, removeIfCurrent);
    };
  }, [isCurrentAccessoryRegistration, platformNavigation, tripId]);

  if (Result.isFailure(validated)) {
    return <RouteErrorFallback message="유효하지 않은 여행방 식별자입니다." />;
  }

  const handleTabChange = (value: unknown) => {
    navigate(getTripRoomSectionPath(tripId, value), { replace: true });
  };

  const showWebNavigation = !platformNavigation;
  const showShareAction = showWebNavigation || failedAccessoryTripId === tripId;

  const headerActions = (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon-lg"
        aria-label={`활동 알림${unreadCount > 0 ? ` (새 활동 ${unreadCount}개)` : ""}`}
        className="relative text-primary"
        onClick={() => setIsActivityOpen(true)}
      >
        <Bell className="size-5" />
        {unreadCount > 0 && (
          <span className="absolute top-2 right-2 flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-primary" />
          </span>
        )}
      </Button>
      {showShareAction && (
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          aria-label="여행 초대 링크 공유"
          className="text-primary"
          onClick={() => void shareTripInvite(tripId)}
        >
          <Share2 className="size-5" />
        </Button>
      )}
    </div>
  );

  const modeSwitcher = (
    <Tabs value={selectedTab} onValueChange={handleTabChange}>
      <TabsList
        variant="chrome"
        surface="none"
        aria-label="여행방 화면"
        className="w-40"
      >
        <TabsTrigger value="plans">계획</TabsTrigger>
        <TabsTrigger value="itinerary">일정</TabsTrigger>
      </TabsList>
    </Tabs>
  );

  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      <OfflineStatusBanner />
      {showWebNavigation ? (
        <div
          data-galanda-surface="chrome"
          className="sticky top-0 z-20 border-b"
        >
          <PageHeader
            safeTop
            surface="none"
            title={getTripRoomNavigationTitle(location.pathname)}
            back={{ onClick: () => void goBack() }}
            action={headerActions}
          />
          <div className="mx-auto flex w-full max-w-(--content-max-width) justify-center px-2 pb-2">
            {modeSwitcher}
          </div>
        </div>
      ) : (
        <PageHeader
          sticky
          bordered
          safeTop={false}
          topInset={platformTopInset}
          className="z-[5]"
          center={modeSwitcher}
          action={headerActions}
        />
      )}

      {/* 탭 내부 페이지 렌더링 */}
      <main className="flex flex-1 flex-col">
        <Outlet context={{ tripId }} />
      </main>

      <ActivityDrawer
        tripId={tripId}
        isOpen={isActivityOpen}
        onClose={() => setIsActivityOpen(false)}
      />
    </div>
  );
}
