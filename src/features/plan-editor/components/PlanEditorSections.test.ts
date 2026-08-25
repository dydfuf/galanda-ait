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
import { RouteCitySection } from "./RouteCitySection.tsx";

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

  it("도시별 날짜 입력과 삭제 행동을 분리해 표시한다", () => {
    const html = renderToStaticMarkup(createElement(RouteCitySection, {
      routes: [
        { city: "아주 긴 도시 이름", arrivalDate: "2026-12-10", departureDate: "2026-12-12" },
        { city: "다음 도시", arrivalDate: "2026-12-12", departureDate: "2026-12-14" },
      ],
      totalTripNights: 4,
      currentTotalNights: 4,
      onAddCity: () => undefined,
      onUpdateCity: () => undefined,
      onRemoveCity: () => undefined,
    }));

    expect(html.match(/type="date"/g)).toHaveLength(4);
    expect(html).toContain('for="route-0-arrival"');
    expect(html).toContain('for="route-0-departure"');
    expect(html).toContain('aria-label="도시 1 삭제"');
    expect(html).toContain('aria-label="도시 2 삭제"');
  });

  it("첫 여행안에서는 진행률과 다음 추천을 안내한다", () => {
    const editor = {
      title: "첫 여행",
      routes: [],
      accommodations: [],
      transports: [],
      costSummary: { hasCost: false, baseHeadcount: 2 },
      draftConflict: false,
      draftSaveStatus: "IDLE",
      clearDraft: () => undefined,
    } as unknown as ReturnType<typeof usePlanEditorState>;

    const html = renderToStaticMarkup(createElement(PlanEditorSections, {
      editor,
      isEditMode: false,
      isCloneMode: false,
      isFirstPlan: true,
      onOpenSection: () => undefined,
      onCompleteSection: () => undefined,
    }));

    expect(html).toContain("첫 여행안을 만들어볼까요?");
    expect(html).toContain("필수 정보 1/4 완료");
    expect(html).toContain("다음으로 추천");
    expect(html).toContain("아직 예약하지 않았어도 괜찮아요");
  });
});
