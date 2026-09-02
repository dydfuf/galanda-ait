import { Plus, X } from "lucide-react";
import { getStayNightCount, type CityStay } from "../../../core/domain/room.ts";
import { RouteRail } from "../../common/RouteRail.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Input } from "@/components/ui/input.tsx";
import { PLAN_EDITOR_SECTION_PRESENTATION } from "../plan-editor-section.ts";

interface RouteCitySectionProps {
  readonly routes: ReadonlyArray<CityStay>;
  readonly totalTripNights: number;
  readonly currentTotalNights: number;
  readonly differenceSummary?: string;
  readonly onAddCity: (city?: string) => void;
  readonly onUpdateCity: (index: number, updated: Partial<CityStay>) => void;
  readonly onRemoveCity: (index: number) => void;
}

export function RouteCitySection({
  routes,
  totalTripNights,
  currentTotalNights,
  differenceSummary,
  onAddCity,
  onUpdateCity,
  onRemoveCity,
}: RouteCitySectionProps) {
  const isNightMatched =
    routes.length > 0 && currentTotalNights === totalTripNights;

  const nightsBadgeText =
    routes.length === 0
      ? "도시 입력 필요"
      : isNightMatched
        ? `총 ${totalTripNights}박 배분 완료`
        : `${currentTotalNights}박 / ${totalTripNights}박 (${
            totalTripNights - currentTotalNights > 0
              ? `${totalTripNights - currentTotalNights}박 부족`
              : `${currentTotalNights - totalTripNights}박 초과`
          })`;

  return (
    <section
      data-galanda-surface="content"
      className="mb-5 flex w-full min-w-0 flex-col gap-5 rounded-2xl border border-border bg-surface-raised p-4.5 shadow-xs sm:p-5"
    >
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <h2 className="min-w-0 text-[18px] font-bold leading-snug tracking-tight text-foreground [overflow-wrap:anywhere]">
          {PLAN_EDITOR_SECTION_PRESENTATION.route.sectionHeading}
        </h2>
        <Badge
          variant={isNightMatched ? "info" : "destructive"}
          className="shrink-0 font-semibold shadow-2xs"
        >
          {nightsBadgeText}
        </Badge>
      </div>

      <div className="min-w-0 rounded-xl border border-border/70 bg-surface/60 p-4">
        <span className="mb-2 block text-sm font-bold leading-normal text-foreground-muted">
          경로 미리보기
        </span>
        <RouteRail
          route={routes.map((stay) => ({
            city: stay.city,
            nights: Math.max(0, getStayNightCount(stay)),
          }))}
          differenceSummary={differenceSummary}
        />
      </div>

      <div className="flex min-w-0 flex-col gap-3">
        {routes.map((stay, idx) => (
          <div
            key={idx}
            className="flex min-w-0 flex-col gap-3.5 rounded-xl border border-border/80 bg-surface/70 p-4 shadow-2xs"
          >
            <div className="flex min-w-0 items-center justify-between gap-2">
              <h3 className="min-w-0 text-base font-bold leading-snug text-foreground [overflow-wrap:anywhere]">
                도시 {idx + 1}
              </h3>
              {routes.length > 1 && (
                <button
                  type="button"
                  onClick={() => onRemoveCity(idx)}
                  className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-foreground-muted transition-colors hover:bg-destructive-muted hover:text-destructive active:scale-95"
                  aria-label={`도시 ${idx + 1} 삭제`}
                >
                  <X aria-hidden="true" className="size-4" />
                </button>
              )}
            </div>

            <div className="flex min-w-0 flex-col gap-1.5">
              <label
                htmlFor={`route-${idx}-city`}
                className="text-sm font-semibold leading-normal text-foreground-muted"
              >
                도시 이름
              </label>
              <Input
                id={`route-${idx}-city`}
                type="text"
                placeholder={`도시 ${idx + 1} 이름`}
                value={stay.city}
                onChange={(e) => onUpdateCity(idx, { city: e.target.value })}
                className="h-10 rounded-xl text-base"
              />
            </div>

            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex min-w-0 flex-col gap-1.5">
                <label
                  htmlFor={`route-${idx}-arrival`}
                  className="text-sm font-semibold leading-normal text-foreground-muted"
                >
                  도착일
                </label>
                <Input
                  id={`route-${idx}-arrival`}
                  type="date"
                  value={stay.arrivalDate}
                  onChange={(e) =>
                    onUpdateCity(idx, { arrivalDate: e.target.value })
                  }
                  className="h-10 rounded-xl text-base"
                />
              </div>
              <div className="flex min-w-0 flex-col gap-1.5">
                <label
                  htmlFor={`route-${idx}-departure`}
                  className="text-sm font-semibold leading-normal text-foreground-muted"
                >
                  출발일
                </label>
                <Input
                  id={`route-${idx}-departure`}
                  type="date"
                  value={stay.departureDate}
                  onChange={(e) =>
                    onUpdateCity(idx, { departureDate: e.target.value })
                  }
                  className="h-10 rounded-xl text-base"
                />
              </div>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={() => onAddCity("")}
          className="flex h-11 w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-dashed border-primary/50 bg-primary-muted/20 text-sm font-semibold text-primary transition-all duration-150 hover:bg-primary-muted/40 active:scale-[0.99]"
        >
          <Plus aria-hidden="true" className="size-4 shrink-0" />
          <span>
            {routes.length === 0 ? "방문 도시 추가" : "경유 도시 추가"}
          </span>
        </button>
      </div>
    </section>
  );
}
