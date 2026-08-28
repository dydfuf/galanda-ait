import { useRef, useState } from "react";
import { Result } from "effect";
import { useNavigate, useParams } from "react-router-dom";
import { BottomAction } from "@/components/galanda/bottom-action.tsx";
import { PageBody } from "@/components/galanda/page-body.tsx";
import { PageState } from "@/components/galanda/page-state.tsx";
import { PageTitle } from "@/components/galanda/page-title.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import type {
  ConfirmedItinerary,
  ItineraryItemPatch,
} from "../../core/domain/confirmed-itinerary.ts";
import {
  decodeRouteParams,
  TripParamsSchema,
} from "../../app/routes/route-params.ts";
import { RouteErrorFallback } from "../common/RouteErrorFallback.tsx";
import {
  isRevisionConflict,
  isStateConflict,
  toRevisionConflictMessage,
  toUserMessage,
} from "../common/error-message.ts";
import { useItineraryQuery } from "./queries.ts";
import { useReviseItineraryMutation } from "./mutations.ts";
import {
  getChangedItineraryPatches,
  getItineraryEditorValidation,
  rebaseItineraryPatches,
  type ItineraryEditorField,
} from "./itinerary-editor-state.ts";

const ITINERARY_EDITOR_FORM_ID = "itinerary-edit-form";
const ITINERARY_VALIDATION_ID = "itinerary-edit-validation";

const toItineraryPatches = (
  itinerary: ConfirmedItinerary,
): ItineraryItemPatch[] =>
  itinerary.snapshot.items.map((item) =>
    item.type === "STAY"
      ? {
          type: "STAY",
          itemId: item.accommodation.id,
          date: item.date,
          endDate: item.endDate,
          hotelName: item.accommodation.hotelName,
          memo: item.memo,
        }
      : {
          type: "TRANSPORT",
          itemId: item.transport.id,
          date: item.date,
          fromCity: item.transport.fromCity,
          toCity: item.transport.toCity,
          mode: item.transport.mode,
          memo: item.memo,
        },
  );

