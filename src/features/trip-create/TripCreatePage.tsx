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

      // 생성 성공 시 여행방 계획 탭 홈으로 이동 (기획서 TR-02 명세)
      await navigate(`/trips/${newRoom.id}/plans`, { replace: true });
    } catch (err: unknown) {
      setErrorMsg(toUserMessage(err, "여행을 만들지 못했어요. 다시 시도해주세요."));
    } finally {
      isSubmittingRef.current = false;
    }
  };

  const counterText = `(${title.length}/${MAX_TITLE_LENGTH})`;

  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      {!platformNavigation && <PageHeader back={{ onClick: goBack }} />}

      <main className="flex flex-1 flex-col">
        <PageBody withBottomAction>
        <PageTitle
          title="어떤 여행을 계획하고 있나요?"
          description="먼저 여행 이름만 정해주세요."
        />

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSubmit();
          }}
          className="flex flex-col px-(--app-inline-padding) pt-4"
        >
          <Field data-invalid={Boolean(errorMsg) || undefined}>
            <FieldLabel htmlFor="trip-title">여행 이름 *</FieldLabel>
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
              aria-invalid={Boolean(errorMsg) || undefined}
              required
              className="h-12 rounded-xl px-4"
            />
            {errorMsg ? (
              <FieldError>
                {errorMsg} {counterText}
              </FieldError>
            ) : (
              <FieldDescription className="text-[13px]">
                여행방을 만든 후 첫 번째 여행안을 제안할 수 있어요. {counterText}
              </FieldDescription>
            )}
          </Field>
        </form>
        </PageBody>
      </main>

      {/* 화면 하단 고정 CTA: 입력 중 키보드가 올라와도 가려지지 않아요. */}
      <BottomAction>
        <Button
          type="button"
          size="xl"
          disabled={!isValid || createRoomMutation.isPending}
          onClick={() => void handleSubmit()}
        >
          {createRoomMutation.isPending && <Spinner aria-hidden="true" />}
          {createRoomMutation.isPending ? "여행방 만드는 중..." : "여행 만들기"}
        </Button>
      </BottomAction>
    </div>
  );
}
