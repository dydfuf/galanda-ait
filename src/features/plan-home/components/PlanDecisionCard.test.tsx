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

/**
 * 반응 pill은 시각적으로 `[아이콘] 2`라 텍스트로 잡을 수 없다.
 * pill 컨테이너를 구조(둥근 pill + 합성 텍스트 "좋아요 2명")로 찾는다.
 */
const findReactionPill = (label: string, count: number): HTMLElement | undefined => {
  const link = screen.getByRole("link");
  return Array.from(link.querySelectorAll("span")).find(
    (el) => el.className.includes("rounded-full") && el.textContent === `${label} ${count}명`,
  );
};

const getReactionPill = (label: string, count: number): HTMLElement => {
  const pill = findReactionPill(label, count);
  if (!pill) throw new Error(`반응 pill을 찾지 못했습니다: ${label} ${count}명`);
  return pill;
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
    // 차이 박스는 의견 영역보다 앞에 있어야 한다 (DOM 순서)
    const opinion = getReactionPill("좋아요", 2);
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

  it("keyboard focus 가능한 단일 surface이며 aria-label 강제 없이 visible content가 name이 된다", () => {
    renderCard();
    const link = screen.getByRole("link");
    // aria-label로 name을 덮어쓰지 않는다 – 보이는 텍스트가 그대로 accessible content여야 한다
    expect(link).not.toHaveAttribute("aria-label");
    expect(link.tabIndex).not.toBe(-1);
  });

  it("link accessible name에 제목·기간·작성자·핵심 차이·내 의견이 모두 포함된다", () => {
    renderCard({ differenceSummary: "오사카 1박 추가", myReaction: "LIKE" });
    const link = screen.getByRole("link");
    expect(link).toHaveAccessibleName(/기본 여행안/);
    expect(link).toHaveAccessibleName(/3박 4일/);
    expect(link).toHaveAccessibleName(/민지 제안/);
    expect(link).toHaveAccessibleName(/오사카 1박 추가/);
    expect(link).toHaveAccessibleName(/내 의견 좋아요/);
  });

  it("작은 텍스트가 AA 대비 토큰을 사용한다 (RAON-226 리뷰 P1)", () => {
    renderCard({ differenceSummary: "차이" });
    const diffEl = screen.getByText("차이");
    expect(diffEl.className).toMatch(/text-info/);
    expect(diffEl.className).not.toMatch(/text-primary\b/);

    const authorEl = screen.getByText("민지 제안");
    expect(authorEl.className).toMatch(/text-foreground-muted/);
    expect(authorEl.className).not.toMatch(/text-foreground-subtle/);

    const durationEl = screen.getByText("3박 4일");
    expect(durationEl.className).toMatch(/text-foreground-muted/);
    expect(durationEl.className).not.toMatch(/text-muted-foreground/);

    const opinionEl = getReactionPill("좋아요", 2);
    expect(opinionEl.className).toMatch(/text-foreground-muted/);
  });

  it("내 의견이 없을 때도 저대비 muted-foreground를 쓰지 않는다", () => {
    renderCard({ opinions: { likeCount: 0, okayCount: 0, hardCount: 0 }, myReaction: undefined });
    const idleEl = screen.getByText("내 의견 전");
    expect(idleEl.className).toMatch(/text-foreground-muted/);
    expect(idleEl.className).not.toMatch(/text-muted-foreground/);
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

  it("accessible name에 '좋아요 2명', '괜찮아요 1명'처럼 의미와 단위가 보존된다 (RAON-227)", () => {
    renderCard();
    const link = screen.getByRole("link");
    expect(link).toHaveAccessibleName(/좋아요 2명/);
    expect(link).toHaveAccessibleName(/괜찮아요 1명/);
  });

  it("0-count 반응은 pill을 렌더하지 않는다 (RAON-227)", () => {
    renderCard({ opinions: { likeCount: 2, okayCount: 1, hardCount: 0 } });
    expect(findReactionPill("좋아요", 2)).toBeDefined();
    expect(findReactionPill("괜찮아요", 1)).toBeDefined();
    expect(findReactionPill("어려워요", 0)).toBeUndefined();
    const link = screen.getByRole("link");
    expect(link.textContent).not.toMatch(/어려워요/);
  });

  it("반응 아이콘은 aria-hidden이라 accessible name에 기여하지 않는다 (RAON-227)", () => {
    renderCard();
    const pill = getReactionPill("좋아요", 2);
    const icon = pill.querySelector("svg");
    expect(icon).not.toBeNull();
    expect(icon).toHaveAttribute("aria-hidden", "true");
    expect(icon).not.toHaveAttribute("aria-label");
    // 아이콘은 텍스트를 갖지 않고, pill이 읽히는 내용은 sr-only 한글 label + 숫자 + 단위뿐이다
    expect(icon?.textContent).toBe("");
    expect(pill.textContent).toBe("좋아요 2명");
  });
});
