// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge } from "./badge.tsx";

describe("Badge (RAON-159 .tsx smoke)", () => {
  it("renders children and applies variant", () => {
    render(<Badge variant="info">여행안</Badge>);
    expect(screen.getByText("여행안")).toBeInTheDocument();
  });

  it("supports info-solid variant", () => {
    render(<Badge variant="info-solid" data-testid="badge">확정안</Badge>);
    expect(screen.getByTestId("badge")).toBeInTheDocument();
  });
});
