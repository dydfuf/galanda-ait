import { Link } from "react-router-dom";
import { Compass, Plus } from "lucide-react";

import { PageBody } from "@/components/galanda/page-body.tsx";
import { PageTitle } from "@/components/galanda/page-title.tsx";
import { PageState } from "@/components/galanda/page-state.tsx";
import { Button, buttonVariants } from "@/components/ui/button.tsx";
import { toLocalTravelDate } from "@/core/domain/room.ts";
import { toUserMessage } from "@/features/common/error-message.ts";
import { useTripRoomsQuery } from "@/features/plan-home/queries.ts";
import { GalandaSpot } from "@/components/galanda/galanda-spot.tsx";
import { cn } from "@/lib/utils.ts";
import {
  HomeTripCard,
  selectFeaturedTrip,
} from "./components/HomeTripDashboard.tsx";
import { HomeNextAction } from "./components/HomeNextAction.tsx";

export function HomePage() {
  const rooms = useTripRoomsQuery();
  const today = toLocalTravelDate(new Date());
  const { featured, lifecycle, hasAnyTrips, hasOnlyPastTrips } = selectFeaturedTrip(
    rooms.data ?? [],
    today
  );

  let tripContent: React.ReactNode;
  if (rooms.isError && !featured && !hasAnyTrips) {
    tripContent = (
      <PageState
        status="error"
        title="여행 정보를 불러오지 못했어요"
        description={toUserMessage(rooms.error, "잠시 후 다시 확인해주세요.")}
        actionText="다시 시도"
        onAction={() => void rooms.refetch()}
      />
    );
  } else if (rooms.isPending && !rooms.data) {
    tripContent = (
      <PageState status="loading" message="여행 정보를 불러오는 중이에요." />
    );
  } else if (featured && lifecycle) {
    tripContent = (
      <div className="flex flex-col gap-7">
        <HomeTripCard trip={featured} lifecycle={lifecycle} today={today} />
        <HomeNextAction key={featured.id} trip={featured} stale={rooms.isError} />
      </div>
    );
  } else if (hasOnlyPastTrips) {
    tripContent = (
      <section
        aria-labelledby="home-trip-past-heading"
        className="flex min-w-0 flex-col items-start gap-6 pt-12"
      >
        <div className="min-w-0">
          <GalandaSpot name="create-trip" />
          <h2 id="home-trip-past-heading" className="mt-6 text-3xl font-bold leading-snug tracking-tight break-keep">
            다음 여행을 준비해 보세요
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-foreground-muted">
            지난 여행 기록을 확인하거나 새로운 여행을 계획해보세요.
          </p>
        </div>
        <div className="flex w-full min-w-0 flex-col gap-2">
          <Link
            to="/trips/new"
            className={cn(buttonVariants({ size: "xl" }), "min-h-14 no-underline!")}
          >
            <Plus aria-hidden="true" />
            새 여행 만들기
          </Link>
          <Link
            to="/trips"
            className={cn(buttonVariants({ variant: "ghost", size: "xl" }), "no-underline!")}
          >
            내 여행 보기
          </Link>
        </div>
      </section>
    );
  } else {
    tripContent = (
      <section
        aria-labelledby="home-trip-empty-heading"
        className="flex min-w-0 flex-col items-start gap-6 pt-12"
      >
        <div className="min-w-0">
          <GalandaSpot name="empty-trips" />
          <h2 id="home-trip-empty-heading" className="mt-6 text-3xl font-bold leading-snug tracking-tight break-keep">
            진행 중인 여행이 없어요.
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-foreground-muted">
            여행방을 만들어 후보를 비교하고, 친구들의 의견으로 함께 확정해요.
          </p>
        </div>
        <div className="flex w-full min-w-0 flex-col gap-2">
          <Link
            to="/trips/new"
            className={cn(buttonVariants({ size: "xl" }), "min-h-14 no-underline!")}
          >
            <Plus aria-hidden="true" />
            새 여행 만들기
          </Link>
          <Link
            to="/explore"
            className={cn(
              buttonVariants({ variant: "ghost", size: "xl" }),
              "no-underline!"
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
    <PageBody safeTop className="flex flex-col [--app-inline-padding:24px] [--app-page-padding-bottom:40px]">
      <PageTitle title="홈" />

      <div className="flex flex-1 flex-col gap-6 px-(--app-inline-padding) pt-2">
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
        {tripContent}
      </div>
    </PageBody>
  );
}
