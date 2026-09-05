import { Link } from "react-router-dom";
import { Compass, Plus } from "lucide-react";

import { PageBody } from "@/components/galanda/page-body.tsx";
import { PageTitle } from "@/components/galanda/page-title.tsx";
import { Button, buttonVariants } from "@/components/ui/button.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { toLocalTravelDate } from "@/core/domain/room.ts";
import { toUserMessage } from "@/features/common/error-message.ts";
import { useTripRoomsQuery } from "@/features/plan-home/queries.ts";
import { useSessionQuery } from "@/hooks/useSession.ts";
import { cn } from "@/lib/utils.ts";
import {
  HomeTripCard,
  selectFeaturedTrip,
} from "./components/HomeTripDashboard.tsx";
import { SavedIdeasSection } from "./components/SavedIdeasSection.tsx";
import { HomeNextAction } from "./components/HomeNextAction.tsx";

export function HomePage() {
  const session = useSessionQuery();
  const rooms = useTripRoomsQuery();
  const today = toLocalTravelDate(new Date());
  const { featured, lifecycle, hasAnyTrips, hasOnlyPastTrips } = selectFeaturedTrip(
    rooms.data ?? [],
    today
  );

  const greeting = session.data?.name?.trim()
    ? `${session.data.name.trim()}님, 안녕하세요 👋`
    : "안녕하세요 👋";

  let tripContent: React.ReactNode;
  if (rooms.isError && !featured && !hasAnyTrips) {
    tripContent = (
      <section
        aria-labelledby="home-trip-error-heading"
        className="flex flex-col items-start gap-3 rounded-3xl border border-destructive-border bg-destructive-muted p-5"
      >
        <div>
          <p className="text-lg leading-snug font-bold">{greeting}</p>
          <h2 id="home-trip-error-heading" className="mt-3 text-base font-bold text-destructive-strong">
            여행 정보를 불러오지 못했어요
          </h2>
          <p role="alert" className="mt-1 text-sm leading-relaxed text-destructive-strong">
            {toUserMessage(rooms.error, "잠시 후 다시 확인해주세요.")}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void rooms.refetch()}>
          다시 시도
        </Button>
      </section>
    );
  } else if (rooms.isPending && !rooms.data) {
    tripContent = (
      <section
        aria-labelledby="home-trip-loading-heading"
        className="rounded-3xl border border-border bg-card p-5"
      >
        <p className="text-lg leading-snug font-bold">{greeting}</p>
        <h2 id="home-trip-loading-heading" className="sr-only">
          진행 중인 여행
        </h2>
        <output
          className="mt-4 flex items-center gap-2 text-sm text-foreground-muted"
          aria-live="polite"
        >
          <Spinner className="size-4 text-primary" aria-hidden="true" />
          여행 정보를 불러오는 중이에요.
        </output>
      </section>
    );
  } else if (featured && lifecycle) {
    tripContent = (
      <div className="flex flex-col gap-2">
        <p className="px-1 text-lg leading-snug font-bold [overflow-wrap:anywhere]">
          {greeting}
        </p>
        {!rooms.isError && <HomeNextAction key={featured.id} trip={featured} />}
        <HomeTripCard trip={featured} lifecycle={lifecycle} today={today} />
      </div>
    );
  } else if (hasOnlyPastTrips) {
    tripContent = (
      <section
        aria-labelledby="home-trip-past-heading"
        className="flex min-w-0 flex-col items-start gap-4 rounded-3xl border border-border bg-card p-5 shadow-sm"
      >
        <div className="min-w-0">
          <p className="text-lg leading-snug font-bold [overflow-wrap:anywhere]">
            {greeting}
          </p>
          <h2 id="home-trip-past-heading" className="mt-3 text-base font-bold">
            다음 여행을 준비해 보세요
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-foreground-muted">
            지난 여행 기록을 확인하거나 새로운 여행을 계획해보세요.
          </p>
        </div>
        <div className="flex w-full min-w-0 flex-wrap gap-2">
          <Link
            to="/trips"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "flex-1 no-underline!")}
          >
            내 여행 보기
          </Link>
          <Link
            to="/trips/new"
            className={cn(buttonVariants({ size: "sm" }), "flex-1 no-underline!")}
          >
            <Plus aria-hidden="true" />
            새 여행 만들기
          </Link>
        </div>
      </section>
    );
  } else {
    tripContent = (
      <section
        aria-labelledby="home-trip-empty-heading"
        className="flex min-w-0 flex-col items-start gap-4 rounded-3xl border border-border bg-card p-5 shadow-sm"
      >
        <div className="min-w-0">
          <p className="text-lg leading-snug font-bold [overflow-wrap:anywhere]">
            {greeting}
          </p>
          <h2 id="home-trip-empty-heading" className="mt-3 text-base font-bold">
            진행 중인 여행이 없어요.
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-foreground-muted">
            여행방을 만들어 후보를 비교하고, 친구들의 의견으로 함께 확정해요.
          </p>
        </div>
        <div className="flex w-full min-w-0 flex-wrap gap-2">
          <Link
            to="/trips/new"
            className={cn(buttonVariants({ size: "sm" }), "flex-1 no-underline!")}
          >
            <Plus aria-hidden="true" />
            새 여행 만들기
          </Link>
          <Link
            to="/explore"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "flex-1 no-underline!"
            )}
          >
            <Compass aria-hidden="true" />
            여행 탐색
          </Link>
        </div>
      </section>
    );
  }

  return (
    <PageBody safeTop>
      <PageTitle title="홈" />

      <div className="flex flex-col gap-6 px-(--app-inline-padding) pt-2">
        {tripContent}
        {hasAnyTrips && rooms.isError && (
          <div className="flex flex-col items-start gap-2 rounded-2xl bg-warning-muted p-3">
            <p role="alert" className="text-sm leading-relaxed text-warning">
              최신 여행 정보를 확인하지 못했어요. 표시된 내용은 이전에 불러온 정보예요.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void rooms.refetch()}
            >
              여행 정보 다시 확인
            </Button>
          </div>
        )}
        <SavedIdeasSection />
      </div>
    </PageBody>
  );
}
