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
            kind: "DANGER",
            message: "도쿄 숙소가 현재 만실 상태예요",
            snapshotInfo: "예약 불가 확인",
          },
        ]}
      />,
    );

    expect(screen.getByText("확인이 필요한 항목 1개")).toBeInTheDocument();
    expect(screen.getByText("예약 어려움")).toBeInTheDocument();
  });

  it("확인 필요 항목과 확인 전 항목이 함께 있을 때 각각의 개수를 정확히 분리하여 표시한다", () => {
    render(
      <BookingRiskSummary
        hasDetails={true}
        items={[
          {
            level: "WARNING",
            kind: "WARNING",
            message: "도쿄 숙소 잔여 객실 확인이 필요해요",
            snapshotInfo: "잔여 객실 소량",
          },
          {
            level: "WARNING",
            kind: "UNCHECKED",
            message: "서울 → 도쿄 교통 예약 상태를 아직 확인하지 않았어요",
            snapshotInfo: "아직 예약 상태를 확인하지 않았어요",
          },
          {
            level: "WARNING",
            kind: "UNCHECKED",
            message: "도쿄 → 서울 교통 예약 상태를 아직 확인하지 않았어요",
            snapshotInfo: "아직 예약 상태를 확인하지 않았어요",
          },
        ]}
      />,
    );

    expect(
      screen.getByText("확인이 필요한 항목 1개 · 확인 전 2개"),
    ).toBeInTheDocument();
    expect(screen.getByText("확인 필요")).toBeInTheDocument();
    expect(screen.getAllByText("확인 전")).toHaveLength(2);
  });
});
