import { useOnlineStatus } from "../../hooks/useOnlineStatus.ts";
import { GalandaIcon } from "./galanda-icon.tsx";

interface OfflineStatusBannerProps {
  readonly lastSyncedAt?: string;
  readonly className?: string;
}

export function OfflineStatusBanner({
  lastSyncedAt,
  className = "",
}: OfflineStatusBannerProps) {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-center justify-center gap-2 bg-amber-500/15 px-4 py-2 text-xs font-medium text-amber-900 dark:text-amber-200 border-b border-amber-500/30 ${className}`}
    >
      <GalandaIcon name="wifi-off" size={16} />
      <span>
        오프라인 상태입니다.
        {lastSyncedAt
          ? ` (마지막 동기화: ${new Date(lastSyncedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })})`
          : " 입력 내용은 이 기기에 유지되지만 온라인으로 돌아오기 전에는 저장되지 않습니다."}
      </span>
    </div>
  );
}
