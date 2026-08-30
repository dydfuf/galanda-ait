import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAppNavigation } from "../../hooks/useAppNavigation.ts";
import { useCreateTripRoomMutation } from "./mutations.ts";
import { toUserMessage } from "../common/error-message.ts";
import { PageHeader } from "@/components/galanda/page-header.tsx";
import { PageBody } from "@/components/galanda/page-body.tsx";
import { PageTitle } from "@/components/galanda/page-title.tsx";
import { BottomAction } from "@/components/galanda/bottom-action.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";

const MAX_TITLE_LENGTH = 30;

export function TripCreatePage() {
  const navigate = useNavigate();
  const { goBack, platformNavigation } = useAppNavigation();
  const inputRef = useRef<HTMLInputElement>(null);
  const isSubmittingRef = useRef(false);

  const [title, setTitle] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const createRoomMutation = useCreateTripRoomMutation();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const trimmedTitle = title.trim();
  const isValid = trimmedTitle.length >= 1 && trimmedTitle.length <= MAX_TITLE_LENGTH;
  const handleSubmit = async () => {
    if (!isValid || createRoomMutation.isPending || isSubmittingRef.current) return;

    isSubmittingRef.current = true;
    setErrorMsg(null);
    try {
      const newRoom = await createRoomMutation.mutateAsync({
        title: trimmedTitle,
      });

      // 생성 성공 시 첫 여행안 작성으로 바로 연결해 dead-end 빈 PlanHome을 거치지 않는다.
      navigate(`/trips/${newRoom.id}/plans/new`, { replace: true });
    } catch (err: unknown) {
      setErrorMsg(toUserMessage(err, "여행을 만들지 못했어요. 다시 시도해주세요."));
    } finally {
      isSubmittingRef.current = false;
    }
  };

  const counterText = `${title.length}/${MAX_TITLE_LENGTH}`;
  const helperText = !isValid
    ? "여행 이름을 입력해 주세요."
    : "여행방을 만든 후 첫 번째 여행안을 제안할 수 있어요.";

  return (
    <div
      data-galanda-surface="content"
      className="flex min-h-dvh flex-1 flex-col"
    >
      {!platformNavigation && (
        <PageHeader
          title="여행 만들기"
          back={{ onClick: () => void goBack() }}
          surface="none"
        />
      )}

      <main className="flex flex-1 flex-col">
        <PageBody withBottomAction className="flex flex-col">
          <PageTitle
            title="어떤 여행을 계획하고 있나요?"
            description="먼저 여행 이름만 정해주세요."
            className="pb-2"
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
              data-invalid={Boolean(errorMsg) || undefined}
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
                maxLength={MAX_TITLE_LENGTH}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (errorMsg) setErrorMsg(null);
                }}
                aria-describedby="trip-title-help"
                aria-invalid={Boolean(errorMsg) || undefined}
                required
                className="h-14 rounded-xl border-border bg-background px-4 text-base"
              />
              {errorMsg ? (
                <FieldError
                  id="trip-title-help"
                  className="flex items-start justify-between gap-3"
                >
                  <span className="min-w-0 flex-1">{errorMsg}</span>
                  <span className="shrink-0 tabular-nums">{counterText}</span>
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

      <BottomAction surface="content" className="border-border">
        <Button
          type="submit"
          form="trip-create-form"
          size="xl"
          aria-busy={createRoomMutation.isPending || undefined}
          aria-live="polite"
          disabled={!isValid || createRoomMutation.isPending}
        >
          {createRoomMutation.isPending && <Spinner aria-hidden="true" />}
          {createRoomMutation.isPending ? "여행방 만드는 중..." : "여행 만들기"}
        </Button>
      </BottomAction>
    </div>
  );
}
