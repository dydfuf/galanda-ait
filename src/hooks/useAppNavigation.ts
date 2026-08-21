import { useNavigate, useLocation } from "react-router-dom";
import { useCallback, useEffect } from "react";
import { platform } from "../platform/index.ts";

// 세션 내에서 라우트 이동이 있었는지 추적하기 위한 counter
let navigationCount = 0;

export function useAppNavigation() {
  const navigate = useNavigate();
  const location = useLocation();
  // AIT shell이 navigation을 소유할 때만 존재해요. 일반 브라우저에서는 undefined예요.
  const platformNavigation = platform.navigation;

  useEffect(() => {
    navigationCount += 1;
  }, [location]);

  const goBack = useCallback(() => {
    // 세션 내 이동 기록이 있거나 기본 entry가 아닌 경우 뒤로가기
    if (navigationCount > 1 && window.history.state?.idx > 0) {
      void navigate(-1);
    } else if (!platform.requestClose()) {
      // 직접 딥링크 진입 등으로 이전 라우트가 없고 화면을 닫을 수도 없으면 목록으로 이동해요.
      void navigate("/trips", { replace: true });
    }
  }, [navigate]);

  return {
    navigate,
    goBack,
    location,
    platformNavigation,
  };
}
