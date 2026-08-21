import { useCallback, useEffect, useRef, useState } from "react";
import { Outlet, useParams, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { decodeRouteParams, TripParamsSchema } from "../routes/route-params.ts";
import { RouteErrorFallback } from "../../features/common/RouteErrorFallback.tsx";
import { Result } from "effect";
import { useAppNavigation } from "../../hooks/useAppNavigation.ts";
import { platform } from "../../platform/index.ts";
import { PageHeader } from "@/components/galanda/page-header.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";

/** 탭 값은 라우트 세그먼트와 같아요. */
const TAB_PATHS = ["plans", "itinerary"] as const;
type TabPath = (typeof TAB_PATHS)[number];

export function TripRoomTabLayout() {
  const params = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { goBack, platformNavigation } = useAppNavigation();
  const [isShareAccessoryReady, setIsShareAccessoryReady] = useState(false);
  const accessoryRegistrationId = useRef(0);
  const isCurrentAccessoryRegistration = useCallback(
    (registrationId: number) => registrationId === accessoryRegistrationId.current,
    [],
  );

  const validated = decodeRouteParams(TripParamsSchema, params);
  const tripId = Result.isSuccess(validated) ? validated.success.tripId : "";
  const selectedTab: TabPath = location.pathname.endsWith("/itinerary") ? "itinerary" : "plans";

  const handleShareInvite = useCallback(async () => {
    const outcome = await platform.share({
      title: "Galanda 여행 초대",
      text: "여행방에 참여해 주세요.",
      url: `${window.location.origin}/invites/invite-${tripId}`,
    });

    if (outcome === "shared") {
      toast("초대 링크를 공유했어요.");
    } else if (outcome === "copied") {
      toast("초대 링크를 복사했어요.");
    } else {
      toast("공유를 지원하지 않는 환경이에요. 토스 앱에서 다시 시도해 주세요.");
    }
  }, [tripId]);

  useEffect(() => {
    if (!platformNavigation || !tripId) return;

    setIsShareAccessoryReady(false);
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
        if (isActive) setIsShareAccessoryReady(true);
      },
      () => {
        if (isActive) setIsShareAccessoryReady(false);
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
    const nextPath = TAB_PATHS.find((path) => path === value) ?? TAB_PATHS[0];
    navigate(`/trips/${tripId}/${nextPath}`, { replace: true });
  };

  // Apps in Toss에서는 shell이 back/title/accessory를 소유하고, 브라우저에서만 bar를 보여줘요.
  const showHeaderBar = !platformNavigation || !isShareAccessoryReady;

  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      <PageHeader
        sticky
        bordered
        title={showHeaderBar ? "여행방" : undefined}
        back={showHeaderBar ? { onClick: goBack } : undefined}
        action={
          showHeaderBar ? (
            <Button type="button" variant="ghost" className="text-primary" onClick={() => void handleShareInvite()}>
              초대하기
            </Button>
          ) : undefined
        }
      >
        {/* 탭 내비게이션 (계획 | 일정) — 선택 상태는 URL과 동기화돼요. */}
        <Tabs value={selectedTab} onValueChange={handleTabChange} className="px-2">
          <TabsList variant="line" aria-label="여행방 화면" className="h-11 w-full gap-0">
            <TabsTrigger value="plans" className="text-[15px] after:bg-primary data-active:text-primary">
              계획
            </TabsTrigger>
            <TabsTrigger value="itinerary" className="text-[15px] after:bg-primary data-active:text-primary">
              일정
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </PageHeader>

      {/* 탭 내부 페이지 렌더링 */}
      <main className="flex flex-1 flex-col">
        <Outlet context={{ tripId }} />
      </main>
    </div>
  );
}
