// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import type { PlanHomePlanSummaryData } from "../plan-home-view-model.ts";
import { PlanDecisionCard } from "./PlanDecisionCard.tsx";

const basePlan: PlanHomePlanSummaryData = {
  id: "plan-1",
  title: "기본 여행안",
  planTag: "BASIC",
  planTagLabel: "기본안",
  period: "2026-12-12 ~ 2026-12-15",
  nights: 3,
  days: 4,
  differenceSummaryText: "핵심 차이 미정",
  authorName: "민지",
  opinions: { likeCount: 2, okayCount: 1, hardCount: 0 },
  myReaction: undefined,
  isConfirmed: false,
  routeText: "도쿄 2박 · 오사카 1박",
  costSummary: {
    minTotal: 200_000,
    maxTotal: 200_000,
    hasCost: true,
    isRange: false,
    unpricedCount: 0,
    baseHeadcount: 2,
    minPerPerson: 100_000,
    maxPerPerson: 100_000,
  },
  perPersonCostText: "2명 기준 1인 10만원",
  booking: {
    state: "READY",
    fullCount: 0,
    needCheckCount: 0,
    uncheckedCount: 0,
    hasAnyBookingInformation: true,
    isBookingComplete: true,
    text: "예약 확인 완료",
  },
  respondentCount: 2,
  eligibleResponseCount: 3,
  responseText: "이 여행안에 2/3명 응답",
  nonRespondentNames: ["준호"],
  nonRespondentText: "준호님은 아직 의견이 없어요",
};

