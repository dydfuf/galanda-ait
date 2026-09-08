interface TripSummarySectionProps {
  readonly title: string;
  readonly destination: string;
  readonly period: string;
  readonly memberCount: number;
}

/** 여행 제목과 서버 aggregate의 요약 값을 하나의 정보 그룹으로 표시한다. */
export function TripSummarySection({
  title,
  destination,
  period,
  memberCount,
}: TripSummarySectionProps) {
  return (
    <section
      aria-label="여행 정보"
      className="min-w-0 bg-surface-content pt-5 pb-6"
    >
      <h1 className="min-w-0 text-[32px] font-bold leading-tight tracking-tight break-keep text-foreground [overflow-wrap:anywhere]">
        {title}
      </h1>
      <p className="mt-4 min-w-0 text-sm leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
        {destination} · {period} · 참여 {memberCount}명
      </p>
    </section>
  );
}
