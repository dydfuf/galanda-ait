// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { DecisionSummarySection } from "./DecisionSummarySection.tsx";

const baseProps = {
  statusText: "2명 중 의견을 모으고 있어요",
  subText: "마음에 드는 여행안을 비교하고 가장 좋은 안을 골라보세요.",
  candidateCount: 2,
  totalOpinionCount: 4,
  participatedMemberCount: 3,
  memberCount: 4,
  overallParticipationText: "4명 중 3명이 한 번 이상 의견을 남겼어요",
};

describe("DecisionSummarySection (RAON-225)", () => {
  it("진행 상태 heading과 상태 배지를 함께 표시한다", () => {
    render(
      <DecisionSummarySection
        {...baseProps}
        badgeText="의견 수집 중"
        badgeVariant="info"
      />,
    );

    expect(screen.getByRole("region", { name: "진행 상태" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "진행 상태" }),
    ).toBeInTheDocument();
    expect(screen.getByText("의견 수집 중")).toBeInTheDocument();
    expect(screen.getByText("2명 중 의견을 모으고 있어요")).toBeInTheDocument();
  });

  it("후보·의견·참여 수처럼 계산 가능한 값만 노출한다", () => {
    render(
      <DecisionSummarySection
        {...baseProps}
        badgeText="확정됨"
        badgeVariant="success"
      />,
    );

    // 후보 수는 여행안 섹션이 소유하므로 진행 상태 카드에서 반복하지 않는다
    // DEC-1: 합집합임을 숨기지 않는 정확한 문구를 쓴다 (`참여 3/4명` 금지)
    expect(
      screen.getByText(/4명 중 3명이 한 번 이상 의견을 남겼어요 · 의견 4개/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/참여 3\/4명/)).not.toBeInTheDocument();
    expect(screen.queryByText(/후보/)).not.toBeInTheDocument();
  });

  it("subText가 없어도 렌더링에 실패하지 않는다", () => {
    render(
      <DecisionSummarySection
        {...baseProps}
        subText={undefined}
        badgeText="첫 여행안 필요"
        badgeVariant="warning"
      />,
    );

    expect(screen.getByText("첫 여행안 필요")).toBeInTheDocument();
    expect(screen.queryByText("마음에 드는 여행안을 비교하고 가장 좋은 안을 골라보세요.")).not.toBeInTheDocument();
  });

  it("후보가 없으면 배지만 노출해 empty state와의 중복을 막는다", () => {
    render(
      <DecisionSummarySection
        {...baseProps}
        candidateCount={0}
        totalOpinionCount={0}
        participatedMemberCount={0}
        overallParticipationText="4명 중 0명이 한 번 이상 의견을 남겼어요"
        badgeText="첫 여행안 필요"
        badgeVariant="warning"
      />,
    );

    expect(screen.getByText("첫 여행안 필요")).toBeInTheDocument();
    expect(screen.queryByText(baseProps.statusText)).not.toBeInTheDocument();
    expect(screen.queryByText(/한 번 이상/)).not.toBeInTheDocument();
  });

  it("상태 → 설명 → 참여 집계 순서를 유지하고 상태 변경 문구만 live announcement로 제공한다", () => {
    render(
      <DecisionSummarySection
        {...baseProps}
        badgeText="의견 수집 중"
        badgeVariant="info"
      />,
    );

    const region = screen.getByRole("region", { name: "진행 상태" });
    const heading = screen.getByRole("heading", {
      level: 2,
      name: "진행 상태",
    });
    const status = screen.getByText(baseProps.statusText);
    const description = screen.getByText(baseProps.subText);
    const aggregate = screen.getByText(
      /4명 중 3명이 한 번 이상 의견을 남겼어요 · 의견 4개/,
    );

    expect(heading).toHaveAttribute("id", "decision-status-heading");
    expect(region).toHaveAttribute(
      "aria-labelledby",
      "decision-status-heading",
    );
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(description).not.toHaveAttribute("aria-live");
    expect(
      status.compareDocumentPosition(description) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      description.compareDocumentPosition(aggregate) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});

describe("DecisionSummarySection Decision Cockpit (RAON-293)", () => {
  it("미응답자·어려움·예약 위험·레거시 설명을 상단에서 바로 확인한다", () => {
    render(
      <DecisionSummarySection
        {...baseProps}
        badgeText="의견 수집 중"
        badgeVariant="info"
        overallNonRespondentText="준호님은 아직 의견이 없어요"
        hardSummaryText="어려워요 2개 · 1개 여행안에서 확인 필요"
        bookingSummaryText="예약 확인 필요 3건"
        unattributedNoticeText="과거 의견 2개는 회원과 연결되지 않아 응답률에서 제외했어요"
      />,
    );

    expect(screen.getByText("준호님은 아직 의견이 없어요")).toBeInTheDocument();
    expect(
      screen.getByText("어려워요 2개 · 1개 여행안에서 확인 필요"),
    ).toBeInTheDocument();
    expect(screen.getByText("예약 확인 필요 3건")).toBeInTheDocument();
    expect(
      screen.getByText(
        "과거 의견 2개는 회원과 연결되지 않아 응답률에서 제외했어요",
      ),
    ).toBeInTheDocument();
  });

  it("막힌 조건이 없으면 추가 행을 렌더하지 않는다", () => {
    render(
      <DecisionSummarySection
        {...baseProps}
        badgeText="의견 수집 중"
        badgeVariant="info"
      />,
    );

    expect(screen.queryByText(/아직 의견이 없어요/)).not.toBeInTheDocument();
    expect(screen.queryByText(/어려워요/)).not.toBeInTheDocument();
    expect(screen.queryByText(/예약 확인 필요/)).not.toBeInTheDocument();
    expect(screen.queryByText(/응답률에서 제외/)).not.toBeInTheDocument();
  });

  it("긴 미응답·위험 문구도 카드 밖 overflow를 만들지 않는다", () => {
    const longName = "아주 긴 이름을 가진 참여자 ".repeat(10).trim();
    render(
      <DecisionSummarySection
        {...baseProps}
        badgeText="의견 수집 중"
        badgeVariant="info"
        overallNonRespondentText={`${longName}님은 아직 의견이 없어요`}
        hardSummaryText="어려워요 5개 · 3개 여행안에서 확인 필요"
        bookingSummaryText="예약 확인 필요 7건"
      />,
    );

    const region = screen.getByRole("region", { name: "진행 상태" });
    expect(region.textContent).toContain("아주 긴 이름을 가진 참여자");
    for (const el of Array.from(
      region.querySelectorAll("p"),
    )) {
      expect(el.className).toMatch(/break-words/);
      expect(el.className).toMatch(/\[overflow-wrap:anywhere\]/);
      expect(el.className).toMatch(/min-w-0/);
    }
  });
});
