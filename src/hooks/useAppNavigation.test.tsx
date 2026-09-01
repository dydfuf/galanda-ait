// @vitest-environment jsdom
import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useAppNavigation } from "./useAppNavigation.ts";
import { platform } from "../platform/index.ts";

const mockNavigate = vi.fn();
let mockLocation = { pathname: "/trips/1/plans" };

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => mockLocation,
}));

describe("useAppNavigation", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockNavigate.mockReset();
    mockLocation = { pathname: "/trips/1/plans" };
  });

  it("calls navigate(-1) when there is history in session", async () => {
    window.history.replaceState({ idx: 2 }, "", "/trips/1/plans");

    const { result, rerender } = renderHook(() => useAppNavigation());
    // simulate another navigation to bump counter
    mockLocation = { pathname: "/trips/1/plans/plan-1" };
    rerender();

    await act(async () => {
      await result.current.goBack();
    });

    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it("calls platform.requestClose when there is no browser history", async () => {
    window.history.replaceState({ idx: 0 }, "", "/trips/1/plans");
    const requestCloseSpy = vi.spyOn(platform, "requestClose").mockResolvedValue(true);

    const { result } = renderHook(() => useAppNavigation());

    await act(async () => {
      await result.current.goBack();
    });

    expect(requestCloseSpy).toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("falls back to navigate(/trips, { replace: true }) when requestClose fails or returns false", async () => {
    window.history.replaceState({ idx: 0 }, "", "/trips/1/plans");
    vi.spyOn(platform, "requestClose").mockResolvedValue(false);

    const { result } = renderHook(() => useAppNavigation());

    await act(async () => {
      await result.current.goBack("/custom-fallback");
    });

    expect(mockNavigate).toHaveBeenCalledWith("/custom-fallback", { replace: true });
  });
});