function ItineraryEditor({
  tripId,
  itinerary,
  onRefresh,
}: {
  readonly tripId: string;
  readonly itinerary: ConfirmedItinerary;
  readonly onRefresh: () => Promise<ConfirmedItinerary | undefined>;
}) {
  const navigate = useNavigate();
  const mutation = useReviseItineraryMutation();
  const isSubmittingRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expectedRevision, setExpectedRevision] = useState(
    itinerary.currentRevision,
  );
  const [basePatches, setBasePatches] = useState(() =>
    toItineraryPatches(itinerary),
  );
  const [patches, setPatches] = useState(() => toItineraryPatches(itinerary));
  const [conflictNotice, setConflictNotice] = useState<string>();
  const [saveError, setSaveError] = useState<string>();
  const [isResolvingConflict, setIsResolvingConflict] = useState(false);

  const update = (index: number, patch: ItineraryItemPatch) =>
    setPatches((current) => [
      ...current.slice(0, index),
      patch,
      ...current.slice(index + 1),
    ]);

  const validation = getItineraryEditorValidation(patches);
  const changedPatches = getChangedItineraryPatches(basePatches, patches);
  const unchanged = changedPatches.length === 0;
  const isSubmitPending =
    isSubmitting || mutation.isPending || isResolvingConflict;
  const isFieldInvalid = (
    itemId: string,
    field: ItineraryEditorField,
  ): boolean =>
    validation.errors.some(
      (error) => error.itemId === itemId && error.fields.includes(field),
    );

  const save = async (): Promise<void> => {
    if (
      !validation.isValid ||
      unchanged ||
      isSubmitPending ||
      isSubmittingRef.current
    ) {
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setConflictNotice(undefined);
    setSaveError(undefined);

    try {
      await mutation.mutateAsync({
        tripId,
        patches: changedPatches,
        expectedRevision,
      });
      navigate(`/trips/${tripId}/itinerary`, { replace: true });
    } catch (error: unknown) {
      if (isRevisionConflict(error) || isStateConflict(error)) {
        setIsResolvingConflict(true);
        let latest: ConfirmedItinerary | undefined;
        try {
          latest = await onRefresh();
        } catch {
          latest = undefined;
        }

        if (!latest) {
          setConflictNotice(
            "최신 일정 상태를 불러오지 못했습니다. 입력을 유지한 채 다시 시도해주세요.",
          );
        } else {
          const latestPatches = toItineraryPatches(latest);
          const rebasedPatches = rebaseItineraryPatches(
            basePatches,
            patches,
            latestPatches,
          );
          const hasRebasedChanges =
            getChangedItineraryPatches(latestPatches, rebasedPatches).length >
            0;

          setPatches(rebasedPatches);
          setBasePatches(latestPatches);
          setExpectedRevision(latest.currentRevision);
          setConflictNotice(
            isRevisionConflict(error)
              ? `${toRevisionConflictMessage(error)} ${
                  hasRebasedChanges
                    ? "내 변경을 최신 일정에 다시 적용했습니다. 내용을 확인한 뒤 저장을 다시 눌러주세요."
                    : "작성한 내용과 최신 일정이 같아 추가로 저장할 변경이 없습니다."
                }`
              : hasRebasedChanges
                ? "여행 상태가 변경되어 최신 내용을 불러왔습니다. 내 변경은 유지했습니다. 내용을 확인한 뒤 저장을 다시 눌러주세요."
                : "여행 상태가 변경되어 최신 내용을 불러왔습니다. 추가로 저장할 변경은 없습니다.",
          );
        }
        setIsResolvingConflict(false);
      } else {
        setSaveError(toUserMessage(error, "일정을 저장하지 못했습니다."));
      }
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const completionCondition = !validation.isValid
    ? validation.firstError
    : unchanged
      ? "변경할 일정 내용을 입력해주세요."
      : undefined;
  const actionLabel = isResolvingConflict
    ? "최신 일정 불러오는 중..."
    : isSubmitPending
      ? "변경 저장 중..."
      : conflictNotice
        ? "내 변경 다시 저장"
        : "변경 저장";

  return (
    <PageBody
      withBottomAction
      data-system-state="success"
      className="flex min-w-0 flex-col gap-4"
    >
      <PageTitle
        title="확정 일정 수정"
        description={`수정 기준 v${expectedRevision} · 저장하면 새 revision이 생성됩니다.`}
      />

      <form
        id={ITINERARY_EDITOR_FORM_ID}
        className="flex min-w-0 flex-col gap-4 px-(--app-inline-padding)"
        aria-busy={isSubmitPending || undefined}
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        {patches.map((patch, index) => (
          <FieldSet
            key={`${patch.type}-${patch.itemId}`}
            disabled={isSubmitPending}
            className="min-w-0 rounded-2xl border border-border bg-surface-content p-4"
          >
            <FieldLegend>
              {patch.type === "STAY" ? "숙소 일정" : "이동 일정"} {index + 1}
            </FieldLegend>
            <FieldGroup className="gap-4">
              <Field
                data-invalid={isFieldInvalid(patch.itemId, "date") || undefined}
              >
                <FieldLabel htmlFor={`date-${patch.itemId}`}>날짜</FieldLabel>
                <Input
                  id={`date-${patch.itemId}`}
                  type="date"
                  value={patch.date}
                  aria-invalid={
                    isFieldInvalid(patch.itemId, "date") || undefined
                  }
                  aria-describedby={
                    isFieldInvalid(patch.itemId, "date")
                      ? ITINERARY_VALIDATION_ID
                      : undefined
                  }
                  onChange={(event) =>
                    update(index, { ...patch, date: event.target.value })
                  }
                />
              </Field>

              {patch.type === "STAY" ? (
                <>
                  <Field
                    data-invalid={
                      isFieldInvalid(patch.itemId, "endDate") || undefined
                    }
                  >
                    <FieldLabel htmlFor={`end-${patch.itemId}`}>
                      체크아웃 날짜
                    </FieldLabel>
                    <Input
                      id={`end-${patch.itemId}`}
                      type="date"
                      value={patch.endDate}
                      aria-invalid={
                        isFieldInvalid(patch.itemId, "endDate") || undefined
                      }
                      aria-describedby={
                        isFieldInvalid(patch.itemId, "endDate")
                          ? ITINERARY_VALIDATION_ID
                          : undefined
                      }
                      onChange={(event) =>
                        update(index, {
                          ...patch,
                          endDate: event.target.value,
                        })
                      }
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={`hotel-${patch.itemId}`}>
                      숙소
                    </FieldLabel>
                    <Input
                      id={`hotel-${patch.itemId}`}
                      value={patch.hotelName}
                      onChange={(event) =>
                        update(index, {
                          ...patch,
                          hotelName: event.target.value,
                        })
                      }
                    />
                  </Field>
                </>
              ) : (
                <>
                  <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field
                      data-invalid={
                        isFieldInvalid(patch.itemId, "fromCity") || undefined
                      }
                    >
                      <FieldLabel htmlFor={`from-${patch.itemId}`}>
                        출발
                      </FieldLabel>
                      <Input
                        id={`from-${patch.itemId}`}
                        value={patch.fromCity}
                        aria-invalid={
                          isFieldInvalid(patch.itemId, "fromCity") || undefined
                        }
                        aria-describedby={
                          isFieldInvalid(patch.itemId, "fromCity")
                            ? ITINERARY_VALIDATION_ID
                            : undefined
                        }
                        onChange={(event) =>
                          update(index, {
                            ...patch,
                            fromCity: event.target.value,
                          })
                        }
                      />
                    </Field>
                    <Field
                      data-invalid={
                        isFieldInvalid(patch.itemId, "toCity") || undefined
                      }
                    >
                      <FieldLabel htmlFor={`to-${patch.itemId}`}>
                        도착
                      </FieldLabel>
                      <Input
                        id={`to-${patch.itemId}`}
                        value={patch.toCity}
                        aria-invalid={
                          isFieldInvalid(patch.itemId, "toCity") || undefined
                        }
                        aria-describedby={
                          isFieldInvalid(patch.itemId, "toCity")
                            ? ITINERARY_VALIDATION_ID
                            : undefined
                        }
                        onChange={(event) =>
                          update(index, {
                            ...patch,
                            toCity: event.target.value,
                          })
                        }
                      />
                    </Field>
                  </div>
                  <Field>
                    <FieldLabel htmlFor={`mode-${patch.itemId}`}>
                      이동 수단
                    </FieldLabel>
                    <Input
                      id={`mode-${patch.itemId}`}
                      value={patch.mode}
                      onChange={(event) =>
                        update(index, { ...patch, mode: event.target.value })
                      }
                    />
                  </Field>
                </>
              )}

              <Field>
                <FieldLabel htmlFor={`memo-${patch.itemId}`}>메모</FieldLabel>
                <Textarea
                  id={`memo-${patch.itemId}`}
                  value={patch.memo ?? ""}
                  className="whitespace-pre-wrap [overflow-wrap:anywhere]"
                  onChange={(event) =>
                    update(index, { ...patch, memo: event.target.value })
                  }
                />
              </Field>
            </FieldGroup>
          </FieldSet>
        ))}
      </form>

      <BottomAction
        accessory={
          conflictNotice || saveError || completionCondition ? (
            <div className="flex min-w-0 flex-col gap-2">
              {conflictNotice && (
                <p
                  className="min-w-0 rounded-xl border border-warning-border bg-warning-muted px-4 py-3 text-base leading-relaxed font-semibold text-foreground [overflow-wrap:anywhere]"
                  role="alert"
                >
                  {conflictNotice}
                </p>
              )}
              {saveError && (
                <p
                  className="min-w-0 text-center text-base leading-relaxed text-destructive-strong [overflow-wrap:anywhere]"
                  role="alert"
                >
                  {saveError}
                </p>
              )}
              {completionCondition && (
                <p
                  id={ITINERARY_VALIDATION_ID}
                  className="min-w-0 text-center text-base leading-relaxed text-foreground-muted [overflow-wrap:anywhere]"
                >
                  {completionCondition}
                </p>
              )}
            </div>
          ) : undefined
        }
      >
        <Button
          type="submit"
          form={ITINERARY_EDITOR_FORM_ID}
          size="xl"
          aria-busy={isSubmitPending || undefined}
          aria-live="polite"
          disabled={!validation.isValid || unchanged || isSubmitPending}
        >
          {isSubmitPending && <Spinner aria-hidden="true" />}
          {actionLabel}
        </Button>
      </BottomAction>
    </PageBody>
  );
}

export function ItineraryEditPage(): JSX.Element {
  const params = useParams();
  const navigate = useNavigate();
  const validated = decodeRouteParams(TripParamsSchema, params);
  const tripId = Result.isSuccess(validated) ? validated.success.tripId : "";
  const query = useItineraryQuery(tripId);

  if (Result.isFailure(validated)) {
    return <RouteErrorFallback message="유효하지 않은 여행방 식별자입니다." />;
  }
  if (query.isLoading) {
    return (
      <PageBody>
        <PageState
          status="loading"
          message="확정 일정을 불러오는 중입니다..."
        />
      </PageBody>
    );
  }
  if (query.isError || !query.data) {
    return (
      <RouteErrorFallback
        message={toUserMessage(query.error, "확정 일정을 불러오지 못했습니다.")}
      />
    );
  }
  if (query.data.status !== "CONFIRMED") {
    return <RouteErrorFallback message="수정할 확정 일정이 없습니다." />;
  }
  if (!query.data.canEdit) {
    return (
      <RouteErrorFallback
        title="수정 권한이 없습니다"
        message="방장만 확정 일정을 수정할 수 있습니다."
        actionText="일정으로 돌아가기"
        onAction={() =>
          navigate(`/trips/${tripId}/itinerary`, { replace: true })
        }
      />
    );
  }
  return (
    <ItineraryEditor
      tripId={tripId}
      itinerary={query.data.itinerary}
      onRefresh={async () => {
        const refreshed = await query.refetch();
        return refreshed.isError || refreshed.data?.status !== "CONFIRMED"
          ? undefined
          : refreshed.data.itinerary;
      }}
    />
  );
}
