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

  const participatePercent =
    memberCount > 0
      ? Math.min(100, Math.round((participatedMemberCount / memberCount) * 100))
      : 0;

  return (
    <section
      aria-labelledby="decision-status-heading"
      className="bg-muted/30 p-4.5 transition-colors"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <h2
          id="decision-status-heading"
          className="min-w-0 text-[15px] font-bold leading-snug tracking-tight text-foreground [overflow-wrap:anywhere]"
        >
          진행 상태
        </h2>
        <Badge variant={badgeVariant} className="shrink-0 font-semibold shadow-2xs">
          {badgeText}
        </Badge>
      </div>
      {hasCandidates ? (
        <>
          <p
            className="mt-2 min-w-0 text-[15px] font-semibold leading-snug text-foreground [overflow-wrap:anywhere]"
            aria-live="polite"
          >
            {statusText}
          </p>
          {subText ? (
            <p className="mt-1 min-w-0 text-sm leading-relaxed text-foreground-muted [overflow-wrap:anywhere]">
              {subText}
            </p>
          ) : null}
          <div className="mt-3.5 flex min-w-0 flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2.5">
            <p className="text-xs font-medium text-foreground-muted">
              참여 {participatedMemberCount}/{memberCount}명 · 의견{" "}
              {totalOpinionCount}개
            </p>
            <div
              aria-hidden="true"
              className="h-1.5 w-16 overflow-hidden rounded-full bg-border shrink-0"
            >
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${participatePercent}%` }}
              />
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
