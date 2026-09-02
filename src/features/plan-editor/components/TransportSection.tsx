import { Plus, X } from "lucide-react";
import type { BookingStatus, TransportSnapshot } from "../../../core/domain/room.ts";
import { Badge } from "@/components/ui/badge.tsx";
import { Input } from "@/components/ui/input.tsx";
import { PLAN_EDITOR_SECTION_PRESENTATION } from "../plan-editor-section.ts";

interface TransportSectionProps {
  readonly transports: ReadonlyArray<TransportSnapshot>;
  readonly onAdd: (trans: TransportSnapshot) => void;
  readonly onUpdate: (id: string, updated: Partial<TransportSnapshot>) => void;
  readonly onRemove: (id: string) => void;
}

export function TransportSection({
  transports,
  onAdd,
  onUpdate,
  onRemove,
}: TransportSectionProps) {
  const handleAddNew = () => {
    onAdd({
      id: `trans-${Date.now()}`,
      fromCity: "",
      toCity: "",
      mode: "",
      hasTransfer: false,
      durationText: "",
      bookingStatus: "NOT_CHECKED",
    });
  };

  return (
    <section
      data-galanda-surface="content"
      className="mb-5 flex w-full min-w-0 flex-col gap-5 rounded-2xl border border-border bg-surface-raised p-4.5 shadow-xs sm:p-5"
    >
      <h2 className="min-w-0 text-[18px] font-bold leading-snug tracking-tight text-foreground [overflow-wrap:anywhere]">
        {PLAN_EDITOR_SECTION_PRESENTATION.transport.sectionHeading}
      </h2>

      <div className="flex min-w-0 flex-col gap-3">
        {transports.map((trans, idx) => (
          <div
            key={trans.id}
            className="flex min-w-0 flex-col gap-4 rounded-xl border border-border/80 bg-surface/70 p-4 shadow-2xs"
          >
            <div className="flex min-w-0 items-center justify-between gap-2">
              <Badge variant="neutral" className="shrink-0 font-semibold shadow-2xs">
                이동 {idx + 1} · {trans.fromCity} → {trans.toCity}
              </Badge>
              {transports.length > 0 && (
                <button
                  type="button"
                  className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-foreground-muted transition-colors hover:bg-destructive-muted hover:text-destructive active:scale-95"
                  aria-label={`${idx + 1}번째 이동 구간 삭제`}
                  onClick={() => onRemove(trans.id)}
                >
                  <X aria-hidden="true" className="size-4" />
                </button>
              )}
            </div>

            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex min-w-0 flex-col gap-1.5">
                <label
                  htmlFor={`${trans.id}-from-city`}
                  className="text-sm font-semibold leading-normal text-foreground-muted"
                >
                  출발지
                </label>
                <Input
                  id={`${trans.id}-from-city`}
                  type="text"
                  placeholder="예: 공항 / 제주시"
                  value={trans.fromCity}
                  onChange={(e) =>
                    onUpdate(trans.id, { fromCity: e.target.value })
                  }
                  className="h-10 rounded-xl text-base"
                />
              </div>
              <div className="flex min-w-0 flex-col gap-1.5">
                <label
                  htmlFor={`${trans.id}-to-city`}
                  className="text-sm font-semibold leading-normal text-foreground-muted"
                >
                  도착지
                </label>
                <Input
                  id={`${trans.id}-to-city`}
                  type="text"
                  placeholder="예: 서귀포시"
                  value={trans.toCity}
                  onChange={(e) =>
                    onUpdate(trans.id, { toCity: e.target.value })
                  }
                  className="h-10 rounded-xl text-base"
                />
              </div>
            </div>

            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr]">
              <div className="flex min-w-0 flex-col gap-1.5">
                <label
                  htmlFor={`${trans.id}-mode`}
                  className="text-sm font-semibold leading-normal text-foreground-muted"
                >
                  교통수단
                </label>
                <Input
                  id={`${trans.id}-mode`}
                  type="text"
                  placeholder="예: 렌터카 카니발 / KTX"
                  value={trans.mode}
                  onChange={(e) => onUpdate(trans.id, { mode: e.target.value })}
                  className="h-10 rounded-xl text-base"
                />
              </div>
              <div className="flex min-w-0 flex-col gap-1.5">
                <label
                  htmlFor={`${trans.id}-duration`}
                  className="text-sm font-semibold leading-normal text-foreground-muted"
                >
                  예상 소요시간
                </label>
                <Input
                  id={`${trans.id}-duration`}
                  type="text"
                  placeholder="예: 약 50분"
                  value={trans.durationText}
                  onChange={(e) =>
                    onUpdate(trans.id, { durationText: e.target.value })
                  }
                  className="h-10 rounded-xl text-base"
                />
              </div>
            </div>

            <label className="flex min-h-(--touch-target-min) cursor-pointer items-center gap-2.5 text-sm font-semibold text-foreground select-none">
              <input
                type="checkbox"
                checked={trans.hasTransfer}
                onChange={(e) =>
                  onUpdate(trans.id, { hasTransfer: e.target.checked })
                }
                className="size-4.5 rounded-sm accent-primary"
              />
              <span>환승 필요</span>
            </label>

            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex min-w-0 flex-col gap-1.5">
                <label
                  htmlFor={`${trans.id}-price`}
                  className="text-sm font-semibold leading-normal text-foreground-muted"
                >
                  예상 그룹 금액(원)
                </label>
                <Input
                  id={`${trans.id}-price`}
                  type="number"
                  placeholder="0"
                  step="10000"
                  min="0"
                  value={trans.priceRange?.min ?? ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    onUpdate(trans.id, {
                      priceRange: value
                        ? { min: Number(value), max: Number(value) }
                        : undefined,
                    });
                  }}
                  className="h-10 rounded-xl text-base"
                />
              </div>
              <div className="flex min-w-0 flex-col gap-1.5">
                <label
                  htmlFor={`${trans.id}-booking-status`}
                  className="text-sm font-semibold leading-normal text-foreground-muted"
                >
                  예약 상태
                </label>
                <select
                  id={`${trans.id}-booking-status`}
                  value={trans.bookingStatus}
                  onChange={(e) =>
                    onUpdate(trans.id, {
                      bookingStatus: e.target.value as BookingStatus,
                    })
                  }
                  className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-base text-foreground shadow-xs outline-none transition-colors focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary"
                >
                  <option value="AVAILABLE">예약 가능</option>
                  <option value="NEED_CHECK">확인 필요</option>
                  <option value="FULL">매진/불가</option>
                  <option value="NOT_CHECKED">확인 전</option>
                </select>
              </div>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={handleAddNew}
          className="flex h-11 w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-dashed border-primary/50 bg-primary-muted/20 text-sm font-semibold text-primary transition-all duration-150 hover:bg-primary-muted/40 active:scale-[0.99]"
        >
          <Plus aria-hidden="true" className="size-4 shrink-0" />
          <span>+ 교통 이동 구간 추가</span>
        </button>
      </div>
    </section>
  );
}
