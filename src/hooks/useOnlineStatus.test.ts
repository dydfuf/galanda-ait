// @vitest-environment jsdom
import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useOnlineStatus } from "./useOnlineStatus.ts";

describe("useOnlineStatus hook", () => {
  it("returns initial online status and responds to online/offline events", () => {
    const onLineSpy = vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    const { result } = renderHook(() => useOnlineStatus());

    expect(result.current).toBe(true);

    act(() => {
      onLineSpy.mockReturnValue(false);
      window.dispatchEvent(new Event("offline"));
    });

    expect(result.current).toBe(false);

    act(() => {
      onLineSpy.mockReturnValue(true);
      window.dispatchEvent(new Event("online"));
    });

    expect(result.current).toBe(true);
    onLineSpy.mockRestore();
  });
});
