// @vitest-environment jsdom
import { render, screen, act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OfflineStatusBanner } from "./OfflineStatusBanner.tsx";

describe("OfflineStatusBanner", () => {
  it("renders nothing when online and displays banner when offline", () => {
    const onLineSpy = vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    const { rerender } = render(<OfflineStatusBanner />);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    act(() => {
      onLineSpy.mockReturnValue(false);
      window.dispatchEvent(new Event("offline"));
    });
    rerender(<OfflineStatusBanner />);

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText(/오프라인 상태입니다/)).toBeInTheDocument();

    act(() => {
      onLineSpy.mockReturnValue(true);
      window.dispatchEvent(new Event("online"));
    });
    rerender(<OfflineStatusBanner />);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    onLineSpy.mockRestore();
  });
});
