// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";
import { ApiClientError } from "../../app/api-client.ts";
import { SessionRecoveryAction } from "./SessionRecoveryAction.tsx";

function Location() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}</output>;
}

describe("SessionRecoveryAction", () => {
  it("401에서도 자동 이동하지 않고 사용자 선택 후 현재 편집 경로로 돌아오도록 로그인한다", () => {
    render(<MemoryRouter initialEntries={["/trips/trip/plans/new"]}><SessionRecoveryAction error={new ApiClientError({ status: 401, message: "expired" })} returnTo="/trips/trip/plans/new?step=review" /><Location /></MemoryRouter>);
    expect(screen.getByTestId("location").textContent).toBe("/trips/trip/plans/new");
    fireEvent.click(screen.getByRole("button", { name: "다시 로그인하고 이어하기" }));
    expect(screen.getByTestId("location").textContent).toBe("/login?returnTo=%2Ftrips%2Ftrip%2Fplans%2Fnew%3Fstep%3Dreview");
  });
  it("권한 거절을 세션 만료로 오인하지 않는다", () => {
    render(<MemoryRouter><SessionRecoveryAction error={new ApiClientError({ status: 403, message: "forbidden" })} returnTo="/trips" /></MemoryRouter>);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
