// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { DraftSaveStatus } from "../plan-editor-model.ts";
import { PlanEditorHeader } from "./PlanEditorHeader.tsx";

const header = (draftSaveStatus: DraftSaveStatus) => (
  <PlanEditorHeader
    isEditMode={false}
    isCloneMode={false}
    draftSaveStatus={draftSaveStatus}
  />
);

describe("PlanEditorHeader 저장 완료 표시", () => {
  it.each([
    ["IDLE", "아직 저장되지 않음", false],
    ["SAVING", "자동 저장 중…", false],
    ["SAVED", "자동 저장됨", true],
    ["ERROR", "임시 저장하지 못했어요", false],
  ] as const)("%s 상태에서 실제 저장 결과와 완료 체크가 일치한다", (state, label, complete) => {
    render(header(state));
    const status = screen.getByRole("status");
    const icon = status.querySelector('[data-slot="action-icon"]');

    expect(status).toHaveTextContent(label);
    expect(icon !== null).toBe(complete);
    if (complete) {
      expect(icon).toHaveAttribute("aria-hidden", "true");
      expect(icon).toHaveClass("text-success");
    }
  });

  it("저장 성공 뒤 재저장·실패·초기화 시 기존 완료 체크를 남기지 않는다", () => {
    const { rerender } = render(header("SAVED"));
    const status = screen.getByRole("status");
    const iconSelector = '[data-slot="action-icon"]';
    expect(status.querySelector(iconSelector)).not.toBeNull();

    for (const [state, label] of [
      ["SAVING", "자동 저장 중…"],
      ["ERROR", "임시 저장하지 못했어요"],
      ["IDLE", "아직 저장되지 않음"],
    ] as const) {
      rerender(header(state));
      expect(status).toHaveTextContent(label);
      expect(status.querySelector(iconSelector)).toBeNull();
    }

    rerender(header("SAVED"));
    expect(status).toHaveTextContent("자동 저장됨");
    expect(status.querySelector(iconSelector)).not.toBeNull();
  });
});
