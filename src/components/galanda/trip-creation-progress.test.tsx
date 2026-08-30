// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TripCreationProgress } from "./trip-creation-progress.tsx";

describe("TripCreationProgress", () => {
  it("여행방 생성부터 검토·등록까지 7단계를 ordered list로 전달한다", () => {
    const { container, rerender } = render(
      <TripCreationProgress currentStep="plan-accommodation" />,
    );

    const progress = screen.getByRole("navigation", {
      name: "여행 만들기 진행 단계",
    });
    expect(progress).toHaveTextContent("5/7");
    expect(progress).toHaveTextContent("숙소");
    expect(progress).toHaveFocus();
    expect(progress.querySelector('[aria-live="polite"]')).toHaveAttribute(
      "aria-atomic",
      "true",
    );

    const steps = screen.getAllByRole("listitem");
    expect(steps).toHaveLength(7);
    expect(steps[4]).toHaveAttribute("aria-current", "step");
    expect(steps[4]).toHaveTextContent("5. 숙소 현재 단계");
    expect(steps[0]).toHaveTextContent("1. 여행 정보 이전 단계");
    expect(steps[6]).toHaveTextContent("7. 검토·등록 예정");
    expect(container.querySelectorAll('[data-state="previous"]')).toHaveLength(
      4,
    );
    expect(container.querySelectorAll('[data-state="upcoming"]')).toHaveLength(
      2,
    );

    progress.blur();
    rerender(<TripCreationProgress currentStep="plan-transport" />);
    expect(progress).toHaveFocus();
    expect(progress).toHaveTextContent("6/7");
    expect(progress).toHaveTextContent("교통");
  });
});
