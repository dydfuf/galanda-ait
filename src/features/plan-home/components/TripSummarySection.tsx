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
      className="mx-(--app-inline-padding) rounded-2xl border border-border bg-surface-raised px-4 py-4"
    >
      <p className="text-sm font-semibold text-foreground-muted">여행 정보</p>
      <h1 className="mt-1 min-w-0 text-[22px] leading-tight font-bold text-foreground [overflow-wrap:anywhere]">
        {title}
      </h1>
      <p className="mt-2 min-w-0 text-base leading-relaxed text-foreground-muted [overflow-wrap:anywhere]">
        {destination} · {period} · 참여 {memberCount}명
      </p>
    </section>
  );
}
