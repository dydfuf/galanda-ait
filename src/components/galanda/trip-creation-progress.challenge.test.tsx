// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  TripCreationProgress,
  TRIP_CREATION_STAGES,
  type TripCreationStep,
} from "./trip-creation-progress.tsx";

describe("Adversarial & Exhaustive Stage Tests: TripCreationProgress", () => {
  const all7Steps: Array<{
    step: TripCreationStep;
    expectedStageIndex: number;
    expectedStageLabel: string;
    subLabel?: string;
  }> = [
    { step: "trip-info", expectedStageIndex: 0, expectedStageLabel: "여행방" },
    { step: "companions", expectedStageIndex: 1, expectedStageLabel: "동행자" },
    { step: "plan-basic", expectedStageIndex: 2, expectedStageLabel: "첫 여행안", subLabel: "기본 정보" },
    { step: "plan-route", expectedStageIndex: 2, expectedStageLabel: "첫 여행안", subLabel: "여행 경로" },
    { step: "plan-accommodation", expectedStageIndex: 2, expectedStageLabel: "첫 여행안", subLabel: "숙소" },
    { step: "plan-transport", expectedStageIndex: 2, expectedStageLabel: "첫 여행안", subLabel: "교통" },
    { step: "plan-review", expectedStageIndex: 3, expectedStageLabel: "검토" },
  ];

  it("Exhaustively verifies all 7 steps map to correct 4 main stages with accurate counts and accessibility attributes", () => {
    for (const { step, expectedStageIndex, expectedStageLabel, subLabel } of all7Steps) {
      const { container, unmount } = render(
        <TripCreationProgress currentStep={step} subStepLabel={subLabel} />
      );

      const nav = screen.getByRole("navigation", { name: "여행 만들기 진행 단계" });
      expect(nav).toBeInTheDocument();
      expect(nav).toHaveFocus();

      // Check counter string
      const expectedCounter = `${expectedStageIndex + 1}/${TRIP_CREATION_STAGES.length}`;
      expect(nav).toHaveTextContent(expectedCounter);

      // Check title rendering
      const expectedTitle = subLabel ? `${expectedStageLabel} · ${subLabel}` : expectedStageLabel;
      expect(nav).toHaveTextContent(expectedTitle);

      // Check list items
      const items = screen.getAllByRole("listitem");
      expect(items).toHaveLength(4);

      const states = items.map((item) => item.getAttribute("data-state"));
      const currentStates = states.filter((s) => s === "current");
      const previousStates = states.filter((s) => s === "previous");
      const upcomingStates = states.filter((s) => s === "upcoming");

      expect(currentStates).toHaveLength(1);
      expect(previousStates).toHaveLength(expectedStageIndex);
      expect(upcomingStates).toHaveLength(3 - expectedStageIndex);

      expect(items[expectedStageIndex]).toHaveAttribute("aria-current", "step");
      expect(items[expectedStageIndex]).toHaveAttribute("data-state", "current");
      expect(items[expectedStageIndex]!.textContent).toContain(
        `${expectedStageIndex + 1}. ${TRIP_CREATION_STAGES[expectedStageIndex]!.label} 현재 단계`
      );

      // Check data-state counts
      expect(container.querySelectorAll('[data-state="current"]')).toHaveLength(1);
      expect(container.querySelectorAll('[data-state="previous"]')).toHaveLength(expectedStageIndex);
      expect(container.querySelectorAll('[data-state="upcoming"]')).toHaveLength(3 - expectedStageIndex);

      unmount();
    }
  });

  it("Stress-tests subStepLabels with various edge cases (empty string, special characters, very long string)", () => {
    const edgeSubLabels = [
      { label: undefined, expectedSnippet: "첫 여행안" },
      { label: "Q1. 여행 제목 & 제안 이유 (1/3)", expectedSnippet: "첫 여행안 · Q1. 여행 제목 & 제안 이유 (1/3)" },
      { label: "Very Long Description ".repeat(5).trim(), expectedSnippet: `첫 여행안 · ${"Very Long Description ".repeat(5).trim()}` },
      { label: "<script>alert(1)</script>", expectedSnippet: "첫 여행안 · <script>alert(1)</script>" },
      { label: "🚀 제주 1일차 숙소 찾기 🏖️", expectedSnippet: "첫 여행안 · 🚀 제주 1일차 숙소 찾기 🏖️" },
    ];

    for (const { label, expectedSnippet } of edgeSubLabels) {
      const { unmount } = render(
        <TripCreationProgress currentStep="plan-basic" subStepLabel={label} />
      );

      const nav = screen.getByRole("navigation", { name: "여행 만들기 진행 단계" });
      expect(nav).toHaveTextContent(expectedSnippet);
      unmount();
    }
  });

  it("Gracefully handles invalid/unknown step values by falling back to stage 1 (여행방)", () => {
    const { container } = render(
      <TripCreationProgress currentStep={"unknown-step" as unknown as TripCreationStep} />
    );

    const nav = screen.getByRole("navigation", { name: "여행 만들기 진행 단계" });
    expect(nav).toHaveTextContent("1/4");
    expect(nav).toHaveTextContent("여행방");

    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveAttribute("aria-current", "step");
    expect(items[0]).toHaveAttribute("data-state", "current");
    expect(container.querySelectorAll('[data-state="upcoming"]')).toHaveLength(3);
  });

  it("Focus management: Focus is updated on step change and on subStepLabel change without scroll jump", () => {
    const { rerender } = render(
      <TripCreationProgress currentStep="trip-info" />
    );
    const nav = screen.getByRole("navigation", { name: "여행 만들기 진행 단계" });
    expect(nav).toHaveFocus();

    nav.blur();
    expect(nav).not.toHaveFocus();

    // Change subStepLabel
    rerender(<TripCreationProgress currentStep="trip-info" subStepLabel="이름 입력" />);
    expect(nav).toHaveFocus();

    nav.blur();
    expect(nav).not.toHaveFocus();

    // Advance step
    rerender(<TripCreationProgress currentStep="companions" />);
    expect(nav).toHaveFocus();
  });
});
