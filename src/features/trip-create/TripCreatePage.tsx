import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAppNavigation } from "../../hooks/useAppNavigation.ts";
import { useCreateTripRoomMutation } from "./mutations.ts";
import { toUserMessage } from "../common/error-message.ts";
import { PageHeader } from "@/components/galanda/page-header.tsx";
import { PageBody } from "@/components/galanda/page-body.tsx";
import { PageTitle } from "@/components/galanda/page-title.tsx";
import { BottomAction } from "@/components/galanda/bottom-action.tsx";
import { TripCreationProgress } from "@/components/galanda/trip-creation-progress.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { cn } from "@/lib/utils.ts";
import { OFFLINE_MUTATION_MESSAGE } from "../../app/offline-mutation.ts";
import { useOnlineStatus } from "../../hooks/useOnlineStatus.ts";

const MAX_TITLE_LENGTH = 30;

export function TripCreatePage() {
  const navigate = useNavigate();
  const { goBack, platformNavigation } = useAppNavigation();
  const inputRef = useRef<HTMLInputElement>(null);
  const isSubmittingRef = useRef(false);
  const isOnline = useOnlineStatus();

  const [title, setTitle] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const createRoomMutation = useCreateTripRoomMutation();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const trimmedTitle = title.trim();
  const isOverLimit = trimmedTitle.length > MAX_TITLE_LENGTH;
  const isWhitespaceOnly = title.length > 0 && trimmedTitle.length === 0;
  const isValid = trimmedTitle.length >= 1 && !isOverLimit;

  const inlineError = isOverLimit
    ? "여행 이름은 최대 30자까지 입력할 수 있어요."
    : isWhitespaceOnly
      ? "공백을 제외하고 1자 이상 입력해주세요."
      : null;

  const displayedError = errorMsg || inlineError;

  const handleSubmit = async () => {
    if (isOverLimit) {
      setErrorMsg("여행 이름은 최대 30자까지 입력할 수 있어요.");
      return;
    }
    if (isWhitespaceOnly) {
      setErrorMsg("공백을 제외하고 1자 이상 입력해주세요.");
      return;
    }
    if (
      !isValid ||
      !isOnline ||
      createRoomMutation.isPending ||
      isSubmittingRef.current
    ) {
      if (!isOnline) setErrorMsg(OFFLINE_MUTATION_MESSAGE);
      else if (!isValid) setErrorMsg("여행 이름을 입력해 주세요.");
      return;
    }

    isSubmittingRef.current = true;
    setErrorMsg(null);
    try {
      const newRoom = await createRoomMutation.mutateAsync({
        title: trimmedTitle,
      });

      // 생성 폼 entry를 canonical 여행방 anchor로 바꾼 뒤 Wizard slot을 push한다.
      // 이후 단계와 상세 화면은 이 slot만 replace하므로 browser/native Back이 여행방으로 돌아간다.
      navigate(`/trips/${newRoom.id}/plans`, { replace: true });
      navigate(`/trips/${newRoom.id}/setup/companions`);
    } catch (err: unknown) {
      setErrorMsg(toUserMessage(err, "여행을 만들지 못했어요. 다시 시도해주세요."));
    } finally {
      isSubmittingRef.current = false;
    }
  };

  const counterText = `${trimmedTitle.length}/${MAX_TITLE_LENGTH}`;
  const helperText = !isValid
    ? "여행 이름을 입력해 주세요."
    : "다음 단계에서 동행자를 초대하거나 바로 여행안을 작성할 수 있어요.";

  return (
    <div
      data-galanda-surface="content"
      className="flex min-h-dvh flex-1 flex-col"
    >
      {!platformNavigation && (
        <PageHeader
          title="여행 만들기"
          back={{ label: "뒤로 가기", onClick: () => void goBack() }}
          surface="none"
        />
      )}

      <main className="flex flex-1 flex-col">
        <PageBody withBottomAction className="flex flex-col">
          <TripCreationProgress
            currentStep="trip-info"
            className="mx-(--app-inline-padding) mt-1"
          />

          <PageTitle
            title="여행 이름을 정해주세요"
            description="여행방을 먼저 만든 뒤 동행자 초대와 첫 여행안 작성을 이어갈 수 있어요."
            className="pt-5 pb-2"
          />

          <form
            id="trip-create-form"
            onSubmit={(e) => {
              e.preventDefault();
              void handleSubmit();
            }}
            className="mx-(--app-inline-padding) mt-3 flex flex-col rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5"
          >
            <Field
              data-invalid={Boolean(displayedError) || undefined}
              className="gap-3"
            >
              <FieldLabel
                htmlFor="trip-title"
                className="text-base font-semibold text-foreground"
              >
                여행 이름 *
              </FieldLabel>
              <Input
                id="trip-title"
                ref={inputRef}
                placeholder="예: 일본 여행, 2026 제주 힐링"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (errorMsg) setErrorMsg(null);
                }}
                aria-describedby="trip-title-help"
                aria-invalid={Boolean(displayedError) || undefined}
                required
                className="h-14 rounded-xl border-border bg-background px-4 text-base"
              />
              {displayedError ? (
                <FieldError
                  id="trip-title-help"
                  className="flex items-start justify-between gap-3"
                >
                  <span className="min-w-0 flex-1">{displayedError}</span>
                  <span
                    className={cn(
                      "shrink-0 tabular-nums",
                      isOverLimit && "text-destructive font-semibold",
                    )}
                  >
                    {counterText}
                  </span>
                </FieldError>
              ) : (
                <FieldDescription
                  id="trip-title-help"
                  className="flex items-start justify-between gap-3"
                >
                  <span className="min-w-0 flex-1">{helperText}</span>
                  <span className="shrink-0 tabular-nums text-foreground-muted">
                    {counterText}
                  </span>
                </FieldDescription>
              )}
            </Field>
          </form>
        </PageBody>
      </main>

      <BottomAction
        surface="content"
        className="border-border"
        accessory={
          !isOnline ? (
            <p role="status" className="text-center text-sm text-foreground-muted">
              {OFFLINE_MUTATION_MESSAGE}
            </p>
          ) : undefined
        }
      >
        <Button
          type="submit"
          form="trip-create-form"
          size="xl"
          aria-busy={createRoomMutation.isPending || undefined}
          aria-live="polite"
          disabled={!isValid || createRoomMutation.isPending || !isOnline}
        >
          {createRoomMutation.isPending && <Spinner aria-hidden="true" />}
          {createRoomMutation.isPending
            ? "여행방 만드는 중..."
            : isOnline
              ? "여행 만들고 계속"
              : "온라인 연결 후 만들기"}
        </Button>
      </BottomAction>
    </div>
  );
}
