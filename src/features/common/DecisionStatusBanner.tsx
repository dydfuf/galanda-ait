import { Badge } from "@/components/ui/badge.tsx";

interface DecisionStatusBannerProps {
  readonly statusText: string;
  readonly subText?: string;
  readonly isConfirmed?: boolean;
}

export function DecisionStatusBanner({
  statusText,
  subText,
  isConfirmed = false,
}: DecisionStatusBannerProps) {
  return (
    <section aria-label="여행방 결정 상태" className="mb-4 px-(--app-inline-padding)">
      <div className="flex items-start gap-2.5 py-2" aria-live="polite">
        <Badge variant={isConfirmed ? "success" : "info"} className="mt-0.5 shrink-0">
          {isConfirmed ? "확정됨" : "의견 수집 중"}
        </Badge>
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-[15px] font-bold text-foreground">{statusText}</p>
          {subText && <p className="text-[13px] text-muted-foreground">{subText}</p>}
        </div>
      </div>
    </section>
  );
}
