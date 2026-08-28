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
    expect(screen.getByText(/참여 3\/4명 · 의견 4개/)).toBeInTheDocument();
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
        badgeText="첫 여행안 필요"
        badgeVariant="warning"
      />,
    );

    expect(screen.getByText("첫 여행안 필요")).toBeInTheDocument();
    expect(screen.queryByText(baseProps.statusText)).not.toBeInTheDocument();
    expect(screen.queryByText(/참여/)).not.toBeInTheDocument();
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
    const aggregate = screen.getByText(/참여 3\/4명 · 의견 4개/);

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
