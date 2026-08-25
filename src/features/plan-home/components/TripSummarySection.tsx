interface TripSummarySectionProps {
  readonly title: string;
  readonly destination: string;
  readonly period: string;
  readonly memberCount: number;
}

/**
 * PL-01 여행 정보 섹션이에요.
 * 제목을 가장 강한 정보(h1)로 두고, 기간과 인원을 같은 그룹에 배치해요.
 * C안의 섹션형 그룹화 강조를 위해 상단 패딩은 PageBody와 겹치지 않게 얇게 잡아요.
 */
export function TripSummarySection({ title, destination, period, memberCount }: TripSummarySectionProps) {
  return (
    <section aria-label="여행 정보" className="px-(--app-inline-padding) pt-1 pb-2">
      <p className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">여행 정보</p>
      <h1 className="mt-1 text-[22px] leading-tight font-bold text-foreground">{title}</h1>
      <p className="mt-1 text-[13px] leading-normal text-muted-foreground">
        {destination} · {period} · 참여 {memberCount}명
      </p>
    </section>
  );
}
