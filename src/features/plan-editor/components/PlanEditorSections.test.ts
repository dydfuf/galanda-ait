import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  getDraftSaveStatusLabel,
  type usePlanEditorState,
} from "../hooks/usePlanEditorState.ts";
import {
  PlanEditorSections,
  RevisionConflictChoice,
} from "./PlanEditorSections.tsx";

describe("PlanEditorSections", () => {
  it("draft 저장 상태별 문구를 구분한다", () => {
    expect(getDraftSaveStatusLabel("IDLE")).toBe("아직 저장되지 않음");
    expect(getDraftSaveStatusLabel("SAVING")).toBe("자동 저장 중…");
    expect(getDraftSaveStatusLabel("SAVED")).toBe("자동 저장됨");
    expect(getDraftSaveStatusLabel("ERROR")).toBe("임시 저장하지 못했어요");
  });

  it("빈 신규 여행안과 저장 실패를 실제 상태로 표시한다", () => {
    const editor = {
      title: "",
      routes: [],
      accommodations: [],
      transports: [],
      costSummary: { hasCost: false, baseHeadcount: 2 },
      draftConflict: false,
      draftSaveStatus: "ERROR",
      clearDraft: () => undefined,
    } as unknown as ReturnType<typeof usePlanEditorState>;

    const html = renderToStaticMarkup(createElement(PlanEditorSections, {
      editor,
      isEditMode: false,
      isCloneMode: false,
      onOpenSection: () => undefined,
      onCompleteSection: () => undefined,
    }));

    expect(html).toContain("임시 저장하지 못했어요");
    expect(html).not.toContain("자동 저장됨");
    expect(html).toContain("방문 도시와 날짜를 정해주세요.");
    expect(html.match(/아직 추가하지 않았어요/g)).toHaveLength(2);
    expect(html.match(/입력 전/g)).toHaveLength(2);
    expect(html).toContain("가격 미정");
    expect(html).not.toContain("숙소 찾는 중");
    expect(html).not.toContain("항공 / KTX");
  });

  it("revision 충돌에서 내 변경 재적용과 최신 공개본 사용을 명시적으로 선택한다", () => {
    const html = renderToStaticMarkup(createElement(RevisionConflictChoice, {
      message: "v3에서 v4로 변경됐어요.",
      onReapply: () => undefined,
      onUseLatest: () => undefined,
    }));

    expect(html).toContain("내 변경 다시 적용");
    expect(html).toContain("최신 공개본 사용");
    expect(html).toContain("v3에서 v4로 변경됐어요.");
  });
});
