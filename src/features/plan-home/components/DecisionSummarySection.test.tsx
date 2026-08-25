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

    expect(screen.getByText(/후보 2개 · 의견 4개 · 참여 3\/4명/)).toBeInTheDocument();
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
});
