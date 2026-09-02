import { Plus, X } from "lucide-react";
import {
  getStayNightCount,
  type AccommodationSnapshot,
  type BookingStatus,
  type CityStay,
} from "../../../core/domain/room.ts";
import { Badge } from "@/components/ui/badge.tsx";
import { Input } from "@/components/ui/input.tsx";
import { PLAN_EDITOR_SECTION_PRESENTATION } from "../plan-editor-section.ts";

interface AccommodationSectionProps {
  readonly accommodations: ReadonlyArray<AccommodationSnapshot>;
  readonly routes: ReadonlyArray<CityStay>;
  readonly onAdd: (acc: AccommodationSnapshot) => void;
  readonly onUpdate: (id: string, updated: Partial<AccommodationSnapshot>) => void;
  readonly onRemove: (id: string) => void;
}

export function AccommodationSection({
  accommodations,
  routes,
  onAdd,
  onUpdate,
  onRemove,
}: AccommodationSectionProps) {
  const handleAddNew = () => {
    const route = routes[accommodations.length] ?? routes[0];
    onAdd({
      id: `stay-${Date.now()}`,
      city: route?.city ?? "",
      period: route ? `${route.arrivalDate} ~ ${route.departureDate}` : "",
      nights: route ? Math.max(0, getStayNightCount(route)) : 0,
      hotelName: "",
      isSearching: true,
      bookingStatus: "NOT_CHECKED",
    });
  };

  return (
    <section
      data-galanda-surface="content"
      className="mb-5 flex w-full min-w-0 flex-col gap-5 rounded-2xl border border-border bg-surface-raised p-4.5 shadow-xs sm:p-5"
    >
      <h2 className="min-w-0 text-[18px] font-bold leading-snug tracking-tight text-foreground [overflow-wrap:anywhere]">
        {PLAN_EDITOR_SECTION_PRESENTATION.accommodation.sectionHeading}
      </h2>

      <div className="flex min-w-0 flex-col gap-3">
        {accommodations.map((acc, idx) => (
          <div
            key={acc.id}
            className="flex min-w-0 flex-col gap-4 rounded-xl border border-border/80 bg-surface/70 p-4 shadow-2xs"
          >
            <div className="flex min-w-0 items-center justify-between gap-2">
              <Badge variant="info" className="shrink-0 font-semibold shadow-2xs">
                구간 {idx + 1} · {acc.city} ({acc.nights}박)
              </Badge>
              {accommodations.length > 1 && (
                <button
                  type="button"
                  className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-foreground-muted transition-colors hover:bg-destructive-muted hover:text-destructive active:scale-95"
                  aria-label={`${idx + 1}번째 숙소 구간 삭제`}
                  onClick={() => onRemove(acc.id)}
                >
                  <X aria-hidden="true" className="size-4" />
                </button>
              )}
            </div>

            <div className="flex min-w-0 flex-col gap-1.5">
              <label
                htmlFor={`${acc.id}-hotel-name`}
                className="text-sm font-semibold leading-normal text-foreground-muted"
              >
                숙소명 / 호텔명
              </label>
              <Input
                id={`${acc.id}-hotel-name`}
                type="text"
                placeholder="예: 그랜드 조선 호텔 제주"
                value={acc.hotelName}
                onChange={(e) =>
                  onUpdate(acc.id, {
                    hotelName: e.target.value,
                    isSearching: false,
                  })
                }
                className="h-10 rounded-xl text-base"
              />
            </div>

            <label className="flex min-h-(--touch-target-min) cursor-pointer items-center gap-2.5 text-sm font-semibold text-foreground select-none">
              <input
                type="checkbox"
                checked={Boolean(acc.isSearching)}
                onChange={(e) =>
                  onUpdate(acc.id, {
                    isSearching: e.target.checked,
                    hotelName: e.target.checked ? "" : acc.hotelName,
                  })
                }
                className="size-4.5 rounded-sm accent-primary"
              />
              <span>숙소 찾는 중 (미정)</span>
            </label>

            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex min-w-0 flex-col gap-1.5">
                <label
                  htmlFor={`${acc.id}-price-min`}
                  className="text-sm font-semibold leading-normal text-foreground-muted"
                >
                  예상 최소 금액(원)
                </label>
                <Input
                  id={`${acc.id}-price-min`}
                  type="number"
                  placeholder="0"
                  step="10000"
                  min="0"
                  value={acc.priceRange?.min ?? ""}
                  onChange={(e) => {
                    if (!e.target.value)
                      return onUpdate(acc.id, { priceRange: undefined });
                    const min = Number(e.target.value);
                    onUpdate(acc.id, {
                      priceRange: {
                        min,
                        max: Math.max(min, acc.priceRange?.max ?? min),
                      },
                    });
                  }}
                  className="h-10 rounded-xl text-base"
                />
              </div>
              <div className="flex min-w-0 flex-col gap-1.5">
                <label
                  htmlFor={`${acc.id}-price-max`}
                  className="text-sm font-semibold leading-normal text-foreground-muted"
                >
                  예상 최대 금액(원)
                </label>
                <Input
                  id={`${acc.id}-price-max`}
                  type="number"
                  placeholder="0"
                  step="10000"
                  min="0"
                  value={acc.priceRange?.max ?? ""}
                  onChange={(e) => {
                    if (!e.target.value)
                      return onUpdate(acc.id, { priceRange: undefined });
                    const max = Number(e.target.value);
                    onUpdate(acc.id, {
                      priceRange: {
                        min: Math.min(acc.priceRange?.min ?? max, max),
                        max,
                      },
                    });
                  }}
                  className="h-10 rounded-xl text-base"
                />
              </div>
            </div>

            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex min-w-0 flex-col gap-1.5">
                <label
                  htmlFor={`${acc.id}-booking-status`}
                  className="text-sm font-semibold leading-normal text-foreground-muted"
                >
                  예약 상태
                </label>
                <select
                  id={`${acc.id}-booking-status`}
                  value={acc.bookingStatus}
                  onChange={(e) =>
                    onUpdate(acc.id, {
                      bookingStatus: e.target.value as BookingStatus,
                    })
                  }
                  className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-base text-foreground shadow-xs outline-none transition-colors focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary"
                >
                  <option value="AVAILABLE">예약 가능</option>
                  <option value="NEED_CHECK">확인 필요</option>
                  <option value="FULL">만실</option>
                  <option value="NOT_CHECKED">확인 전</option>
                </select>
              </div>

              <div className="flex min-w-0 flex-col gap-1.5">
                <label
                  htmlFor={`${acc.id}-booking-url`}
                  className="text-sm font-semibold leading-normal text-foreground-muted"
                >
                  예약 링크 (선택)
                </label>
                <Input
                  id={`${acc.id}-booking-url`}
                  type="url"
                  placeholder="https://"
                  value={acc.bookingUrl || ""}
                  onChange={(e) =>
                    onUpdate(acc.id, { bookingUrl: e.target.value })
                  }
                  className="h-10 rounded-xl text-base"
                />
              </div>
            </div>
          </div>
        ))}

        <button
          type="button"
          disabled={
            routes.length === 0 || accommodations.length >= routes.length
          }
          onClick={handleAddNew}
          className="flex h-11 w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-dashed border-primary/50 bg-primary-muted/20 text-sm font-semibold text-primary transition-all duration-150 hover:bg-primary-muted/40 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus aria-hidden="true" className="size-4 shrink-0" />
          <span>+ 숙소 구간 추가</span>
        </button>
      </div>
    </section>
  );
}
