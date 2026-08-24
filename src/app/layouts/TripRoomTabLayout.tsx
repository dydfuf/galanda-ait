import { useCallback, useEffect, useRef, useState } from "react";
import { Outlet, useParams, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Share2 } from "lucide-react";
import { decodeRouteParams, TripParamsSchema } from "../routes/route-params.ts";
import { RouteErrorFallback } from "../../features/common/RouteErrorFallback.tsx";
import { Result } from "effect";
import { useAppNavigation } from "../../hooks/useAppNavigation.ts";
import { platform } from "../../platform/index.ts";
import { PageHeader } from "@/components/galanda/page-header.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import { issueTripInvite } from "../api-client.ts";
import { TripIdSchema } from "../../core/domain/ids.ts";
import {
  getTripRoomSection,
  getTripRoomSectionPath,
} from "./trip-room-navigation.ts";

export function TripRoomTabLayout() {
  const params = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { goBack, platformNavigation } = useAppNavigation();
  const [failedAccessoryTripId, setFailedAccessoryTripId] = useState<string>();
  const [platformTopInset, setPlatformTopInset] = useState(
    platformNavigation?.contentTopInset ?? 0,
  );
  const accessoryRegistrationId = useRef(0);
  const isCurrentAccessoryRegistration = useCallback(
    (registrationId: number) => registrationId === accessoryRegistrationId.current,
    [],
  );

  const validated = decodeRouteParams(TripParamsSchema, params);
  const tripId = Result.isSuccess(validated) ? validated.success.tripId : "";
  const selectedTab = getTripRoomSection(location.pathname);

  const handleShareInvite = useCallback(async () => {
    try {
      const { token } = await issueTripInvite(TripIdSchema.make(tripId));
      const outcome = await platform.share({
        title: "Galanda 여행 초대",
        text: "여행방에 참여해 주세요.",
        url: `${window.location.origin}/invites/${encodeURIComponent(token)}`,
      });

      if (outcome === "shared") {
        toast("초대 링크를 공유했어요.");
      } else if (outcome === "copied") {
        toast("초대 링크를 복사했어요.");
      } else if (outcome === "unsupported") {
        toast("공유를 지원하지 않는 환경이에요. 토스 앱에서 다시 시도해 주세요.");
      }
    } catch {
      toast.error("초대 링크를 만들지 못했어요. 다시 시도해주세요.");
    }
    // outcome === "cancelled": 사용자가 직접 닫은 경우라 알림을 띄우지 않아요.
  }, [tripId]);

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
      callback: () => void handleShareInvite(),
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
  }, [handleShareInvite, isCurrentAccessoryRegistration, platformNavigation, tripId]);

  if (Result.isFailure(validated)) {
    return <RouteErrorFallback message="유효하지 않은 여행방 식별자입니다." />;
  }

  const handleTabChange = (value: unknown) => {
    navigate(getTripRoomSectionPath(tripId, value), { replace: true });
  };

  const showWebNavigation = !platformNavigation;
  const showShareAction = showWebNavigation || failedAccessoryTripId === tripId;

  const modeSwitcher = (
    <Tabs value={selectedTab} onValueChange={handleTabChange}>
      <TabsList aria-label="여행방 화면" className="h-9 w-40">
        <TabsTrigger value="plans">계획</TabsTrigger>
        <TabsTrigger value="itinerary">일정</TabsTrigger>
      </TabsList>
    </Tabs>
  );

  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      <PageHeader
        sticky
        bordered
        safeTop={showWebNavigation}
        topInset={platformNavigation ? platformTopInset : undefined}
        className={platformNavigation ? "z-[5]" : undefined}
        center={modeSwitcher}
        back={showWebNavigation ? { onClick: () => void goBack() } : undefined}
        action={
          showShareAction ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-lg"
              aria-label="여행 초대 링크 공유"
              className="text-primary"
              onClick={() => void handleShareInvite()}
            >
              <Share2 className="size-5" />
            </Button>
          ) : undefined
        }
      />

      {/* 탭 내부 페이지 렌더링 */}
      <main className="flex flex-1 flex-col">
        <Outlet context={{ tripId }} />
      </main>
    </div>
  );
}
