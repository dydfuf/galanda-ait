import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Result } from "effect";
import { useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ApiClientError,
  getCurrentSession,
  getInviteSummary,
  joinInvite,
  signInAnonymously,
} from "../../app/api-client.ts";
import {
  decodeRouteParams,
  InviteParamsSchema,
} from "../../app/routes/route-params.ts";
import { BottomAction } from "../../components/galanda/bottom-action.tsx";
import {
  MobileList,
  MobileListItem,
} from "../../components/galanda/mobile-list.tsx";
import { PageBody } from "../../components/galanda/page-body.tsx";
import { PageState } from "../../components/galanda/page-state.tsx";
import { PageTitle } from "../../components/galanda/page-title.tsx";
import { SectionHeader } from "../../components/galanda/section-header.tsx";
import { Button } from "../../components/ui/button.tsx";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "../../components/ui/field.tsx";
import { Input } from "../../components/ui/input.tsx";
import { Spinner } from "../../components/ui/spinner.tsx";
import { MAX_NICKNAME_LENGTH } from "../../core/domain/invite.ts";
import { useSessionQuery, sessionKeys } from "../../hooks/useSession.ts";
import { RouteErrorFallback } from "../common/RouteErrorFallback.tsx";
import { toUserMessage } from "../common/error-message.ts";
import { tripRoomKeys } from "../plan-home/queries.ts";
import { getRoomActor, isRoomConfirmed } from "../../core/domain/auth-guards.ts";
import { OFFLINE_MUTATION_MESSAGE } from "../../app/offline-mutation.ts";
import { useOnlineStatus } from "../../hooks/useOnlineStatus.ts";

const inviteKeys = {
  detail: (token: string) => ["invite", token] as const,
};

