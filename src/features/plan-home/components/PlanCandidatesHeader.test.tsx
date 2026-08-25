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

  it("좌우 그룹이 한 줄을 유지하도록 heading 그룹은 줄바꿈을 허용하고 버튼은 고정 폭을 유지한다", () => {
    render(
      <PlanCandidatesHeader
        candidateCount={12}
        showNewProposalAction
        onNewProposalAction={() => {}}
      />,
    );

    const countEl = screen.getByText("후보 12개");
    expect(countEl.className).toMatch(/whitespace-nowrap/);

    const button = screen.getByRole("button", { name: "새 여행안 제안하기" });
    expect(button.className).toMatch(/shrink-0/);
  });
});
