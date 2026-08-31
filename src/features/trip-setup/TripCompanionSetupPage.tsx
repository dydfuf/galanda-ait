import { useEffect, useRef, useState } from "react";
import { Share2 } from "lucide-react";
import { Result } from "effect";
import { useNavigate, useParams } from "react-router-dom";

import {
  decodeRouteParams,
  TripParamsSchema,
} from "@/app/routes/route-params.ts";
import { BottomAction } from "@/components/galanda/bottom-action.tsx";
import { PageBody } from "@/components/galanda/page-body.tsx";
import { PageHeader } from "@/components/galanda/page-header.tsx";
import { PageState } from "@/components/galanda/page-state.tsx";
import { PageTitle } from "@/components/galanda/page-title.tsx";
import { TripCreationProgress } from "@/components/galanda/trip-creation-progress.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import {
  getRoomActor,
  isRoomConfirmed,
} from "@/core/domain/auth-guards.ts";
import { useAppNavigation } from "@/hooks/useAppNavigation.ts";
import type { ShareOutcome } from "@/platform/index.ts";
import { RouteErrorFallback } from "../common/RouteErrorFallback.tsx";
import { useSessionQuery } from "../../hooks/useSession.ts";
import { shareTripInvite } from "../invite/share-trip-invite.ts";
import { useTripRoomRawQuery } from "../plan-detail/queries.ts";

type SetupShareResult = ShareOutcome | "failed";

const SHARE_RESULT_MESSAGE: Record<SetupShareResult, string> = {
  shared: "초대 링크를 공유했어요.",
  copied: "초대 링크를 복사했어요.",
  cancelled: "공유를 취소했어요. 원할 때 다시 시도할 수 있어요.",
  unsupported:
    "이 환경에서는 링크를 공유할 수 없어요. 여행방에서 다시 시도해주세요.",
  failed: "초대 링크를 만들지 못했어요. 다시 시도해주세요.",
};

