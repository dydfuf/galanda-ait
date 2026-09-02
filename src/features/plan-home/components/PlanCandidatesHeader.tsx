import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button.tsx";

interface PlanCandidatesHeaderProps {
  readonly candidateCount: number;
  /** 후보 2개 이상 & 미확정에서만 노출되는 section-level secondary 제안 진입이에요. */
  readonly showNewProposalAction?: boolean;
  readonly onNewProposalAction?: () => void;
}

/**
 * PL-01 여행안 후보 섹션 헤더예요 (RAON-228).
 * 비교하기가 sticky primary를 차지하는 2개 이상 상태에서도
 * `+ 새 여행안 제안하기`를 후보 section 바로 위에서 발견 가능하게 유지해요.
 */
export function PlanCandidatesHeader({
  candidateCount,
  showNewProposalAction = false,
  onNewProposalAction,
}: PlanCandidatesHeaderProps) {
  return (
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 px-(--app-inline-padding) pb-3">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
        <h2
          id="plan-candidates-heading"
          className="min-w-0 text-[18px] font-bold leading-snug tracking-tight text-foreground [overflow-wrap:anywhere]"
        >
          여행안
        </h2>
        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-foreground-muted whitespace-nowrap">
          후보 {candidateCount}개
        </span>
      </div>
      {showNewProposalAction && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="ml-auto max-w-full shrink-0 font-medium whitespace-normal shadow-2xs hover:bg-muted active:scale-[0.98] transition-transform"
          onClick={onNewProposalAction}
        >
          <Plus aria-hidden="true" className="size-3.5 mr-1" />새 여행안 제안하기
        </Button>
      )}
    </div>
  );
}
