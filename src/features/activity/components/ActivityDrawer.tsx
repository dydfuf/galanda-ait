import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer.tsx";
import type { TripActivityEventDto, TripActivityType } from "@/contracts/trip-activity.ts";
import { useTripActivitiesInfiniteQuery, useMarkTripActivityReadMutation } from "../queries.ts";

interface ActivityDrawerProps {
  readonly tripId: string;
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

const getActivityMessage = (event: TripActivityEventDto): { title: string; subtitle?: string } => {
  const actor = event.actorDisplayName || "참여자";
  const planTitle = event.subjectTitle ? `"${event.subjectTitle}"` : "여행안";

  switch (event.type as TripActivityType) {
    case "PLAN_CREATED":
      return { title: `${actor}님이 새 여행안 ${planTitle}을 등록했어요` };
    case "PLAN_UPDATED":
      return { title: `${actor}님이 여행안 ${planTitle}을 수정했어요` };
    case "PLAN_DELETED":
      return { title: `${actor}님이 여행안 ${planTitle}을 삭제했어요` };
    case "OPINION_SUBMITTED":
      return { title: `${actor}님이 여행안 ${planTitle}에 의견을 남겼어요` };
    case "OPINION_UPDATED":
      return { title: `${actor}님이 여행안 ${planTitle}의 의견을 변경했어요` };
    case "PLAN_CONFIRMED":
      return {
        title: `${actor}님이 여행안 ${planTitle}을 확정했어요`,
        subtitle: "여행 일정이 생성되었습니다.",
      };
    case "ITINERARY_REVISED":
      return {
        title: `${actor}님이 확정 일정을 수정했어요`,
        subtitle: `일정 버전 ${event.itineraryRevision ?? ""}`,
      };
    default:
      return { title: `${actor}님이 협업 활동을 남겼어요` };
  }
};

const formatExactDateTime = (isoString: string): string => {
  const date = new Date(isoString);
  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatTimeAgo = (isoString: string): string => {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) return "방금 전";
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffHour < 24) return `${diffHour}시간 전`;
  if (diffDay < 7) return `${diffDay}일 전`;
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
};

export function ActivityDrawer({ tripId, isOpen, onClose }: ActivityDrawerProps) {
  const navigate = useNavigate();
  const {
    data,
    isLoading,
    isError,
    refetch,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useTripActivitiesInfiniteQuery(tripId, { enabled: isOpen });

  const markReadMutation = useMarkTripActivityReadMutation(tripId);

  const allEvents = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((page) => page.items);
  }, [data]);

  const firstPage = data?.pages[0];
  const latestSequence = firstPage?.latestSequence ?? allEvents[0]?.sequence;
  const unreadCount = firstPage?.unreadCount ?? 0;
  const canMarkRead = Boolean(latestSequence) && unreadCount > 0;

  const handleMarkAllRead = () => {
    if (!latestSequence || !canMarkRead || markReadMutation.isPending) return;
    markReadMutation.mutate(latestSequence);
  };

  const handleItemClick = (event: TripActivityEventDto) => {
    if (event.target?.path) {
      onClose();
      navigate(event.target.path);
    }
  };

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="max-h-[85dvh]">
        <DrawerHeader className="text-left">
          <div className="flex items-center justify-between gap-2">
            <DrawerTitle className="flex items-center gap-2">
              <Bell className="size-5 text-primary" aria-hidden="true" />
              활동 알림
            </DrawerTitle>
            {allEvents.length > 0 && canMarkRead && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarkAllRead}
                disabled={markReadMutation.isPending}
                className="h-8 px-2 text-xs text-foreground-muted hover:text-foreground"
              >
                {markReadMutation.isPending ? "확인 중..." : "현재까지 모두 확인"}
              </Button>
            )}
          </div>
          <DrawerDescription>
            여행방의 최근 협업 활동 내역입니다.
          </DrawerDescription>
          <p aria-live="polite" className="sr-only">
            {markReadMutation.isSuccess ? "새 변경을 모두 확인했습니다." : ""}
          </p>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-4 py-2">
          {isLoading ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="size-6 animate-spin text-foreground-muted" />
            </div>
          ) : isError ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-center">
              <p className="text-sm text-foreground-muted">활동 내역을 불러오지 못했습니다.</p>
              <Button size="sm" variant="outline" onClick={() => void refetch()}>
                다시 시도
              </Button>
            </div>
          ) : allEvents.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-center text-foreground-muted">
              <CheckCheck className="size-8 text-foreground-muted/60" />
              <p className="text-sm">아직 새로운 활동이 없습니다.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {allEvents.map((event) => {
                const { title, subtitle } = getActivityMessage(event);
                const isClickable = Boolean(event.target?.path);

                const content = (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium text-foreground [overflow-wrap:anywhere]">
                        {title}
                        {event.isOwn && (
                          <span className="ml-1.5 inline-block rounded bg-muted px-1.5 py-0.5 text-[10px] font-normal text-foreground-muted">
                            내 활동
                          </span>
                        )}
                      </span>
                      <time
                        dateTime={event.createdAt}
                        title={formatExactDateTime(event.createdAt)}
                        className="shrink-0 text-xs text-foreground-muted"
                      >
                        {formatTimeAgo(event.createdAt)}
                        <span className="sr-only">
                          ({formatExactDateTime(event.createdAt)})
                        </span>
                      </time>
                    </div>
                    {subtitle && (
                      <span className="text-xs text-foreground-muted">
                        {subtitle}
                      </span>
                    )}
                  </>
                );

                return (
                  <li
                    key={event.sequence}
                    className="flex flex-col rounded-xl border border-border/60 bg-card text-sm"
                  >
                    {isClickable ? (
                      <button
                        type="button"
                        onClick={() => handleItemClick(event)}
                        className="flex w-full flex-col gap-0.5 rounded-xl p-3 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {content}
                      </button>
                    ) : (
                      <div className="flex flex-col gap-0.5 p-3">
                        {content}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {hasNextPage && (
            <div className="mt-4 flex justify-center pb-4">
              <Button
                variant="outline"
                size="sm"
                disabled={isFetchingNextPage}
                onClick={() => void fetchNextPage()}
              >
                {isFetchingNextPage ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    불러오는 중...
                  </>
                ) : (
                  "이전 활동 더 보기"
                )}
              </Button>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

