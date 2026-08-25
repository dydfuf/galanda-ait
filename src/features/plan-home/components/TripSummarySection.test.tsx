// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TripSummarySection } from "./TripSummarySection.tsx";

describe("TripSummarySection (RAON-225)", () => {
  it("여행 정보 region에서 제목이 h1으로 표시된다", () => {
    render(
      <TripSummarySection
        title="제주도 힐링 여행"
        destination="제주도"
        period="2026-12-12 ~ 2026-12-17"
        memberCount={4}
      />,
    );

    expect(screen.getByRole("region", { name: "여행 정보" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "제주도 힐링 여행" }),
    ).toBeInTheDocument();
  });

  it("기간과 참여 인원을 제목과 같은 정보 그룹에 배치한다", () => {
    render(
      <TripSummarySection
        title="제주도 힐링 여행"
        destination="제주도"
        period="2026-12-12 ~ 2026-12-17"
        memberCount={4}
      />,
    );

    expect(screen.getByText(/제주도 · 2026-12-12 ~ 2026-12-17 · 참여 4명/)).toBeInTheDocument();
  });
});
