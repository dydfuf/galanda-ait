import { useNavigate, useLocation } from "react-router-dom";
import { closeView } from "@apps-in-toss/web-framework";
import { useCallback, useEffect } from "react";

// 세션 내에서 라우트 이동이 있었는지 추적하기 위한 counter
let navigationCount = 0;

export function useAppNavigation() {
  const navigate = useNavigate();
  const location = useLocation();

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
        closeView();
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
  };
}
