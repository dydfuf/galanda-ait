// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TripCreationProgress } from "./trip-creation-progress.tsx";

describe("TripCreationProgress", () => {
  it("여행방 생성부터 검토까지 4단계를 ordered list와 counter로 표시한다", () => {
    const { container } = render(
      <TripCreationProgress currentStep="trip-info" />,
    );

    const progress = screen.getByRole("navigation", {
      name: "여행 만들기 진행 단계",
    });
    expect(progress).toHaveTextContent("1/4");
    expect(progress).toHaveTextContent("여행방");
    expect(progress).toHaveFocus();
    expect(progress.querySelector('[aria-live="polite"]')).toHaveAttribute(
      "aria-atomic",
      "true",
    );

    const steps = screen.getAllByRole("listitem");
    expect(steps).toHaveLength(4);
    expect(steps[0]).toHaveAttribute("aria-current", "step");
    expect(steps[0]).toHaveTextContent("1. 여행방 현재 단계");
    expect(steps[1]).toHaveTextContent("2. 동행자 예정");
    expect(steps[2]).toHaveTextContent("3. 첫 여행안 예정");
    expect(steps[3]).toHaveTextContent("4. 검토 예정");
    expect(container.querySelectorAll('[data-state="current"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-state="upcoming"]')).toHaveLength(3);
    expect(container.querySelectorAll('[data-state="previous"]')).toHaveLength(0);
  });

  it("동행자 단계(2/4)에서 이전 단계와 예정 단계를 구분한다", () => {
    const { container } = render(
      <TripCreationProgress currentStep="companions" />,
    );

    const progress = screen.getByRole("navigation", {
      name: "여행 만들기 진행 단계",
    });
    expect(progress).toHaveTextContent("2/4");
    expect(progress).toHaveTextContent("동행자");

    const steps = screen.getAllByRole("listitem");
    expect(steps[0]).toHaveTextContent("1. 여행방 이전 단계");
    expect(steps[1]).toHaveAttribute("aria-current", "step");
    expect(steps[1]).toHaveTextContent("2. 동행자 현재 단계");
    expect(steps[2]).toHaveTextContent("3. 첫 여행안 예정");
    expect(steps[3]).toHaveTextContent("4. 검토 예정");
    expect(container.querySelectorAll('[data-state="previous"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-state="current"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-state="upcoming"]')).toHaveLength(2);
  });

  it("첫 여행안 하위 단계들(plan-basic, plan-route, plan-accommodation, plan-transport)이 모두 3/4 단계로 매핑된다", () => {
    const subSteps = [
      { step: "plan-basic" as const, label: "기본 정보" },
      { step: "plan-route" as const, label: "여행 경로" },
      { step: "plan-accommodation" as const, label: "숙소" },
      { step: "plan-transport" as const, label: "교통" },
    ];

    const { rerender } = render(
      <TripCreationProgress currentStep="plan-basic" subStepLabel="기본 정보" />,
    );

    const progress = screen.getByRole("navigation", {
      name: "여행 만들기 진행 단계",
    });

    for (const { step, label } of subSteps) {
      rerender(<TripCreationProgress currentStep={step} subStepLabel={label} />);
      expect(progress).toHaveTextContent("3/4");
      expect(progress).toHaveTextContent(`첫 여행안 · ${label}`);

      const steps = screen.getAllByRole("listitem");
      expect(steps[2]).toHaveAttribute("aria-current", "step");
      expect(steps[2]).toHaveTextContent("3. 첫 여행안 현재 단계");
      expect(steps[0]).toHaveTextContent("1. 여행방 이전 단계");
      expect(steps[1]).toHaveTextContent("2. 동행자 이전 단계");
      expect(steps[3]).toHaveTextContent("4. 검토 예정");
    }
  });

  it("subStepLabel이 생략되면 메인 단계명만 표시한다", () => {
    render(<TripCreationProgress currentStep="plan-basic" />);
    const progress = screen.getByRole("navigation", {
      name: "여행 만들기 진행 단계",
    });
    expect(progress).toHaveTextContent("3/4");
    expect(progress).toHaveTextContent("첫 여행안");
    expect(progress).not.toHaveTextContent("·");
  });

  it("검토 단계(4/4)에서는 이전 3단계가 모두 previous로 표시된다", () => {
    const { container } = render(
      <TripCreationProgress currentStep="plan-review" />,
    );

    const progress = screen.getByRole("navigation", {
      name: "여행 만들기 진행 단계",
    });
    expect(progress).toHaveTextContent("4/4");
    expect(progress).toHaveTextContent("검토");

    const steps = screen.getAllByRole("listitem");
    expect(steps[3]).toHaveAttribute("aria-current", "step");
    expect(steps[3]).toHaveTextContent("4. 검토 현재 단계");
    expect(container.querySelectorAll('[data-state="previous"]')).toHaveLength(3);
    expect(container.querySelectorAll('[data-state="current"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-state="upcoming"]')).toHaveLength(0);
  });

  it("currentStep 또는 subStepLabel 변경 시 progress nav로 focus가 이동한다", () => {
    const { rerender } = render(
      <TripCreationProgress currentStep="trip-info" />,
    );
    const progress = screen.getByRole("navigation", {
      name: "여행 만들기 진행 단계",
    });
    expect(progress).toHaveFocus();

    progress.blur();
    expect(progress).not.toHaveFocus();

    rerender(<TripCreationProgress currentStep="companions" />);
    expect(progress).toHaveFocus();

    progress.blur();
    rerender(
      <TripCreationProgress currentStep="plan-basic" subStepLabel="기본 정보" />,
    );
    expect(progress).toHaveFocus();
  });

  it("사용자 지정 className이 올바르게 합성된다", () => {
    render(
      <TripCreationProgress currentStep="trip-info" className="custom-class" />,
    );
    const progress = screen.getByRole("navigation", {
      name: "여행 만들기 진행 단계",
    });
    expect(progress).toHaveClass("custom-class");
    expect(progress).toHaveClass("rounded-2xl");
  });
});
