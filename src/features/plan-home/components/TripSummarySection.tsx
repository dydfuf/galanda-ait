import { MapPin } from "lucide-react";

interface TripSummarySectionProps {
  readonly title: string;
  readonly destination: string;
  readonly period: string;
  readonly memberCount: number;
}

/** 여행 제목과 서버 aggregate의 요약 값을 불투명한 본문 카드에 표시한다. */
export function TripSummarySection({
  title,
  destination,
  period,
  memberCount,
}: TripSummarySectionProps) {
  return (
    <section
      aria-label="여행 정보"
      className="bg-surface-raised p-4.5 transition-shadow"
    >
      <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-foreground-muted">
        <MapPin aria-hidden="true" className="size-3.5 text-primary shrink-0" />
        <span>여행 정보</span>
      </div>
      <h1 className="mt-1.5 min-w-0 text-[22px] font-bold leading-tight tracking-tight text-foreground [overflow-wrap:anywhere]">
        {title}
      </h1>
      <p className="mt-2 min-w-0 text-sm font-medium leading-relaxed text-foreground-muted [overflow-wrap:anywhere]">
        {destination} · {period} · 참여 {memberCount}명
      </p>
    </section>
  );
}