const renderCard = (
  overrides: Partial<PlanHomePlanSummaryData> = {},
  to = "/trips/t1/plans/plan-1",
) => {
  const plan = {
    ...basePlan,
    ...overrides,
    differenceSummaryText:
      overrides.differenceSummary?.trim() ||
      overrides.differenceSummaryText ||
      basePlan.differenceSummaryText,
  } as PlanHomePlanSummaryData;
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
    renderCard({ planTag: "BASIC", planTagLabel: "기본안", isConfirmed: true });
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

  it("differenceSummary가 없으면 빈 값을 만들지 않고 명시적인 미정 문구를 표시한다", () => {
    renderCard({ differenceSummary: undefined, routeText: "경로 미정" });

    expect(screen.getByText("핵심 차이 미정")).toBeInTheDocument();
    expect(screen.queryByText(/오사카 1박 추가/)).not.toBeInTheDocument();
    const fallback = screen.getByText("핵심 차이 미정");
    expect(fallback.parentElement?.className).not.toMatch(
      /border-primary-border-weak/,
    );
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

  it("의견이 없을 때의 빈 상태 문장도 저대비 muted-foreground를 쓰지 않는다", () => {
    renderCard({ opinions: { likeCount: 0, okayCount: 0, hardCount: 0 }, myReaction: undefined });
    const emptyEl = screen.getByText("아직 의견이 없어요");
    expect(emptyEl.className).toMatch(/text-foreground-muted/);
    expect(emptyEl.className).not.toMatch(/text-muted-foreground/);
  });

  it("긴 제목·작성자·차이는 accessible content를 보존하면서 카드 밖 overflow를 막는다", () => {
    const longTitle = "아주 긴 제목 ".repeat(20);
    const longAuthor = "동명이인을 구분해야 하는 매우 긴 작성자 이름 "
      .repeat(8)
      .trim();
    const longDiff = "매우 긴 차이 요약 ".repeat(20);
    renderCard({
      title: longTitle,
      authorName: longAuthor,
      differenceSummary: longDiff,
    });

    const titleEl = screen.getByRole("heading", { level: 3 });
    expect(titleEl.className).toMatch(/line-clamp-2/);
    expect(titleEl.className).toMatch(/break-words/);
    expect(titleEl.textContent).toContain("아주 긴 제목");

    const authorEl = screen.getByText(`${longAuthor} 제안`);
    expect(authorEl.className).toMatch(/break-words/);
    expect(authorEl.className).toMatch(/line-clamp-1/);

    const card = screen.getByRole("link");
    expect(card.className).toMatch(/overflow-hidden/);
    expect(card.className).toMatch(/bg-surface-raised/);
    expect(card).toHaveAccessibleName(new RegExp(longAuthor.slice(0, 24)));

    const diffEl = screen.getByText(
      (content, element) =>
        element?.tagName === "P" && content.includes("매우 긴 차이 요약"),
    );
    expect(diffEl.className).toMatch(/line-clamp-2/);
  });

  it("의견이 없을 때 '아직 의견이 없어요'만 표시하고 내 의견 chip을 렌더하지 않는다 (RAON-227)", () => {
    renderCard({
      opinions: { likeCount: 0, okayCount: 0, hardCount: 0 },
      myReaction: undefined,
      nonRespondentText: undefined,
      nonRespondentNames: [],
    });
    expect(screen.getByText("아직 의견이 없어요")).toBeInTheDocument();
    const link = screen.getByRole("link");
    // 내 의견도 aggregate에 집계되므로 합이 0이면 "내 의견" 표시는 같은 사실의 중복이다
    expect(link.textContent).not.toMatch(/내 의견/);
    // 의견 행 안에 매달린 가운데점이 남지 않는다 (경로·비용의 구분자는 별도 영역)
    const emptyEl = screen.getByText("아직 의견이 없어요");
    expect(emptyEl.parentElement?.textContent).not.toMatch(/·/);
  });

  it("aggregate가 0이어도 myReaction이 있으면 내 의견 chip을 표시한다 (legacy voteCount 폴백 방어)", () => {
    renderCard({ opinions: { likeCount: 0, okayCount: 0, hardCount: 0 }, myReaction: "OKAY" });
    expect(screen.getByText("내 의견 괜찮아요")).toBeInTheDocument();
    expect(screen.queryByText("아직 의견이 없어요")).not.toBeInTheDocument();
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

describe("PlanDecisionCard Decision Cockpit (RAON-293)", () => {
  it("1인 비용·예약 위험·후보별 응답률을 카드에서 확인한다", () => {
    renderCard();
    expect(screen.getByText("2명 기준 1인 10만원")).toBeInTheDocument();
    expect(screen.getByText("예약 확인 완료")).toBeInTheDocument();
    expect(screen.getByText("이 여행안에 2/3명 응답")).toBeInTheDocument();
    expect(screen.getByText("준호님은 아직 의견이 없어요")).toBeInTheDocument();
    expect(screen.getByText("도쿄 2박 · 오사카 1박")).toBeInTheDocument();
  });

  it("비용 미입력은 0원이 아니라 비용 미정으로 표시한다", () => {
    renderCard({
      perPersonCostText: "비용 미정",
      costSummary: {
        minTotal: 0,
        maxTotal: 0,
        hasCost: false,
        isRange: false,
        unpricedCount: 2,
        baseHeadcount: 2,
        minPerPerson: 0,
        maxPerPerson: 0,
      },
    });
    expect(screen.getByText("비용 미정")).toBeInTheDocument();
    const link = screen.getByRole("link");
    expect(link.textContent).not.toMatch(/0원/);
  });

  it("명시적 0원은 비용 미정과 구분해 0원으로 표시한다", () => {
    renderCard({ perPersonCostText: "2명 기준 1인 0원" });
    expect(screen.getByText("2명 기준 1인 0원")).toBeInTheDocument();
  });

  it("예약 확인 필요가 있으면 경고 스타일로 건수를 표시한다", () => {
    renderCard({
      booking: {
        state: "NEEDS_CHECK",
        fullCount: 0,
        needCheckCount: 2,
        uncheckedCount: 0,
        hasAnyBookingInformation: true,
        isBookingComplete: false,
        text: "확인 필요 2건",
      },
    });
    const risk = screen.getByText("확인 필요 2건");
    expect(risk).toBeInTheDocument();
    expect(risk.className).toMatch(/bg-warning-muted/);
  });

  it("FULL은 확인 필요가 아니라 예약 불가와 danger 스타일로 표시한다", () => {
    renderCard({
      booking: {
        state: "UNAVAILABLE",
        fullCount: 1,
        needCheckCount: 1,
        uncheckedCount: 0,
        hasAnyBookingInformation: true,
        isBookingComplete: false,
        text: "예약 불가 1건",
      },
    });
    const risk = screen.getByText("예약 불가 1건");
    expect(risk).toBeInTheDocument();
    expect(risk.className).toMatch(/bg-destructive-muted/);
    expect(risk.className).toMatch(/text-destructive-strong/);
  });

  it("예약 정보가 없으면 없음을 숨기지 않고 표시한다", () => {
    renderCard({
      booking: {
        state: "NO_INFORMATION",
        fullCount: 0,
        needCheckCount: 0,
        uncheckedCount: 0,
        hasAnyBookingInformation: false,
        isBookingComplete: false,
        text: "예약 정보 없음",
      },
    });
    expect(screen.getByText("예약 정보 없음")).toBeInTheDocument();
  });

  it("긴 이름·경로·비용 문구도 카드 밖 overflow를 만들지 않는다", () => {
    const longTitle = "아주 긴 여행안 제목 ".repeat(15).trim();
    const longRoute = "아주 긴 도시 이름 ".repeat(15).trim();
    const longCost = "12명 기준 1인 123만원 ~ 456만원 (가격 미정 7건 별도)";
    renderCard({
      title: longTitle,
      routeText: longRoute,
      perPersonCostText: longCost,
      responseText: "이 여행안에 0/6명 응답",
      nonRespondentText:
        "아주 긴 이름을 가진 참여자님 외 5명은 아직 의견이 없어요",
    });
    const card = screen.getByRole("link");
    expect(card.className).toMatch(/overflow-hidden/);
    expect(card.className).toMatch(/min-w-0/);
    // 비용 행은 nowrap pill이 아니라 줄바꿈 행이라 한정 문구까지 잘리지 않는다
    const costEl = screen.getByText(longCost);
    expect(costEl.tagName).toBe("P");
    expect(costEl.className).toMatch(/break-words/);
    expect(costEl.className).toMatch(/\[overflow-wrap:anywhere\]/);
    expect(costEl.className).not.toMatch(/whitespace-nowrap/);
    expect(costEl.className).not.toMatch(/rounded-full/);
  });
});
