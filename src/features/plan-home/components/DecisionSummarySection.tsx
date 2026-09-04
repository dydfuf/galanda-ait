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
  /** `6명 중 5명이 한 번 이상 의견을 남겼어요` — 합집합임을 숨기지 않는 정확한 문구. */
  readonly overallParticipationText: string;
  /** 어떤 후보에도 반응하지 않은 회원. 없으면 빈 배열. */
  readonly overallNonRespondentText?: string;
  /** 전체 `어려워요` 요약. 없으면 undefined. */
  readonly hardSummaryText?: string;
  /** 미해결 예약 확인 요약. 없으면 undefined. */
  readonly bookingSummaryText?: string;
  /** 레거시 비귀속 의견 설명. 없으면 undefined. */
  readonly unattributedNoticeText?: string;
}

/**
 * DEC-1 Decision Cockpit 상단 상태 표면이에요.
 * 전체 참여(합집합) · 어려운 의견 · 예약 위험 · 미응답자를 한 흐름에서 보여주고,
 * 후보별 완성도로 오해되는 `참여 N/M명` 표현을 쓰지 않아요.
 * CTA는 포함하지 않는다 — 강조 CTA는 NBA 또는 sticky primary가 단독으로 소유해요.
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
  overallParticipationText,
  overallNonRespondentText,
  hardSummaryText,
  bookingSummaryText,
  unattributedNoticeText,
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
            className="mt-2 min-w-0 break-words text-[15px] font-semibold leading-snug text-foreground [overflow-wrap:anywhere]"
            aria-live="polite"
          >
            {statusText}
          </p>
          {subText ? (
            <p className="mt-1 min-w-0 break-words text-sm leading-relaxed text-foreground-muted [overflow-wrap:anywhere]">
              {subText}
            </p>
          ) : null}
          <div className="mt-3.5 flex min-w-0 flex-col gap-1.5 border-t border-border/60 pt-2.5">
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
              <p className="min-w-0 text-xs font-medium break-words text-foreground-muted [overflow-wrap:anywhere]">
                {overallParticipationText} · 의견 {totalOpinionCount}개
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
            {overallNonRespondentText ? (
              <p className="min-w-0 text-[13px] font-medium leading-relaxed break-words text-foreground-muted [overflow-wrap:anywhere]">
                {overallNonRespondentText}
              </p>
            ) : null}
            {hardSummaryText ? (
              <p className="min-w-0 text-[13px] font-semibold leading-relaxed break-words text-warning [overflow-wrap:anywhere]">
                {hardSummaryText}
              </p>
            ) : null}
            {bookingSummaryText ? (
              <p className="min-w-0 text-[13px] font-semibold leading-relaxed break-words text-warning [overflow-wrap:anywhere]">
                {bookingSummaryText}
              </p>
            ) : null}
            {unattributedNoticeText ? (
              <p className="min-w-0 text-xs leading-relaxed break-words text-foreground-muted [overflow-wrap:anywhere]">
                {unattributedNoticeText}
              </p>
            ) : null}
          </div>
        </>
      ) : null}
    </section>
  );
}
