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
    <div className="flex items-center justify-between gap-3 px-(--app-inline-padding) pb-2">
      <div className="flex min-w-0 items-baseline gap-1.5">
        <h2 id="plan-candidates-heading" className="text-[15px] font-bold leading-none text-foreground">
          여행안
        </h2>
        <span className="whitespace-nowrap text-[12px] leading-none text-muted-foreground">
          후보 {candidateCount}개
        </span>
      </div>
      {showNewProposalAction && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="shrink-0"
          onClick={onNewProposalAction}
        >
          <Plus aria-hidden="true" />
          새 여행안 제안하기
        </Button>
      )}
    </div>
  );
}
