import { css } from "@emotion/react";
import { Tab, TopNavigation, TopNavigationBackButton, TopNavigationTextButton, useToast } from "@toss/tds-mobile";
import { Clipboard, Share } from "@apps-in-toss/web-framework";
import { useCallback, useEffect, useRef, useState } from "react";
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
  const { goBack, platformNavigation } = useAppNavigation();
  const { openToast } = useToast();
  const [isShareAccessoryReady, setIsShareAccessoryReady] = useState(false);
  const accessoryRegistrationId = useRef(0);
  const isCurrentAccessoryRegistration = useCallback(
    (registrationId: number) => registrationId === accessoryRegistrationId.current,
    [],
  );

  const validated = decodeRouteParams(TripParamsSchema, params);
  const tripId = Result.isSuccess(validated) ? validated.success.tripId : "";
  const isItineraryTab = location.pathname.endsWith("/itinerary");
  const selectedTabIndex = isItineraryTab ? 1 : 0;

  const handleShareInvite = useCallback(async () => {
    const inviteUrl = `${window.location.origin}/invites/invite-${tripId}`;

    try {
      await Share.sendMessage({ message: inviteUrl });
      openToast("초대 링크를 공유했어요.");
      return;
    } catch {
      // 브라우저나 미지원 앱 버전에서는 아래 fallback을 시도해요.
    }

    try {
      if (typeof navigator.share === "function") {
        await navigator.share({
          title: "Galanda 여행 초대",
          text: "여행방에 참여해 주세요.",
          url: inviteUrl,
        });
        openToast("초대 링크를 공유했어요.");
        return;
      }
    } catch {
      // 사용자가 공유 시트를 닫은 경우도 다음 fallback으로 복구해요.
    }

    try {
      await Clipboard.setText(inviteUrl);
      openToast("초대 링크를 복사했어요.");
      return;
    } catch {
      // 토스 앱 밖에서는 플랫폼 clipboard가 없을 수 있어요.
    }

    try {
      if (!navigator.clipboard) throw new Error("clipboard is unavailable");
      await navigator.clipboard.writeText(inviteUrl);
      openToast("초대 링크를 복사했어요.");
      return;
    } catch {
      openToast("공유를 지원하지 않는 환경이에요. 토스 앱에서 다시 시도해 주세요.");
    }
  }, [openToast, tripId]);

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

  const handleTabChange = (index: number) => {
    const nextPath = TAB_PATHS[index] ?? TAB_PATHS[0];
    navigate(`/trips/${tripId}/${nextPath}`, { replace: true });
  };

  return (
    <div css={containerStyle}>
      {/* Apps in Toss에서는 shell이 back/title/accessory를 소유하고, 브라우저에서만 TDS fallback을 보여줘요. */}
      <header css={headerStyle}>
        {(!platformNavigation || !isShareAccessoryReady) && (
          <TopNavigation
            background="transparent"
            leading={<TopNavigationBackButton aria-label="뒤로 가기" onClick={goBack} />}
            content="여행방"
            trailing={
              <TopNavigationTextButton onClick={() => void handleShareInvite()}>
                초대하기
              </TopNavigationTextButton>
            }
          />
        )}

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
