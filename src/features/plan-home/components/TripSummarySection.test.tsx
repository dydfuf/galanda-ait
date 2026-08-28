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

  it("긴 여행 제목과 destination을 줄바꿈 가능한 opaque content로 모두 보존한다", () => {
    const longTitle = "가족 모두가 함께하는 아주 긴 겨울 제주도 여행 제목 "
      .repeat(4)
      .trim();
    const longDestination = "제주특별자치도 서귀포시와 제주시의 긴 목적지 설명 "
      .repeat(4)
      .trim();

    render(
      <TripSummarySection
        title={longTitle}
        destination={longDestination}
        period="일정 미정"
        memberCount={12}
      />,
    );

    const region = screen.getByRole("region", { name: "여행 정보" });
    const heading = screen.getByRole("heading", { level: 1, name: longTitle });
    const summary = screen.getByText(
      `${longDestination} · 일정 미정 · 참여 12명`,
    );

    expect(region.className).toMatch(/bg-surface-raised/);
    expect(heading.className).toContain("[overflow-wrap:anywhere]");
    expect(summary.className).toContain("[overflow-wrap:anywhere]");
  });
});
