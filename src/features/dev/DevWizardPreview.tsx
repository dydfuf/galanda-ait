import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { FirstPlanWizardView } from "@/features/plan-editor/components/FirstPlanWizardView.tsx";
import type { FirstPlanWizardEvent } from "@/features/plan-editor/first-plan-wizard.contract.ts";
import { createFirstPlanWizardViewModel, type FirstPlanWizardPresenterInput } from "@/features/plan-editor/first-plan-wizard.presenter.ts";
import { getDraftSaveStatusLabel, type DraftSaveStatus, type PlanEditorFormData } from "@/features/plan-editor/plan-editor-model.ts";

const formData: PlanEditorFormData = {
  title: "UX-125 제주 가을 여행",
  proposalReason: "수동 화면 확인용 고정 예시",
  baseHeadcount: 2,
  routes: [{ city: "제주", arrivalDate: "2026-10-10", departureDate: "2026-10-13" }],
  accommodations: [],
  transports: [],
};

const scenarios: ReadonlyArray<{
  id: string;
  label: string;
  input: Partial<FirstPlanWizardPresenterInput>;
}> = [
  { id: "normal", label: "정상 질문", input: {} },
  { id: "invalid-date", label: "날짜 오류", input: {
    cursor: { section: "route", question: "departure-date", index: 0 },
    formData: { ...formData, routes: [{ city: "제주", arrivalDate: "2026-10-10", departureDate: "2026-10-09" }] },
    touched: { "departure-date": true },
  } },
  { id: "long-copy", label: "긴 도시명·설명·CTA", input: {
    cursor: { section: "route", question: "arrival-date", index: 0 },
    formData: { ...formData, routes: [{ ...formData.routes[0]!, city: "제주특별자치도 서귀포시 안덕면 사계리" }] },
  } },
  { id: "offline", label: "오프라인 안내", input: { isOnline: false } },
  { id: "review-return", label: "검토에서 날짜 수정", input: {
    cursor: { section: "route", question: "departure-date", index: 0, returnToReview: true },
  } },
  { id: "choice", label: "숙소 선택·포커스", input: {
    cursor: { section: "accommodation", question: "status", index: 0 },
  } },
];
const statuses: ReadonlyArray<DraftSaveStatus> = ["IDLE", "SAVING", "SAVED", "ERROR"];

export function DevWizardPreview() {
  const [params, setParams] = useSearchParams();
  const [lastEvent, setLastEvent] = useState<FirstPlanWizardEvent["type"]>();
  const scenario = scenarios.find(({ id }) => id === params.get("scenario")) ?? scenarios[0]!;
  const draftSaveStatus = statuses.find((status) => status === params.get("draft")) ?? "IDLE";
  const vm = createFirstPlanWizardViewModel({
    cursor: { section: "basic", question: "title" },
    formData,
    isOnline: true,
    ...scenario.input,
    draftSaveStatus,
  });
  const preview = scenario.id === "long-copy" ? {
    ...vm,
    header: { ...vm.header, description: "긴 안내가 여러 줄로 표시될 때 입력과 하단 행동에 계속 접근할 수 있는지 확인하는 고정 예시예요." },
    actions: { ...vm.actions, primary: { ...vm.actions.primary, label: "날짜를 확인하고 다음 질문으로 이동하기" } },
  } : vm;

  function select(key: string, value: string) {
    setLastEvent(undefined);
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set(key, value);
      return next;
    });
  }

  return (
    <div data-slot="dev-wizard-preview" className="min-h-dvh bg-background">
      <aside aria-label="위자드 미리보기 설정" className="mx-auto flex max-w-(--content-max-width) flex-col gap-3 px-(--app-inline-padding) py-4">
        <Link to="/dev" className="inline-flex min-h-(--touch-target-min) items-center text-primary underline">카탈로그로 돌아가기</Link>
        <p className="text-sm text-muted-foreground">DEV 고정 예시 · 실제 저장·API·AI에 연결하지 않아요. 입력과 다음/이전은 이벤트 종류만 표시해요.</p>
        <label className="flex flex-col gap-1 text-sm">화면 상태
          <select value={scenario.id} onChange={(event) => select("scenario", event.target.value)} className="min-h-(--touch-target-min) rounded-lg border border-input bg-background px-3">
            {scenarios.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">임시 저장 상태
          <select value={draftSaveStatus} onChange={(event) => select("draft", event.target.value)} className="min-h-(--touch-target-min) rounded-lg border border-input bg-background px-3">
            {statuses.map((status) => <option key={status} value={status}>{status} · {getDraftSaveStatusLabel(status)}</option>)}
          </select>
        </label>
        <output aria-live="polite" className="text-sm text-muted-foreground">이벤트: {lastEvent ?? "없음"}</output>
      </aside>
      <FirstPlanWizardView vm={preview} onEvent={(event) => setLastEvent(event.type)} />
    </div>
  );
}
