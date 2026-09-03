// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BookingRiskSummary } from "./BookingRiskSummary.tsx";

describe("BookingRiskSummary", () => {
  it("교통 '아직 안 정함' 등 미확인 항목은 경고 톤이 아닌 중립 '확인 전'으로 표시한다", () => {
    render(
      <BookingRiskSummary
        hasDetails={true}
        items={[
          {
            level: "WARNING",
            message: "서울 → 도쿄 교통 예약 상태를 아직 확인하지 않았어요",
            snapshotInfo: "아직 예약 상태를 확인하지 않았어요",
          },
        ]}
      />,
    );

    expect(screen.getByText("확인 전인 항목 1개")).toBeInTheDocument();
    expect(screen.getByText("확인 전")).toBeInTheDocument();
    expect(screen.queryByText("확인 필요")).not.toBeInTheDocument();
  });

  it("실제 예약 불가(DANGER) 항목이 있으면 경고/위험 상태를 명확히 표시한다", () => {
    render(
      <BookingRiskSummary
        hasDetails={true}
        items={[
          {
            level: "DANGER",
            message: "도쿄 숙소가 현재 만실 상태예요",
            snapshotInfo: "예약 불가 확인",
          },
        ]}
      />,
    );

    expect(screen.getByText("확인이 필요한 항목 1개")).toBeInTheDocument();
    expect(screen.getByText("예약 어려움")).toBeInTheDocument();
  });
});
