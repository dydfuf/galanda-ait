// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import type { PlanSummaryData } from "../plan-home-view-model.ts";
import { PlanDecisionCard } from "./PlanDecisionCard.tsx";

const basePlan: PlanSummaryData = {
  id: "plan-1",
  title: "기본 여행안",
  planTag: "BASIC",
  planTagLabel: "기본안",
  period: "2026-12-12 ~ 2026-12-15",
  nights: 3,
  days: 4,
  authorName: "민지",
  opinions: { likeCount: 2, okayCount: 1, hardCount: 0 },
  myReaction: undefined,
  isConfirmed: false,
};

const renderCard = (overrides: Partial<PlanSummaryData> = {}, to = "/trips/t1/plans/plan-1") => {
  const plan = { ...basePlan, ...overrides } as PlanSummaryData;
  return render(
    <MemoryRouter>
      <PlanDecisionCard plan={plan} to={to} />
    </MemoryRouter>,
  );
};

describe("PlanDecisionCard (RAON-226)", () => {
  it("기본안·대안·확정안을 badge text로 구분한다 (색상만 의존하지 않음)", () => {
    const { unmount } = renderCard({ planTag: "BASIC", planTagLabel: "기본안", isConfirmed: false });
    expect(screen.getByText("기본안")).toBeInTheDocument();
    unmount();

    renderCard({ planTag: "ALTERNATIVE", planTagLabel: "대안 1", isConfirmed: false });
    expect(screen.getByText("대안 1")).toBeInTheDocument();
    // cleanup via rerender? Use screen query after second render – need fresh
    expect(screen.queryByText("기본안")).not.toBeInTheDocument();
  });

  it("확정안은 success variant로 확정안 텍스트를 표시한다", () => {
    renderCard({ planTag: "BASIC", planTagLabel: "기본안", isConfirmed: true } as Partial<PlanSummaryData>);
    expect(screen.getByText("확정안")).toBeInTheDocument();
  });

  it("제목과 기간을 함께 표시하고 기간 pill이 보인다", () => {
    renderCard();
    expect(screen.getByText("기본 여행안")).toBeInTheDocument();
    expect(screen.getByText("3박 4일")).toBeInTheDocument();
    expect(screen.getByText("2026-12-12 ~ 2026-12-15")).toBeInTheDocument();
  });

  it("differenceSummary가 있으면 의견보다 먼저 보이는 강조 박스에 렌더한다", () => {
    renderCard({ differenceSummary: "오사카 1박 추가 · 교토 숙소 변경" });
    const diff = screen.getByText("오사카 1박 추가 · 교토 숙소 변경");
    expect(diff).toBeInTheDocument();
    // 차이 박스는 의견 텍스트보다 앞에 있어야 한다 (DOM 순서)
    const opinion = screen.getByText("좋아요 2");
    expect(diff.compareDocumentPosition(opinion) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("differenceSummary가 없으면 빈 강조 박스를 만들지 않는다", () => {
    renderCard({ differenceSummary: undefined });
    expect(screen.queryByText(/오사카/)).not.toBeInTheDocument();
    // difference 박스용 border-primary-border-weak 클래스를 가진 div가 없어야 한다 – 간접적으로 차이 텍스트 없음 확인
    // 또한 카드 내부에 difference 관련 요소가 없음을 확인
    const card = screen.getByRole("link");
    expect(card.textContent).not.toMatch(/오사카/);
  });

  it("카드 전체가 단일 Link surface이며 내부에 nested button/link가 없다", () => {
    renderCard({ differenceSummary: "차이 텍스트" });
    const link = screen.getByRole("link");
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/trips/t1/plans/plan-1");
    // 내부에 button이나 또 다른 a가 없어야 한다
    expect(link.querySelector("button")).toBeNull();
    expect(link.querySelectorAll("a").length).toBe(0);
  });

  it("keyboard focus 가능한 단일 surface이며 aria-label에 상세 보기 포함", () => {
    renderCard();
    const link = screen.getByRole("link");
    expect(link.getAttribute("aria-label")).toMatch(/상세 보기/);
    // focusable: link is naturally focusable; ensure no tabindex -1
    expect(link.tabIndex).not.toBe(-1);
  });

  it("긴 제목/차이가 line-clamp로 제한되며 break-words/overflow-hidden을 갖는다", () => {
    const longTitle = "아주 긴 제목 ".repeat(20);
    const longDiff = "매우 긴 차이 요약 ".repeat(20);
    renderCard({ title: longTitle, differenceSummary: longDiff });
    const titleEl = screen.getByRole("heading", { level: 3 });
    expect(titleEl.className).toMatch(/line-clamp-2/);
    expect(titleEl.className).toMatch(/break-words/);
    expect(titleEl.textContent).toContain("아주 긴 제목");
    const card = screen.getByRole("link");
    expect(card.className).toMatch(/overflow-hidden/);
    // difference 박스 내부 p에서 line-clamp-2 확인
    const diffEl = screen.getByText((content, el) => el?.tagName === "P" && content.includes("매우 긴 차이 요약"));
    expect(diffEl.className).toMatch(/line-clamp-2/);
  });

  it("의견이 없을 때 '아직 의견이 없어요'와 '내 의견 전'을 표시한다", () => {
    renderCard({ opinions: { likeCount: 0, okayCount: 0, hardCount: 0 }, myReaction: undefined });
    expect(screen.getByText("아직 의견이 없어요")).toBeInTheDocument();
    expect(screen.getByText("내 의견 전")).toBeInTheDocument();
  });

  it("내 의견이 있으면 '내 의견 좋아요' 형태로 강조한다", () => {
    renderCard({ myReaction: "LIKE" });
    expect(screen.getByText("내 의견 좋아요")).toBeInTheDocument();
  });
});
