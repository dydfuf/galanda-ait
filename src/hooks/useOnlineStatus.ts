import { useSyncExternalStore } from "react";

const getSnapshot = (): boolean =>
  typeof navigator !== "undefined" ? navigator.onLine : true;

const getServerSnapshot = (): boolean => true;

const subscribe = (onStoreChange: () => void): (() => void) => {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("online", onStoreChange);
  window.addEventListener("offline", onStoreChange);
  return () => {
    window.removeEventListener("online", onStoreChange);
    window.removeEventListener("offline", onStoreChange);
  };
};

/**
 * 브라우저 네트워크 연결 상태를 구독하는 훅.
 * 오프라인 상태 감지 및 UI 경고/mutation 비활성화에 사용한다.
 */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
