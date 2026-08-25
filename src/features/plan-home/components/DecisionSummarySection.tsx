import { Badge } from "@/components/ui/badge.tsx";

interface DecisionSummarySectionProps {
  readonly badgeText: string;
  readonly badgeVariant: "success" | "info" | "warning";
  readonly statusText: string;
  readonly subText?: string;
  /** 후보가 없으면 상태 문구 대신 배지만 노출해 empty state와의 중복을 막아요. */
  readonly candidateCount: number;
  readonly totalOpinionCount: number;
  readonly participatedMemberCount: number;
  readonly memberCount: number;
}

/**
 * PL-01 진행 상태 섹션이에요.
 * 도메인에 존재하는 상태만 표현하고, 의견 수·참여 인원처럼 계산 가능한 값만 노출해요.
 * 임의의 25% 같은 progress는 만들지 않고, 후보 수는 여행안 섹션이 소유해요.
 */
export function DecisionSummarySection({
  badgeText,
  badgeVariant,
  statusText,
  subText,
  candidateCount,
  totalOpinionCount,
  participatedMemberCount,
  memberCount,
}: DecisionSummarySectionProps) {
  const hasCandidates = candidateCount > 0;

  return (
    <section
      aria-labelledby="decision-status-heading"
      className="mx-(--app-inline-padding) mb-2 rounded-xl bg-muted px-3 py-2.5"
    >
      <div className="flex items-center gap-2">
        <h2
          id="decision-status-heading"
          className="text-[11px] font-semibold tracking-widest text-foreground-muted uppercase"
        >
          진행 상태
        </h2>
        <Badge variant={badgeVariant} className="shrink-0">
          {badgeText}
        </Badge>
      </div>
      {hasCandidates ? (
        <>
          <p className="mt-1 text-[15px] font-bold leading-snug text-foreground" aria-live="polite">
            {statusText}
          </p>
          {subText ? (
            <p className="mt-1 text-[13px] leading-normal text-foreground-muted">{subText}</p>
          ) : null}
          <p className="mt-1 text-[12px] leading-normal text-foreground-muted">
            참여 {participatedMemberCount}/{memberCount}명 · 의견 {totalOpinionCount}개
          </p>
        </>
      ) : null}
    </section>
  );
}
