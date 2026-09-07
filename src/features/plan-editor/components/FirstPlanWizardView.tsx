import { useEffect, useRef, type KeyboardEvent } from "react";

import { cn } from "@/lib/utils.ts";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field.tsx";
import {
  WizardStepPage,
  type WizardActionState,
} from "@/components/galanda/wizard-step-page.tsx";
import { wizardChoiceCard, wizardQuestionPanel } from "@/components/galanda/wizard-recipes.ts";
import {
  assertNever,
  type FirstPlanWizardEvent,
  type FirstPlanWizardField,
  type FirstPlanWizardQuestionViewModel,
  type FirstPlanWizardViewModel,
} from "../first-plan-wizard.contract.ts";

export interface FirstPlanWizardViewProps {
  readonly vm: FirstPlanWizardViewModel;
  readonly onEvent: (event: FirstPlanWizardEvent) => void;
}

function isActionEnabled(state: WizardActionState): boolean {
  return state.tag === "enabled";
}

function submitQuestion(
  vm: FirstPlanWizardViewModel,
  onEvent: FirstPlanWizardViewProps["onEvent"],
  field?: FirstPlanWizardField,
): void {
  if (isActionEnabled(vm.actions.primary.state)) {
    onEvent({ type: "next" });
  } else if (field) {
    onEvent({ type: "field-blur", field });
  }
}

function handleInputKeyDown(
  event: KeyboardEvent<HTMLInputElement>,
  vm: FirstPlanWizardViewModel,
  onEvent: FirstPlanWizardViewProps["onEvent"],
  field?: FirstPlanWizardField,
): void {
  if (event.key !== "Enter") return;
  if (event.nativeEvent.isComposing || event.keyCode === 229) return;
  event.preventDefault();
  submitQuestion(vm, onEvent, field);
}

function CharacterCount({
  value,
  limit,
  invalid,
}: {
  readonly value: number;
  readonly limit: number;
  readonly invalid?: boolean;
}) {
  return (
    <span className={cn("shrink-0 tabular-nums", invalid && "font-semibold text-destructive")}>
      {value}/{limit}
    </span>
  );
}

function QuestionPanel({ children }: { readonly children: React.ReactNode }) {
  return <div className={wizardQuestionPanel()}>{children}</div>;
}

function ChoiceCard({
  name,
  checked,
  title,
  description,
  onChange,
}: {
  readonly name: string;
  readonly checked: boolean;
  readonly title: string;
  readonly description: string;
  readonly onChange: () => void;
}) {
  return (
    <label data-slot="wizard-choice" className={wizardChoiceCard({ selected: checked })}>
      <input
        type="radio"
        name={name}
        checked={checked}
        aria-checked={checked}
        onClick={onChange}
        className="sr-only"
      />
      <span className="text-base font-bold text-foreground">{title}</span>
      <span className="text-sm text-muted-foreground">{description}</span>
    </label>
  );
}