export function TripCompanionSetupPage() {
  const params = useParams();
  const navigate = useNavigate();
  const { goBack, platformNavigation } = useAppNavigation();
  const validated = decodeRouteParams(TripParamsSchema, params);
  const tripId = Result.isSuccess(validated) ? validated.success.tripId : "";

  const {
    data: room,
    isLoading: isRoomLoading,
    isError: isRoomError,
  } = useTripRoomRawQuery(tripId);
  const {
    data: session,
    isLoading: isSessionLoading,
    isError: isSessionError,
  } = useSessionQuery();

  const isSharingRef = useRef(false);
  const [isSharing, setIsSharing] = useState(false);
  const [shareResult, setShareResult] = useState<SetupShareResult>();
  const [platformTopInset, setPlatformTopInset] = useState(
    platformNavigation?.contentTopInset ?? 0,
  );

  useEffect(
    () => platformNavigation?.subscribeContentTopInset(setPlatformTopInset),
    [platformNavigation],
  );

  if (Result.isFailure(validated)) {
    return <RouteErrorFallback message="유효하지 않은 여행방 식별자입니다." />;
  }

  const actor =
    room && session ? getRoomActor(room, session.participantIds) : undefined;
  const isFirstPlanSetup = Boolean(
    room && room.plans.length === 0 && !isRoomConfirmed(room),
  );
  const canManageSetup = Boolean(
    isFirstPlanSetup && actor?.can("room:invite") && actor.can("plan:create"),
  );
  const isLoading = isRoomLoading || isSessionLoading;
  const hasLoadError =
    isRoomError || isSessionError || (!isLoading && (!room || !session));
  const planCreatePath = `/trips/${tripId}/plans/new/basic`;
  const hasShared = shareResult === "shared" || shareResult === "copied";

  const handleShare = async (): Promise<void> => {
    if (!canManageSetup || isSharingRef.current) return;

    isSharingRef.current = true;
    setIsSharing(true);
    setShareResult(undefined);
    try {
      setShareResult(await shareTripInvite(tripId));
    } finally {
      isSharingRef.current = false;
      setIsSharing(false);
    }
  };

  const bodyStyle = platformNavigation
    ? {
        paddingTop: `calc(var(--app-page-padding-top) + ${platformTopInset}px)`,
      }
    : undefined;

  return (
    <div
      data-galanda-surface="content"
      className="flex min-h-dvh flex-1 flex-col"
    >
      {!platformNavigation && (
        <PageHeader
          title="새 여행 만들기"
          back={{
            label: "여행 설정 닫기",
            onClick: () => void goBack(`/trips/${tripId}/plans`),
          }}
          surface="none"
        />
      )}

      <main className="flex flex-1 flex-col">
        <PageBody
          withBottomAction={canManageSetup}
          data-slot="trip-companion-setup-body"
          style={bodyStyle}
          className="flex flex-col"
        >
          {isLoading ? (
            <PageState
              status="loading"
              message="여행방 정보를 확인하는 중이에요."
            />
          ) : hasLoadError ? (
            <PageState
              status="error"
              title="여행방을 확인할 수 없어요"
              description="요청한 여행방이 없거나 접근 권한이 없어요."
              actionText="내 여행으로 이동"
              onAction={() => navigate("/trips", { replace: true })}
            />
          ) : !isFirstPlanSetup ? (
            <PageState
              status="empty"
              title="여행 만들기 단계가 끝났어요"
              description="이미 여행안이 있거나 확정된 여행은 현재 여행방에서 관리할 수 있어요."
              actionText="여행방으로 이동"
              onAction={() =>
                navigate(`/trips/${tripId}/plans`, { replace: true })
              }
            />
          ) : !canManageSetup ? (
            <PageState
              status="error"
              title="여행 설정 권한이 없어요"
              description="동행자 초대 단계는 이 여행을 만든 방장만 이용할 수 있어요."
              actionText="여행방으로 이동"
              onAction={() =>
                navigate(`/trips/${tripId}/plans`, { replace: true })
              }
            />
          ) : (
            <>
              <TripCreationProgress
                currentStep="companions"
                className="mx-(--app-inline-padding) mt-1"
              />

              <PageTitle
                title="함께 여행할 사람을 초대할까요?"
                description="초대는 선택 사항이에요. 지금 공유하거나 여행방에서 나중에 다시 공유할 수 있어요."
                className="pt-5 pb-2"
              />

              <section
                aria-labelledby="trip-companion-share-title"
                className="mx-(--app-inline-padding) mt-3 flex min-w-0 flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary-muted text-primary">
                    <Share2 className="size-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2
                      id="trip-companion-share-title"
                      className="text-lg leading-snug font-bold text-foreground [overflow-wrap:anywhere]"
                    >
                      초대 링크 공유
                    </h2>
                    <p className="mt-1 text-base leading-relaxed text-foreground-muted [overflow-wrap:anywhere]">
                      링크로 참여한 사람은 이 여행의 멤버로 추가돼요.
                    </p>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  aria-busy={isSharing || undefined}
                  disabled={isSharing}
                  onClick={() => void handleShare()}
                >
                  {isSharing && <Spinner aria-hidden="true" />}
                  {isSharing ? "초대 링크 준비 중..." : "초대 링크 공유하기"}
                </Button>

                {shareResult && (
                  <p
                    role={shareResult === "failed" ? "alert" : "status"}
                    aria-live={
                      shareResult === "failed" ? "assertive" : "polite"
                    }
                    className={
                      shareResult === "failed"
                        ? "text-sm leading-relaxed text-destructive-strong"
                        : "text-sm leading-relaxed text-foreground-muted"
                    }
                  >
                    {SHARE_RESULT_MESSAGE[shareResult]}
                  </p>
                )}
              </section>
            </>
          )}
        </PageBody>
      </main>

      {canManageSetup && (
        <BottomAction surface="content" className="border-border">
          <Button
            type="button"
            size="xl"
            disabled={isSharing}
            onClick={() =>
              navigate(planCreatePath, {
                replace: true,
                state: {
                  tripCreationWizard: true,
                  wizardEntrySource: "companions",
                },
              })
            }
          >
            {hasShared ? "다음: 기본 정보" : "미정으로 두고 다음"}
          </Button>
        </BottomAction>
      )}
    </div>
  );
}
