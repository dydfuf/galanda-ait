import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Result } from "effect";
import { useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ApiClientError,
  getInviteSummary,
  joinInvite,
  signInAnonymously,
} from "../../app/api-client.ts";
import {
  decodeRouteParams,
  InviteParamsSchema,
} from "../../app/routes/route-params.ts";
import { Button } from "../../components/ui/button.tsx";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "../../components/ui/field.tsx";
import { Input } from "../../components/ui/input.tsx";
import { MAX_NICKNAME_LENGTH } from "../../core/domain/invite.ts";
import { useSessionQuery, sessionKeys } from "../../hooks/useSession.ts";
import { RouteErrorFallback } from "../common/RouteErrorFallback.tsx";
import { toUserMessage } from "../common/error-message.ts";
import { tripRoomKeys } from "../plan-home/queries.ts";

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
      <RouteErrorFallback
        title="유효하지 않은 초대장"
        message="초대 링크가 만료되었거나 올바르지 않습니다."
      />
    );
  }

  if (inviteQuery.isLoading) {
    return (
      <main className="flex min-h-dvh flex-1 items-center justify-center px-5">
        <p className="text-sm text-muted-foreground">초대장 정보를 확인하는 중...</p>
      </main>
    );
  }

  if (inviteQuery.isError || !inviteQuery.data) {
    const invalid =
      inviteQuery.error instanceof ApiClientError &&
      inviteQuery.error.code === "INVITE_INVALID";
    return (
      <main className="flex min-h-dvh flex-1 items-center justify-center px-5">
        <section className="w-full max-w-sm rounded-2xl border bg-background p-6 text-center shadow-sm">
          <div className="mb-3 text-4xl" aria-hidden="true">⚠️</div>
          <h1 className="text-xl font-bold">
            {invalid ? "유효하지 않은 초대장이에요" : "초대장을 확인하지 못했어요"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {invalid
              ? "링크가 만료되었거나 폐기되었을 수 있어요."
              : toUserMessage(inviteQuery.error, "잠시 후 다시 시도해주세요.")}
          </p>
          {!invalid && (
            <Button className="mt-6 w-full" size="lg" onClick={() => void inviteQuery.refetch()}>
              다시 확인하기
            </Button>
          )}
          <Button className="mt-2 w-full" variant="ghost" onClick={() => navigate("/trips", { replace: true })}>
            내 여행 목록으로 가기
          </Button>
        </section>
      </main>
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
      submittingRef.current
    ) {
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    setErrorMessage(undefined);
    try {
      let session = sessionQuery.data;
      if (!session) {
        await signInAnonymously();
        await queryClient.invalidateQueries({ queryKey: sessionKeys.all });
        session = queryClient.getQueryData(sessionKeys.current());
      }
      const room = await joinInvite(
        inviteToken,
        summary.alreadyJoined ? (session?.name ?? trimmedNickname) : trimmedNickname
      );
      sessionStorage.removeItem(storageKey);
      await queryClient.invalidateQueries({ queryKey: tripRoomKeys.all });
      navigate(`/trips/${room.id}`, { replace: true });
    } catch (error: unknown) {
      setErrorMessage(
        toUserMessage(error, "여행에 참여하지 못했어요. 다시 시도해주세요.")
      );
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-dvh flex-1 items-center justify-center px-5 py-8">
      <section className="w-full max-w-sm rounded-2xl border bg-background p-6 shadow-sm">
        <div className="text-center">
          <div className="mb-3 text-4xl" aria-hidden="true">💌</div>
          <h1 className="text-xl font-bold">{summary.title}에 초대받았어요</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {summary.inviterName}님이 함께 여행하자고 초대했어요.
          </p>
        </div>

        <dl className="my-6 space-y-2 rounded-xl border bg-muted/40 p-4 text-sm">
          {summary.destination && (
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">목적지</dt>
              <dd>{summary.destination}</dd>
            </div>
          )}
          {summary.startDate && summary.endDate && (
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">일정</dt>
              <dd>{summary.startDate} ~ {summary.endDate}</dd>
            </div>
          )}
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">참여 인원</dt>
            <dd>{summary.participantCount}명</dd>
          </div>
        </dl>

        {!summary.alreadyJoined && (
          <Field data-invalid={Boolean(errorMessage) || undefined}>
            <FieldLabel htmlFor="invite-nickname">어떤 이름으로 참여할까요?</FieldLabel>
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
              onKeyDown={(event) => {
                if (event.key === "Enter") void handleJoin();
              }}
              aria-invalid={Boolean(errorMessage) || undefined}
              className="h-12 px-4"
            />
            {errorMessage ? (
              <FieldError role="alert">{errorMessage}</FieldError>
            ) : (
              <FieldDescription>가입 폼 없이 이 여행에만 사용할 이름이에요.</FieldDescription>
            )}
          </Field>
        )}

        {summary.alreadyJoined && errorMessage && (
          <p className="text-sm text-destructive" role="alert">{errorMessage}</p>
        )}
        {sessionQuery.isError && (
          <div className="text-center">
            <p className="text-sm text-destructive" role="alert">
              인증 서비스를 확인하지 못했어요.
            </p>
            <Button variant="link" onClick={() => void sessionQuery.refetch()}>
              다시 시도
            </Button>
          </div>
        )}

        <Button
          type="button"
          size="xl"
          className="mt-6 w-full"
          disabled={
            (!summary.alreadyJoined && !nicknameIsValid) ||
            sessionQuery.isLoading ||
            sessionQuery.isError ||
            isSubmitting
          }
          onClick={() => void handleJoin()}
        >
          {isSubmitting
            ? "참여하는 중..."
            : summary.alreadyJoined
              ? "여행방으로 돌아가기"
              : "이 이름으로 참여하기"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="mt-2 w-full"
          onClick={() => navigate("/trips", { replace: true })}
        >
          취소
        </Button>
      </section>
    </main>
  );
}