export function InvitePage(): JSX.Element {
  const validated = decodeRouteParams(InviteParamsSchema, useParams());
  const inviteToken = Result.isSuccess(validated)
    ? validated.success.inviteToken
    : undefined;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const sessionQuery = useSessionQuery();
  const isOnline = useOnlineStatus();
  const submittingRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const storageKey = `galanda:invite-nickname:${inviteToken ?? "invalid"}`;
  const [nickname, setNickname] = useState(() =>
    typeof sessionStorage === "undefined"
      ? ""
      : (sessionStorage.getItem(storageKey) ?? "")
  );
  const [errorMessage, setErrorMessage] = useState<string>();

  const inviteQuery = useQuery({
    queryKey: inviteKeys.detail(inviteToken ?? "invalid"),
    queryFn: ({ signal }) => {
      if (!inviteToken) throw new Error("invalid invite token");
      return getInviteSummary(inviteToken, signal);
    },
    enabled: Boolean(inviteToken),
    retry: false,
  });

  if (Result.isFailure(validated)) {
    return (
      <main className="flex min-h-dvh flex-1 flex-col">
        <PageBody safeTop>
          <RouteErrorFallback
            title="유효하지 않은 초대장"
            message="초대 링크가 만료되었거나 올바르지 않습니다."
          />
        </PageBody>
      </main>
    );
  }

  if (inviteQuery.isLoading) {
    return (
      <main className="flex min-h-dvh flex-1 flex-col">
        <PageBody safeTop>
          <PageState status="loading" message="초대장 정보를 확인하는 중..." />
        </PageBody>
      </main>
    );
  }

  if (inviteQuery.isError || !inviteQuery.data) {
    const invalid =
      inviteQuery.error instanceof ApiClientError &&
      inviteQuery.error.code === "INVITE_INVALID";
    return (
      <div className="flex min-h-dvh flex-1 flex-col">
        <main className="flex flex-1 flex-col">
          <PageBody safeTop withBottomAction>
            <PageState
              status="error"
              title={
                invalid
                  ? "유효하지 않은 초대장이에요"
                  : "초대장을 확인하지 못했어요"
              }
              description={
                invalid
                  ? "링크가 만료되었거나 폐기되었을 수 있어요."
                  : toUserMessage(
                      inviteQuery.error,
                      "잠시 후 다시 시도해주세요.",
                    )
              }
            />
          </PageBody>
        </main>

        <BottomAction>
          {!invalid && (
            <Button
              type="button"
              size="xl"
              onClick={() => void inviteQuery.refetch()}
            >
              다시 확인하기
            </Button>
          )}
          <Button
            type="button"
            size="xl"
            variant={invalid ? "default" : "secondary"}
            onClick={() => navigate("/trips", { replace: true })}
          >
            내 여행 목록으로 가기
          </Button>
        </BottomAction>
      </div>
    );
  }

  const summary = inviteQuery.data;
  const trimmedNickname = nickname.trim();
  const nicknameIsValid =
    trimmedNickname.length > 0 &&
    trimmedNickname.length <= MAX_NICKNAME_LENGTH;

  const handleJoin = async () => {
    if (
      !inviteToken ||
      (!summary.alreadyJoined && !nicknameIsValid) ||
      sessionQuery.isLoading ||
      sessionQuery.isError ||
      !isOnline ||
      submittingRef.current
    ) {
      if (!isOnline) setErrorMessage(OFFLINE_MUTATION_MESSAGE);
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    setErrorMessage(undefined);
    try {
      let session = sessionQuery.data;
      if (!session) {
        await signInAnonymously();
        session = await queryClient.fetchQuery({
          queryKey: sessionKeys.current(),
          queryFn: ({ signal }) => getCurrentSession(signal),
          staleTime: 0,
        });
      }
      if (!session) throw new Error("참여할 세션을 확인하지 못했어요. 다시 시도해주세요.");
      const room = await joinInvite(
        inviteToken,
        summary.alreadyJoined ? (session?.name ?? trimmedNickname) : trimmedNickname
      );
      sessionStorage.removeItem(storageKey);
      await queryClient.invalidateQueries({ queryKey: tripRoomKeys.all });
      const target = !isRoomConfirmed(room) &&
        getRoomActor(room, session.participantIds).can("opinion:submit")
        ? room.plans.find((plan) => plan.status === "VOTING" &&
            !plan.memberOpinions?.some((opinion) =>
              session.participantIds.includes(opinion.userId)))
        : undefined;
      navigate(`/trips/${room.id}/plans${target ? `/${target.id}` : ""}`, {
        replace: true,
      });
    } catch (error: unknown) {
      setErrorMessage(
        toUserMessage(error, "여행에 참여하지 못했어요. 다시 시도해주세요.")
      );
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const completionCondition = sessionQuery.isLoading
    ? "참여 가능 여부를 확인하고 있어요."
    : sessionQuery.isError
      ? "인증 서비스 재확인이 필요해요."
      : !isOnline
        ? OFFLINE_MUTATION_MESSAGE
        : !summary.alreadyJoined && !nicknameIsValid
        ? "닉네임을 입력해 주세요."
        : undefined;

  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      <main className="flex flex-1 flex-col">
        <PageBody safeTop withBottomAction className="flex flex-col">
          <PageTitle
            title={`${summary.title}에 초대받았어요`}
            description={`${summary.inviterName}님이 함께 여행하자고 초대했어요.`}
          />

          <section>
            <SectionHeader title="여행 정보" />
            <MobileList
              aria-label="초대받은 여행 정보"
              className="mx-(--app-inline-padding) w-auto overflow-hidden rounded-2xl border bg-surface-content"
            >
              {summary.destination && (
                <MobileListItem
                  trailing={
                    <span className="text-base font-medium text-foreground">
                      {summary.destination}
                    </span>
                  }
                >
                  <span className="text-base text-foreground-muted">
                    목적지
                  </span>
                </MobileListItem>
              )}
              {summary.startDate && summary.endDate && (
                <MobileListItem
                  trailing={
                    <span className="text-base font-medium text-foreground">
                      {summary.startDate} ~ {summary.endDate}
                    </span>
                  }
                >
                  <span className="text-base text-foreground-muted">일정</span>
                </MobileListItem>
              )}
              <MobileListItem
                trailing={
                  <span className="text-base font-medium text-foreground">
                    {summary.participantCount}명
                  </span>
                }
              >
                <span className="text-base text-foreground-muted">
                  참여 인원
                </span>
              </MobileListItem>
            </MobileList>
          </section>

          {!summary.alreadyJoined && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void handleJoin();
              }}
              className="px-(--app-inline-padding) pt-6"
            >
              <Field data-invalid={Boolean(errorMessage) || undefined}>
                <FieldLabel htmlFor="invite-nickname">
                  어떤 이름으로 참여할까요?
                </FieldLabel>
                <Input
                  id="invite-nickname"
                  autoComplete="nickname"
                  maxLength={MAX_NICKNAME_LENGTH}
                  placeholder="여행에서 사용할 닉네임"
                  value={nickname}
                  onChange={(event) => {
                    setNickname(event.target.value);
                    sessionStorage.setItem(storageKey, event.target.value);
                    setErrorMessage(undefined);
                  }}
                  aria-invalid={Boolean(errorMessage) || undefined}
                  className="h-12 rounded-xl px-4"
                />
                {errorMessage ? (
                  <FieldError>{errorMessage}</FieldError>
                ) : (
                  <FieldDescription>
                    계정 없이 이 여행에서 사용할 이름만 입력하면 돼요.
                    참여하면 여행안을 보고 바로 의견을 남길 수 있어요.
                  </FieldDescription>
                )}
              </Field>
            </form>
          )}

          {summary.alreadyJoined && (
            <output
              className="mx-(--app-inline-padding) mt-6 block rounded-xl border border-info/30 bg-info-muted p-4 text-base leading-relaxed text-foreground"
              aria-live="polite"
            >
              이미 이 여행에 참여하고 있어요. 여행방으로 바로 돌아갈 수 있어요.
            </output>
          )}

          {summary.alreadyJoined && errorMessage && (
            <p
              className="mx-(--app-inline-padding) mt-4 text-base leading-relaxed text-destructive"
              role="alert"
            >
              {errorMessage}
            </p>
          )}

          {sessionQuery.isError && (
            <div className="mx-(--app-inline-padding) mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
              <p
                className="text-base leading-relaxed text-destructive"
                role="alert"
              >
                인증 서비스를 확인하지 못했어요.
              </p>
              <Button
                type="button"
                variant="link"
                onClick={() => void sessionQuery.refetch()}
              >
                다시 시도
              </Button>
            </div>
          )}
        </PageBody>
      </main>

      <BottomAction
        accessory={
          completionCondition ? (
            <p
              className="text-center text-base leading-relaxed text-foreground-muted"
              role={sessionQuery.isLoading ? "status" : undefined}
              aria-live={sessionQuery.isLoading ? "polite" : undefined}
            >
              {completionCondition}
            </p>
          ) : undefined
        }
      >
        <Button
          type="button"
          size="xl"
          aria-busy={isSubmitting || undefined}
          disabled={
            (!summary.alreadyJoined && !nicknameIsValid) ||
            sessionQuery.isLoading ||
            sessionQuery.isError ||
            isSubmitting ||
            !isOnline
          }
          onClick={() => void handleJoin()}
        >
          {isSubmitting && <Spinner aria-hidden="true" />}
          {isSubmitting
            ? "참여하는 중..."
            : !isOnline
              ? "온라인 연결 후 참여하기"
              : summary.alreadyJoined
              ? "여행방으로 돌아가기"
              : "이 이름으로 참여하고 의견 남기기"}
        </Button>
        <Button
          type="button"
          size="xl"
          variant="secondary"
          className="flex-none!"
          onClick={() => navigate("/trips", { replace: true })}
        >
          취소
        </Button>
      </BottomAction>
    </div>
  );
}
