// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { PlanCandidatesHeader } from "./PlanCandidatesHeader.tsx";

describe("PlanCandidatesHeader (RAON-228)", () => {
  it("여행안 heading과 후보 수를 함께 표시한다", () => {
    render(<PlanCandidatesHeader candidateCount={3} />);

    expect(screen.getByRole("heading", { level: 2, name: "여행안" })).toBeInTheDocument();
    expect(screen.getByText("후보 3개")).toBeInTheDocument();
  });

  it("비교하기가 primary인 2개 이상 상태에서 section secondary 제안 버튼을 노출한다", () => {
    render(
      <PlanCandidatesHeader
        candidateCount={2}
        showNewProposalAction
        onNewProposalAction={() => {}}
      />,
    );

    // Plus 아이콘(aria-hidden)과 텍스트로 accessible name이 형성된다
    expect(screen.getByRole("button", { name: "새 여행안 제안하기" })).toBeInTheDocument();
  });

  it("secondary가 꺼진 상태(후보 0/1개, 확정)에서는 제안 버튼을 렌더하지 않는다", () => {
    const { unmount } = render(<PlanCandidatesHeader candidateCount={1} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    unmount();

    render(
      <PlanCandidatesHeader candidateCount={2} showNewProposalAction={false} />,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("secondary 버튼 탭 시 새 여행안 제안 진입 콜백을 실행한다", () => {
    const onNewProposalAction = vi.fn<() => void>();
    render(
      <PlanCandidatesHeader
        candidateCount={2}
        showNewProposalAction
        onNewProposalAction={onNewProposalAction}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "새 여행안 제안하기" }));
    expect(onNewProposalAction).toHaveBeenCalledTimes(1);
  });

  it("후보 수와 secondary action을 heading 뒤의 DOM 순서로 유지하고 좁은 폭에서 줄바꿈한다", () => {
    render(
      <PlanCandidatesHeader
        candidateCount={12}
        showNewProposalAction
        onNewProposalAction={() => {}}
      />,
    );

    const heading = screen.getByRole("heading", { level: 2, name: "여행안" });
    const countEl = screen.getByText("후보 12개");
    const button = screen.getByRole("button", { name: "새 여행안 제안하기" });

    expect(heading).toHaveAttribute("id", "plan-candidates-heading");
    expect(
      heading.compareDocumentPosition(countEl) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      countEl.compareDocumentPosition(button) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(countEl.className).toMatch(/whitespace-nowrap/);
    expect(button.className).toMatch(/max-w-full/);
    expect(button.className).toMatch(/shrink-0/);
    expect(button.className).toMatch(/whitespace-normal/);
  });
});