function FirstPlanWizardQuestion({
  question,
  vm,
  onEvent,
  titleInputRef,
  proposalInputRef,
  headcountFieldsetRef,
  cityInputRef,
  arrivalInputRef,
  departureInputRef,
  addCityFieldsetRef,
  accommodationStatusFieldsetRef,
  hotelInputRef,
  transportFromInputRef,
  transportStatusFieldsetRef,
  transportModeInputRef,
  transportDurationInputRef,
}: {
  readonly question: FirstPlanWizardQuestionViewModel;
  readonly vm: FirstPlanWizardViewModel;
  readonly onEvent: FirstPlanWizardViewProps["onEvent"];
  readonly titleInputRef: React.RefObject<HTMLInputElement>;
  readonly proposalInputRef: React.RefObject<HTMLInputElement>;
  readonly headcountFieldsetRef: React.RefObject<HTMLFieldSetElement>;
  readonly cityInputRef: React.RefObject<HTMLInputElement>;
  readonly arrivalInputRef: React.RefObject<HTMLInputElement>;
  readonly departureInputRef: React.RefObject<HTMLInputElement>;
  readonly addCityFieldsetRef: React.RefObject<HTMLFieldSetElement>;
  readonly accommodationStatusFieldsetRef: React.RefObject<HTMLFieldSetElement>;
  readonly hotelInputRef: React.RefObject<HTMLInputElement>;
  readonly transportFromInputRef: React.RefObject<HTMLInputElement>;
  readonly transportStatusFieldsetRef: React.RefObject<HTMLFieldSetElement>;
  readonly transportModeInputRef: React.RefObject<HTMLInputElement>;
  readonly transportDurationInputRef: React.RefObject<HTMLInputElement>;
}): React.ReactNode {
  switch (question.kind) {
    case "title":
      return (
        <form
          id="wizard-question-form"
          onSubmit={(event) => {
            event.preventDefault();
            submitQuestion(vm, onEvent, "title");
          }}
          className={wizardQuestionPanel()}
        >
          <Field data-invalid={question.error !== undefined || undefined} className="gap-3">
            <FieldLabel htmlFor="wizard-plan-title" className="text-base font-semibold text-foreground">
              여행안 제목 *
            </FieldLabel>
            <Input
              id="wizard-plan-title"
              ref={titleInputRef}
              type="text"
              placeholder="예: 힐링 카페 & 호캉스 코스"
              value={question.value}
              onChange={(event) => onEvent({ type: "title-change", value: event.target.value })}
              onKeyDown={(event) => handleInputKeyDown(event, vm, onEvent, "title")}
              onBlur={() => onEvent({ type: "field-blur", field: "title" })}
              aria-describedby="wizard-title-help"
              aria-invalid={question.error !== undefined || undefined}
              required
              className="h-14 rounded-xl border-border bg-background px-4 text-base"
            />
            {question.error ? (
              <FieldError id="wizard-title-help" className="flex items-start justify-between gap-3">
                <span className="min-w-0 flex-1">{question.error}</span>
                <CharacterCount value={question.characterCount} limit={30} invalid />
              </FieldError>
            ) : (
              <FieldDescription id="wizard-title-help" className="flex items-start justify-between gap-3">
                <span className="min-w-0 flex-1">최대 30자까지 입력할 수 있어요.</span>
                <CharacterCount value={question.characterCount} limit={30} />
              </FieldDescription>
            )}
          </Field>
        </form>
      );

    case "proposal-reason":
      return (
        <form
          id="wizard-question-form"
          onSubmit={(event) => {
            event.preventDefault();
            submitQuestion(vm, onEvent);
          }}
          className={wizardQuestionPanel()}
        >
          <Field className="gap-3">
            <FieldLabel htmlFor="wizard-plan-proposal-reason" className="text-base font-semibold text-foreground">
              제안 이유 / 한 줄 요약 (선택)
            </FieldLabel>
            <Input
              id="wizard-plan-proposal-reason"
              ref={proposalInputRef}
              type="text"
              placeholder="예: 이동을 줄이고 서귀포 호텔에서 여유를 즐기는 안"
              value={question.value}
              maxLength={100}
              onChange={(event) => onEvent({ type: "proposal-reason-change", value: event.target.value })}
              onKeyDown={(event) => handleInputKeyDown(event, vm, onEvent)}
              aria-describedby="wizard-proposal-reason-help"
              className="h-14 rounded-xl border-border bg-background px-4 text-base"
            />
            <FieldDescription id="wizard-proposal-reason-help" className="flex items-start justify-between gap-3">
              <span className="min-w-0 flex-1">작성하지 않고 바로 다음으로 넘어가도 괜찮아요.</span>
              <CharacterCount value={question.characterCount} limit={100} />
            </FieldDescription>
          </Field>
        </form>
      );

    case "headcount":
      return (
        <QuestionPanel>
          <fieldset
            ref={headcountFieldsetRef}
            tabIndex={-1}
            className="m-0 flex min-w-0 flex-col gap-4 border-none p-0 outline-none"
            aria-describedby="wizard-headcount-hint"
          >
            <legend className="text-base font-semibold text-foreground">비용 기준 인원 *</legend>
            <div className="flex items-center gap-4 py-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-12 rounded-xl text-xl font-bold"
                aria-label="비용 기준 인원 한 명 줄이기"
                disabled={question.value <= 1}
                onClick={() => onEvent({ type: "headcount-change", value: Math.max(1, question.value - 1) })}
              >
                <span aria-hidden="true">-</span>
              </Button>
              <span className="min-w-20 text-center text-2xl font-bold tabular-nums text-foreground" aria-live="polite">
                {question.value}명
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-12 rounded-xl text-xl font-bold"
                aria-label="비용 기준 인원 한 명 늘리기"
                disabled={question.value >= 20}
                onClick={() => onEvent({ type: "headcount-change", value: Math.min(20, question.value + 1) })}
              >
                <span aria-hidden="true">+</span>
              </Button>
            </div>
            <p id="wizard-headcount-hint" className="text-sm font-normal leading-relaxed text-muted-foreground">
              이 인원을 기준으로 숙소와 교통의 1인 예상 참고액이 자동 계산됩니다. (1~20명)
            </p>
          </fieldset>
        </QuestionPanel>
      );

    case "city":
      return (
        <form
          id="wizard-question-form"
          onSubmit={(event) => {
            event.preventDefault();
            submitQuestion(vm, onEvent, "city");
          }}
          className={wizardQuestionPanel()}
        >
          <Field data-invalid={question.error !== undefined || undefined} className="gap-3">
            <FieldLabel htmlFor="wizard-route-city" className="text-base font-semibold text-foreground">
              방문 도시 *
            </FieldLabel>
            <Input
              id="wizard-route-city"
              ref={cityInputRef}
              type="text"
              placeholder="예: 제주시 / 도쿄 / 파리"
              value={question.value}
              onChange={(event) => onEvent({ type: "city-change", index: question.index, value: event.target.value })}
              onKeyDown={(event) => handleInputKeyDown(event, vm, onEvent, "city")}
              onBlur={() => onEvent({ type: "field-blur", field: "city" })}
              aria-describedby="wizard-route-city-help"
              aria-invalid={question.error !== undefined || undefined}
              required
              className="h-14 rounded-xl border-border bg-background px-4 text-base"
            />
            {question.error ? (
              <FieldError id="wizard-route-city-help" className="flex items-start justify-between gap-3">
                <span className="min-w-0 flex-1">{question.error}</span>
                <CharacterCount value={question.characterCount} limit={30} invalid />
              </FieldError>
            ) : (
              <FieldDescription id="wizard-route-city-help" className="flex items-start justify-between gap-3">
                <span className="min-w-0 flex-1">최대 30자까지 입력할 수 있어요.</span>
                <CharacterCount value={question.characterCount} limit={30} />
              </FieldDescription>
            )}
          </Field>
        </form>
      );

    case "arrival-date":
      return (
        <form
          id="wizard-question-form"
          onSubmit={(event) => {
            event.preventDefault();
            submitQuestion(vm, onEvent, "arrival-date");
          }}
          className={wizardQuestionPanel()}
        >
          <Field data-invalid={question.error !== undefined || undefined} className="gap-3">
            <FieldLabel htmlFor="wizard-route-arrival-date" className="text-base font-semibold text-foreground">
              도착일 *
            </FieldLabel>
            <Input
              id="wizard-route-arrival-date"
              ref={arrivalInputRef}
              type="date"
              value={question.value}
              min={question.min}
              onChange={(event) => onEvent({ type: "arrival-date-change", index: question.index, value: event.target.value })}
              onKeyDown={(event) => handleInputKeyDown(event, vm, onEvent, "arrival-date")}
              onBlur={() => onEvent({ type: "field-blur", field: "arrival-date" })}
              aria-describedby="wizard-route-arrival-help"
              aria-invalid={question.error !== undefined || undefined}
              required
              className="h-14 rounded-xl border-border bg-background px-4 text-base"
            />
            {question.error ? (
              <FieldError id="wizard-route-arrival-help">{question.error}</FieldError>
            ) : (
              <FieldDescription id="wizard-route-arrival-help">도착 날짜를 선택해주세요. (YYYY-MM-DD)</FieldDescription>
            )}
          </Field>
        </form>
      );

    case "departure-date":
      return (
        <form
          id="wizard-question-form"
          onSubmit={(event) => {
            event.preventDefault();
            submitQuestion(vm, onEvent, "departure-date");
          }}
          className={wizardQuestionPanel()}
        >
          <Field data-invalid={question.error !== undefined || undefined} className="gap-3">
            <FieldLabel htmlFor="wizard-route-departure-date" className="text-base font-semibold text-foreground">
              출발일 *
            </FieldLabel>
            <Input
              id="wizard-route-departure-date"
              ref={departureInputRef}
              type="date"
              value={question.value}
              min={question.min}
              onChange={(event) => onEvent({ type: "departure-date-change", index: question.index, value: event.target.value })}
              onKeyDown={(event) => handleInputKeyDown(event, vm, onEvent, "departure-date")}
              onBlur={() => onEvent({ type: "field-blur", field: "departure-date" })}
              aria-describedby="wizard-route-departure-help"
              aria-invalid={question.error !== undefined || undefined}
              required
              className="h-14 rounded-xl border-border bg-background px-4 text-base"
            />
            {question.error ? (
              <FieldError id="wizard-route-departure-help">{question.error}</FieldError>
            ) : (
              <FieldDescription id="wizard-route-departure-help">
                {question.nights > 0
                  ? `체류 기간: ${question.nights}박 (${question.nights}박 ${question.nights + 1}일 일정)`
                  : "도착일 이후의 출발 날짜를 선택해주세요."}
              </FieldDescription>
            )}
          </Field>
        </form>
      );

    case "add-city":
      return (
        <div className="mx-(--app-inline-padding) mt-3 flex flex-col gap-4">
          <fieldset
            ref={addCityFieldsetRef}
            tabIndex={-1}
            className="m-0 flex min-w-0 flex-col gap-4 border-none p-0 outline-none"
          >
            <legend className="sr-only">도시 추가 또는 경로 완료</legend>
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
              <h3 className="mb-3 text-sm font-semibold text-muted-foreground">현재 여행 경로</h3>
              <div className="flex flex-col gap-2">
                {question.routes.map((route, index) => (
                  <div key={`route-summary-${index}`} className="flex items-center justify-between rounded-xl bg-muted/40 px-3.5 py-2.5 text-sm">
                    <span className="font-semibold text-foreground">도시 {index + 1} · {route.city || "미정"}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {route.arrivalDate && route.departureDate ? `${route.arrivalDate} ~ ${route.departureDate}` : ""} ({route.nights}박)
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="xl"
              className="w-full rounded-2xl border-2 border-dashed py-4 font-semibold text-primary hover:bg-primary/5"
              onClick={() => onEvent({ type: "add-city" })}
            >
              + 도시 추가하기
            </Button>
          </fieldset>
        </div>
      );

    case "accommodation-status":
      return (
        <QuestionPanel>
          <fieldset
            ref={accommodationStatusFieldsetRef}
            tabIndex={-1}
            className="m-0 flex min-w-0 flex-col gap-3 border-none p-0 outline-none"
            aria-describedby="wizard-acc-status-badge"
          >
            <legend className="sr-only">숙소 예약 여부 선택</legend>
            <div id="wizard-acc-status-badge" className="text-xs font-semibold text-primary">
              구간 {question.index + 1}/{question.total} · {question.city} ({question.nights}박)
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <ChoiceCard
                name="accommodation-status"
                checked={!question.isSearching}
                title="정했어요"
                description="숙소 이름과 예약 정보를 입력해요."
                onChange={() => onEvent({ type: "accommodation-status-change", index: question.index, isSearching: false })}
              />
              <ChoiceCard
                name="accommodation-status"
                checked={question.isSearching}
                title="알아보는 중"
                description="아직 예약하지 않았거나 찾는 중이에요."
                onChange={() => onEvent({ type: "accommodation-status-change", index: question.index, isSearching: true })}
              />
            </div>
          </fieldset>
        </QuestionPanel>
      );

    case "hotel-name":
      return (
        <form
          id="wizard-question-form"
          onSubmit={(event) => {
            event.preventDefault();
            submitQuestion(vm, onEvent, "hotel-name");
          }}
          className={wizardQuestionPanel()}
        >
          <div className="mb-2 text-xs font-semibold text-primary">
            구간 {question.index + 1}/{question.total} · {question.city} ({question.nights}박)
          </div>
          <Field data-invalid={question.error !== undefined || undefined} className="gap-3">
            <FieldLabel htmlFor="wizard-hotel-name" className="text-base font-semibold text-foreground">
              숙소명 / 호텔명 *
            </FieldLabel>
            <Input
              id="wizard-hotel-name"
              ref={hotelInputRef}
              type="text"
              placeholder="예: 그랜드 조선 호텔 제주 / 신라호텔"
              value={question.value}
              maxLength={50}
              onChange={(event) => onEvent({ type: "hotel-name-change", index: question.index, value: event.target.value })}
              onKeyDown={(event) => handleInputKeyDown(event, vm, onEvent, "hotel-name")}
              onBlur={() => onEvent({ type: "field-blur", field: "hotel-name" })}
              aria-describedby="wizard-hotel-name-help"
              aria-invalid={question.error !== undefined || undefined}
              required
              className="h-14 rounded-xl border-border bg-background px-4 text-base"
            />
            {question.error ? (
              <FieldError id="wizard-hotel-name-help" className="flex items-start justify-between gap-3">
                <span className="min-w-0 flex-1">{question.error}</span>
                <CharacterCount value={question.characterCount} limit={50} />
              </FieldError>
            ) : (
              <FieldDescription id="wizard-hotel-name-help" className="flex items-start justify-between gap-3">
                <span className="min-w-0 flex-1">최대 50자까지 입력할 수 있어요.</span>
                <CharacterCount value={question.characterCount} limit={50} />
              </FieldDescription>
            )}
          </Field>
        </form>
      );

    case "transport-endpoints":
      return (
        <form
          id="wizard-question-form"
          onSubmit={(event) => {
            event.preventDefault();
            submitQuestion(vm, onEvent, "transport-endpoints");
          }}
          className={wizardQuestionPanel()}
        >
          <div className="mb-2 text-xs font-semibold text-primary">이동 {question.index + 1}/{question.total}</div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field data-invalid={question.fromError || undefined} className="gap-2">
              <FieldLabel htmlFor="wizard-transport-from" className="text-sm font-semibold text-foreground">출발지 *</FieldLabel>
              <Input
                id="wizard-transport-from"
                ref={transportFromInputRef}
                type="text"
                placeholder={question.index === 0 ? "예: 서울 / 김포 / 인천" : "출발지"}
                value={question.fromCity}
                maxLength={30}
                onChange={(event) => onEvent({ type: "transport-endpoints-change", index: question.index, fromCity: event.target.value, toCity: question.toCity })}
                onKeyDown={(event) => handleInputKeyDown(event, vm, onEvent, "transport-endpoints")}
                onBlur={() => onEvent({ type: "field-blur", field: "transport-endpoints" })}
                aria-describedby="wizard-transport-from-help"
                aria-invalid={question.fromError || undefined}
                className="h-12 rounded-xl border-border bg-background px-4 text-base"
              />
              {question.fromError && <FieldError id="wizard-transport-from-help">출발지를 입력해주세요.</FieldError>}
            </Field>
            <Field data-invalid={question.toError || undefined} className="gap-2">
              <FieldLabel htmlFor="wizard-transport-to" className="text-sm font-semibold text-foreground">도착지 *</FieldLabel>
              <Input
                id="wizard-transport-to"
                type="text"
                placeholder={question.index === question.total - 1 ? "예: 서울 / 김포 / 집" : "도착지"}
                value={question.toCity}
                maxLength={30}
                onChange={(event) => onEvent({ type: "transport-endpoints-change", index: question.index, fromCity: question.fromCity, toCity: event.target.value })}
                onKeyDown={(event) => handleInputKeyDown(event, vm, onEvent, "transport-endpoints")}
                onBlur={() => onEvent({ type: "field-blur", field: "transport-endpoints" })}
                aria-describedby="wizard-transport-to-help"
                aria-invalid={question.toError || undefined}
                className="h-12 rounded-xl border-border bg-background px-4 text-base"
              />
              {question.toError && <FieldError id="wizard-transport-to-help">도착지를 입력해주세요.</FieldError>}
            </Field>
          </div>
        </form>
      );

    case "transport-status":
      return (
        <QuestionPanel>
          <fieldset
            ref={transportStatusFieldsetRef}
            tabIndex={-1}
            className="m-0 flex min-w-0 flex-col gap-3 border-none p-0 outline-none"
            aria-describedby="wizard-tr-status-badge"
          >
            <legend className="sr-only">교통편 확인 여부 선택</legend>
            <div id="wizard-tr-status-badge" className="text-xs font-semibold text-primary">
              이동 {question.index + 1}/{question.total} · {question.fromCity || "출발지"} → {question.toCity || "도착지"}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <ChoiceCard
                name="transport-status"
                checked={question.isAvailable}
                title="정했어요"
                description="교통수단과 소요 시간을 입력해요."
                onChange={() => onEvent({ type: "transport-status-change", index: question.index, bookingStatus: "AVAILABLE" })}
              />
              <ChoiceCard
                name="transport-status"
                checked={!question.isAvailable}
                title="아직 안 정함"
                description="교통편 확인 전으로 남겨둘게요."
                onChange={() => onEvent({ type: "transport-status-change", index: question.index, bookingStatus: "NOT_CHECKED" })}
              />
            </div>
          </fieldset>
        </QuestionPanel>
      );

    case "transport-mode":
      return (
        <form
          id="wizard-question-form"
          onSubmit={(event) => {
            event.preventDefault();
            submitQuestion(vm, onEvent, "transport-mode");
          }}
          className={wizardQuestionPanel()}
        >
          <div className="mb-2 text-xs font-semibold text-primary">이동 {question.index + 1}/{question.total} · {question.fromCity} → {question.toCity}</div>
          <Field data-invalid={question.error !== undefined || undefined} className="gap-3">
            <FieldLabel htmlFor="wizard-transport-mode" className="text-base font-semibold text-foreground">교통수단 *</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {question.presets.map((preset) => (
                <Button
                  key={preset}
                  type="button"
                  variant="secondary"
                  size="sm"
                  className={cn("rounded-full px-3 text-xs font-medium", question.value === preset && "bg-primary font-semibold text-primary-foreground")}
                  onClick={() => onEvent({ type: "transport-mode-change", index: question.index, value: preset })}
                >
                  {preset}
                </Button>
              ))}
            </div>
            <Input
              id="wizard-transport-mode"
              ref={transportModeInputRef}
              type="text"
              placeholder="예: 항공편 / KTX / 렌터카 / 고속버스"
              value={question.value}
              maxLength={30}
              onChange={(event) => onEvent({ type: "transport-mode-change", index: question.index, value: event.target.value })}
              onKeyDown={(event) => handleInputKeyDown(event, vm, onEvent, "transport-mode")}
              onBlur={() => onEvent({ type: "field-blur", field: "transport-mode" })}
              aria-describedby="wizard-transport-mode-help"
              aria-invalid={question.error !== undefined || undefined}
              required
              className="h-14 rounded-xl border-border bg-background px-4 text-base"
            />
            {question.error ? (
              <FieldError id="wizard-transport-mode-help" className="flex items-start justify-between gap-3">
                <span className="min-w-0 flex-1">{question.error}</span>
                <CharacterCount value={question.characterCount} limit={30} />
              </FieldError>
            ) : (
              <FieldDescription id="wizard-transport-mode-help" className="flex items-start justify-between gap-3">
                <span className="min-w-0 flex-1">최대 30자까지 입력할 수 있어요.</span>
                <CharacterCount value={question.characterCount} limit={30} />
              </FieldDescription>
            )}
          </Field>
        </form>
      );

    case "transport-duration":
      return (
        <form
          id="wizard-question-form"
          onSubmit={(event) => {
            event.preventDefault();
            submitQuestion(vm, onEvent, "transport-duration");
          }}
          className={wizardQuestionPanel()}
        >
          <div className="mb-2 text-xs font-semibold text-primary">이동 {question.index + 1}/{question.total} · {question.fromCity} → {question.toCity} ({question.mode || "교통"})</div>
          <Field data-invalid={question.error !== undefined || undefined} className="gap-3">
            <FieldLabel htmlFor="wizard-transport-duration" className="text-base font-semibold text-foreground">예상 소요시간 *</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {question.presets.map((preset) => (
                <Button
                  key={preset}
                  type="button"
                  variant="secondary"
                  size="sm"
                  className={cn("rounded-full px-3 text-xs font-medium", question.value === preset && "bg-primary font-semibold text-primary-foreground")}
                  onClick={() => onEvent({ type: "transport-duration-change", index: question.index, value: preset })}
                >
                  {preset}
                </Button>
              ))}
            </div>
            <Input
              id="wizard-transport-duration"
              ref={transportDurationInputRef}
              type="text"
              placeholder="예: 약 1시간 10분 / 2시간 30분 / 45분"
              value={question.value}
              maxLength={30}
              onChange={(event) => onEvent({ type: "transport-duration-change", index: question.index, value: event.target.value })}
              onKeyDown={(event) => handleInputKeyDown(event, vm, onEvent, "transport-duration")}
              onBlur={() => onEvent({ type: "field-blur", field: "transport-duration" })}
              aria-describedby="wizard-transport-duration-help"
              aria-invalid={question.error !== undefined || undefined}
              required
              className="h-14 rounded-xl border-border bg-background px-4 text-base"
            />
            {question.error ? (
              <FieldError id="wizard-transport-duration-help" className="flex items-start justify-between gap-3">
                <span className="min-w-0 flex-1">{question.error}</span>
                <CharacterCount value={question.characterCount} limit={30} />
              </FieldError>
            ) : (
              <FieldDescription id="wizard-transport-duration-help" className="flex items-start justify-between gap-3">
                <span className="min-w-0 flex-1">최대 30자까지 입력할 수 있어요.</span>
                <CharacterCount value={question.characterCount} limit={30} />
              </FieldDescription>
            )}
          </Field>
        </form>
      );

    default:
      return assertNever(question);
  }
}

export function FirstPlanWizardView({ vm, onEvent }: FirstPlanWizardViewProps) {
  const titleInputRef = useRef<HTMLInputElement>(null);
  const proposalInputRef = useRef<HTMLInputElement>(null);
  const headcountFieldsetRef = useRef<HTMLFieldSetElement>(null);
  const cityInputRef = useRef<HTMLInputElement>(null);
  const arrivalInputRef = useRef<HTMLInputElement>(null);
  const departureInputRef = useRef<HTMLInputElement>(null);
  const addCityFieldsetRef = useRef<HTMLFieldSetElement>(null);
  const accommodationStatusFieldsetRef = useRef<HTMLFieldSetElement>(null);
  const hotelInputRef = useRef<HTMLInputElement>(null);
  const transportFromInputRef = useRef<HTMLInputElement>(null);
  const transportStatusFieldsetRef = useRef<HTMLFieldSetElement>(null);
  const transportModeInputRef = useRef<HTMLInputElement>(null);
  const transportDurationInputRef = useRef<HTMLInputElement>(null);
  const questionIndex = "index" in vm.question ? vm.question.index : undefined;

  useEffect(() => {
    const target = {
      title: titleInputRef,
      "proposal-reason": proposalInputRef,
      headcount: headcountFieldsetRef,
      city: cityInputRef,
      "arrival-date": arrivalInputRef,
      "departure-date": departureInputRef,
      "add-city": addCityFieldsetRef,
      "accommodation-status": accommodationStatusFieldsetRef,
      "hotel-name": hotelInputRef,
      "transport-endpoints": transportFromInputRef,
      "transport-status": transportStatusFieldsetRef,
      "transport-mode": transportModeInputRef,
      "transport-duration": transportDurationInputRef,
    }[vm.question.kind];
    target?.current?.focus({ preventScroll: true });
  }, [vm.question.kind, questionIndex]);

  return (
    <WizardStepPage
      title={vm.header.title}
      description={vm.header.description}
      progress={vm.progress}
      draftStatus={vm.draftStatus}
      primaryAction={vm.actions.primary}
      secondaryAction={vm.actions.secondary}
      notice={vm.notice}
      onAction={onEvent}
    >
      <FirstPlanWizardQuestion
        question={vm.question}
        vm={vm}
        onEvent={onEvent}
        titleInputRef={titleInputRef}
        proposalInputRef={proposalInputRef}
        headcountFieldsetRef={headcountFieldsetRef}
        cityInputRef={cityInputRef}
        arrivalInputRef={arrivalInputRef}
        departureInputRef={departureInputRef}
        addCityFieldsetRef={addCityFieldsetRef}
        accommodationStatusFieldsetRef={accommodationStatusFieldsetRef}
        hotelInputRef={hotelInputRef}
        transportFromInputRef={transportFromInputRef}
        transportStatusFieldsetRef={transportStatusFieldsetRef}
        transportModeInputRef={transportModeInputRef}
        transportDurationInputRef={transportDurationInputRef}
      />
    </WizardStepPage>
  );
}
