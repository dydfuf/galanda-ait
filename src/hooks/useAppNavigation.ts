import { useNavigate, useLocation } from "react-router-dom";
import { partner, Screen, tdsEvent } from "@apps-in-toss/web-framework";
import { useCallback, useEffect, useMemo } from "react";

// 세션 내에서 라우트 이동이 있었는지 추적하기 위한 counter
let navigationCount = 0;

interface AccessoryButtonOptions {
  readonly id: string;
  readonly title: string;
  readonly iconName: string;
  readonly callback: VoidFunction;
}

interface PlatformNavigation {
  readonly addAccessoryButton: (options: AccessoryButtonOptions) => void;
  readonly removeAccessoryButton: VoidFunction;
}

export function useAppNavigation() {
  const navigate = useNavigate();
  const location = useLocation();
  const platformNavigation = useMemo<PlatformNavigation | undefined>(() => {
    if (typeof navigator === "undefined" || !navigator.userAgent.includes("TossApp/")) {
      return undefined;
    }

    let removeAccessoryListener: (() => void) | undefined;

    return {
      addAccessoryButton: ({ id, title, iconName, callback }: AccessoryButtonOptions) => {
        removeAccessoryListener?.();
        removeAccessoryListener = tdsEvent.addEventListener("navigationAccessoryEvent", {
          onEvent: (event) => {
            if (event.id === id) callback();
          },
        });

        void partner
          .addAccessoryButton({ id, title, icon: { name: iconName } })
          .catch((error: unknown) => console.error("앱인토스 액세서리 등록 실패:", error));
      },
      removeAccessoryButton: () => {
        removeAccessoryListener?.();
        removeAccessoryListener = undefined;
        void partner
          .removeAccessoryButton()
          .catch((error: unknown) => console.error("앱인토스 액세서리 제거 실패:", error));
      },
    };
  }, []);

  useEffect(() => {
    navigationCount += 1;
  }, [location]);

  const goBack = useCallback(() => {
    // 세션 내 이동 기록이 있거나 기본 entry가 아닌 경우 뒤로가기
    if (navigationCount > 1 && window.history.state?.idx > 0) {
      navigate(-1);
    } else {
      // 직접 딥링크 진입 등으로 이전 라우트가 없는 경우 미니앱 닫기
      try {
        Screen.close();
      } catch {
        // 웹 브라우저 환경 등 fallback
        navigate("/trips", { replace: true });
      }
    }
  }, [navigate]);

  return {
    navigate,
    goBack,
    location,
    platformNavigation,
  };
}
