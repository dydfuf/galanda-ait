// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { DecisionStatusBanner } from "./DecisionStatusBanner.tsx";

describe("DecisionStatusBanner (RAON-159)", () => {
  it("renders statusText and badge", () => {
    render(<DecisionStatusBanner statusText="여행안을 고르고 있어요" subText="후보를 확인하세요" />);
    expect(screen.getByText("여행안을 고르고 있어요")).toBeInTheDocument();
    expect(screen.getByText("의견 수집 중")).toBeInTheDocument();
  });

  it("shows confirmed badge when isConfirmed", () => {
    render(<DecisionStatusBanner statusText="일정이 확정되었어요" isConfirmed />);
    expect(screen.getByText("일정이 확정되었어요")).toBeInTheDocument();
    expect(screen.getByText("확정됨")).toBeInTheDocument();
  });
});
