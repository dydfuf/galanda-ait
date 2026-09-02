import { Input } from "@/components/ui/input.tsx";
import { PLAN_EDITOR_SECTION_PRESENTATION } from "../plan-editor-section.ts";

interface BasicInfoSectionProps {
  readonly title: string;
  readonly onTitleChange: (val: string) => void;
  readonly proposalReason: string;
  readonly onProposalReasonChange: (val: string) => void;
  readonly baseHeadcount: number;
  readonly onBaseHeadcountChange: (val: number) => void;
}

export function BasicInfoSection({
  title,
  onTitleChange,
  proposalReason,
  onProposalReasonChange,
  baseHeadcount,
  onBaseHeadcountChange,
}: BasicInfoSectionProps) {
  return (
    <section
      data-galanda-surface="content"
      className="mb-5 flex w-full min-w-0 flex-col gap-5 rounded-2xl border border-border bg-surface-raised p-4.5 shadow-xs sm:p-5"
    >
      <h2 className="min-w-0 text-[18px] font-bold leading-snug tracking-tight text-foreground [overflow-wrap:anywhere]">
        {PLAN_EDITOR_SECTION_PRESENTATION.basic.sectionHeading}
      </h2>

      <div className="flex min-w-0 flex-col gap-2">
        <label
          htmlFor="plan-title"
          className="text-sm font-semibold leading-normal text-foreground-muted"
        >
          여행안 제목 <span className="text-destructive">*</span>
        </label>
        <Input
          id="plan-title"
          type="text"
          placeholder="예: 힐링 카페 & 호캉스 코스"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          className="h-11 rounded-xl text-base"
          required
        />
      </div>

      <div className="flex min-w-0 flex-col gap-2">
        <label
          htmlFor="plan-proposal-reason"
          className="text-sm font-semibold leading-normal text-foreground-muted"
        >
          제안 이유 / 한 줄 요약 (선택)
        </label>
        <Input
          id="plan-proposal-reason"
          type="text"
          placeholder="예: 이동을 줄이고 서귀포 호텔에서 여유를 즐기는 안"
          value={proposalReason}
          onChange={(e) => onProposalReasonChange(e.target.value)}
          className="h-11 rounded-xl text-base"
        />
      </div>

      <div className="flex min-w-0 flex-col gap-2">
        <fieldset
          className="m-0 flex min-w-0 flex-wrap items-center gap-3 border-none p-0"
          aria-describedby="plan-headcount-hint"
        >
          <legend className="mb-2 text-sm font-semibold leading-normal text-foreground-muted">
            비용 기준 인원 <span className="text-destructive">*</span>
          </legend>
          <button
            type="button"
            className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-border bg-surface text-lg font-bold text-foreground transition-all duration-150 hover:bg-muted active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="비용 기준 인원 한 명 줄이기"
            disabled={baseHeadcount <= 1}
            onClick={() =>
              onBaseHeadcountChange(Math.max(1, baseHeadcount - 1))
            }
          >
            <span aria-hidden="true">-</span>
          </button>
          <span
            className="min-w-12 text-center text-base font-bold tabular-nums text-foreground"
            aria-live="polite"
          >
            {baseHeadcount}명
          </span>
          <button
            type="button"
            className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-border bg-surface text-lg font-bold text-foreground transition-all duration-150 hover:bg-muted active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="비용 기준 인원 한 명 늘리기"
            disabled={baseHeadcount >= 20}
            onClick={() => onBaseHeadcountChange(baseHeadcount + 1)}
          >
            <span aria-hidden="true">+</span>
          </button>
        </fieldset>
        <span
          id="plan-headcount-hint"
          className="text-xs font-normal leading-relaxed text-foreground-subtle"
        >
          이 인원을 기준으로 1인 예상 참고액이 자동 계산됩니다.
        </span>
      </div>
    </section>
  );
}
