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
  HomeQuickActions,
  HomeTripCard,
  selectHomeTrip,
} from "./components/HomeTripDashboard.tsx";
import { SavedIdeasSection } from "./components/SavedIdeasSection.tsx";

/**
 * 인증된 사용자의 실제 여행과 저장한 공개 일정을 조합하는 Home dashboard.
 * 여행 query와 저장 목록 query의 상태를 서로 격리해 한 section의 장애가 나머지
 * Home 콘텐츠를 가리지 않게 한다.
 */
export function HomePage() {
  const session = useSessionQuery();
  const rooms = useTripRoomsQuery();
  const today = toLocalTravelDate(new Date());
  const featuredRoom = selectHomeTrip(rooms.data ?? [], today);
  const userName = session.data?.name.trim() || "여행자";

  let tripContent: React.ReactNode;
  if (rooms.isError && !featuredRoom) {
    tripContent = (
      <section
        aria-labelledby="home-trip-error-heading"
        className="flex flex-col items-start gap-3 rounded-3xl border border-destructive-border bg-destructive-muted p-5"
      >
        <div>
          <p className="text-lg leading-snug font-bold">안녕하세요, {userName} 👋</p>
          <h2 id="home-trip-error-heading" className="mt-3 text-base font-bold">
            진행 중인 여행을 불러오지 못했어요.
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
  } else if (rooms.isPending) {
    tripContent = (
      <section
        aria-labelledby="home-trip-loading-heading"
        className="rounded-3xl border border-border bg-card p-5"
      >
        <p className="text-lg leading-snug font-bold">안녕하세요, {userName} 👋</p>
        <h2 id="home-trip-loading-heading" className="sr-only">진행 중인 여행</h2>
        <output className="mt-4 flex items-center gap-2 text-sm text-foreground-muted" aria-live="polite">
          <Spinner className="size-4 text-primary" aria-hidden="true" />
          진행 중인 여행을 불러오는 중이에요.
        </output>
      </section>
    );
  } else if (featuredRoom) {
    tripContent = <HomeTripCard room={featuredRoom} userName={userName} today={today} />;
  } else {
    tripContent = (
      <section
        aria-labelledby="home-trip-empty-heading"
        className="flex min-w-0 flex-col items-start gap-4 rounded-3xl border border-border bg-card p-5 shadow-sm"
      >
        <div className="min-w-0">
          <p className="text-lg leading-snug font-bold [overflow-wrap:anywhere]">
            안녕하세요, {userName} 👋
          </p>
          <h2 id="home-trip-empty-heading" className="mt-3 text-base font-bold">
            진행 중인 여행이 없어요.
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-foreground-muted">
            새 여행을 만들거나 다른 여행자의 일정을 둘러보세요.
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
              "flex-1 no-underline!",
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
        {featuredRoom && rooms.isError && (
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
        {featuredRoom && <HomeQuickActions room={featuredRoom} />}
        <SavedIdeasSection />
      </div>
    </PageBody>
  );
}
