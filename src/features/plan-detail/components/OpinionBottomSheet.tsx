import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button.tsx";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer.tsx";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { cn } from "@/lib/utils.ts";
import { REACTION_DISPLAY } from "../../common/reaction-display.tsx";

export type ReactionType = "LIKE" | "OKAY" | "HARD";

interface OpinionBottomSheetProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly initialReaction?: ReactionType;
  readonly initialReason?: string;
  readonly onSubmit: (reaction: ReactionType, reason?: string) => void;
  readonly isSubmitting?: boolean;
  readonly isOffline?: boolean;
  readonly errorMessage?: string;
}

const REACTION_EMOJI = {
  LIKE: "👍",
  OKAY: "🙂",
  HARD: "😢",
} as const satisfies Record<ReactionType, string>;

const REACTION_OPTIONS = REACTION_DISPLAY.map(({ key, label }) => ({
  value: key,
  emoji: REACTION_EMOJI[key],
  label,
})) satisfies ReadonlyArray<{
  value: ReactionType;
  emoji: string;
  label: string;
}>;

export function OpinionBottomSheet({
  isOpen,
  onClose,
  initialReaction,
  initialReason = "",
  onSubmit,
  isSubmitting = false,
  isOffline = false,
  errorMessage,
}: OpinionBottomSheetProps) {
  const [reaction, setReaction] = useState<ReactionType | undefined>(
    initialReaction,
  );
  const [reason, setReason] = useState(initialReason);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      setReaction(initialReaction);
      setReason(initialReason);
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, initialReaction, initialReason]);

  const isFormValid =
    Boolean(reaction) && (reaction !== "HARD" || reason.trim().length > 0);
  const handleSubmit = (): void => {
    if (!reaction || !isFormValid || isSubmitting || isOffline) return;
    onSubmit(reaction, reaction === "HARD" ? reason.trim() : undefined);
  };

  return (
    <Drawer
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      showSwipeHandle
      snapPoints={[0.7, 0.9]}
      defaultSnapPoint={0.7}
      keyboardAware
    >
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="text-left text-[17px] font-bold">
            이 여행안은 어때요?
          </DrawerTitle>
          <DrawerDescription className="text-left">
            내 의견은 언제든 바꿀 수 있어요.
          </DrawerDescription>
        </DrawerHeader>

        <div className="min-h-0 flex-1 overflow-y-auto bg-surface-raised px-4 pb-4">
          <div
            role="radiogroup"
            aria-label="이 여행안에 대한 내 의견"
            className="grid grid-cols-3 gap-2 py-4"
          >
            {REACTION_OPTIONS.map((option) => {
              const isSelected = reaction === option.value;

              return (
                <label
                  key={option.value}
                  className={cn(
                    "flex! min-h-19 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border bg-surface-content transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
                    isSelected
                      ? "border-primary bg-info-muted"
                      : "border-border",
                  )}
                >
                  <input
                    type="radio"
                    name="opinion-reaction"
                    value={option.value}
                    checked={isSelected}
                    disabled={isSubmitting}
                    onChange={() => setReaction(option.value)}
                    className="sr-only"
                  />
                  <span className="text-2xl" aria-hidden="true">
                    {option.emoji}
                  </span>
                  <span
                    className={cn(
                      "text-base font-bold",
                      isSelected ? "text-info" : "text-secondary-foreground",
                    )}
                  >
                    {option.label}
                  </span>
                </label>
              );
            })}
          </div>

          {reaction === "HARD" && (
            <Field>
              <FieldLabel htmlFor="opinion-hard-reason">어려운 이유</FieldLabel>
              <Textarea
                id="opinion-hard-reason"
                value={reason}
                disabled={isSubmitting}
                onChange={(event) => setReason(event.target.value)}
                placeholder="예: 예산, 숙소 위치, 이동 시간 등"
                rows={3}
                required
                className="rounded-xl bg-surface-content px-4 py-3"
              />
              <FieldDescription className="text-sm">
                방장과 나에게만 공개돼요.
              </FieldDescription>
            </Field>
          )}

          {errorMessage && (
            <p
              role="alert"
              className="mt-4 rounded-xl border border-destructive-border bg-destructive-muted p-3 text-base leading-relaxed text-destructive-strong"
            >
              {errorMessage}
            </p>
          )}
          {isOffline && (
            <p role="status" className="mt-4 text-sm text-foreground-muted">
              오프라인 상태에서는 저장할 수 없습니다. 입력 내용은 유지됩니다.
            </p>
          )}
        </div>

        <DrawerFooter>
          <Button
            type="button"
            size="xl"
            disabled={!isFormValid || isSubmitting || isOffline}
            aria-busy={isSubmitting}
            onClick={handleSubmit}
          >
            {isSubmitting
              ? "저장 중..."
              : isOffline
                ? "온라인 연결 후 저장"
                : "의견 저장하기"}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
