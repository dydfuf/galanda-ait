// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  resolveKeyboardInset,
  useVisualKeyboardInset,
} from "./useVisualKeyboardInset.ts";

describe("resolveKeyboardInset", () => {
  it("키보드가 닫히면 0을 반환한다", () => {
    expect(resolveKeyboardInset(844, 844)).toBe(0);
  });

  it("visual viewport가 줄어든 만큼 inset을 반환한다", () => {
    expect(resolveKeyboardInset(844, 544)).toBe(300);
  });

  it("viewport가 더 크면 음수가 아닌 0으로 고정한다", () => {
    expect(resolveKeyboardInset(700, 800)).toBe(0);
  });

  it("비정상 입력에서는 0으로 fallback한다", () => {
    expect(resolveKeyboardInset(Number.NaN, 500)).toBe(0);
    expect(resolveKeyboardInset(800, undefined)).toBe(0);
  });
});

describe("useVisualKeyboardInset", () => {
  afterEach(() => {
    document.documentElement.style.removeProperty("--app-keyboard-inset");
    delete document.documentElement.dataset.keyboardOpen;
    vi.restoreAllMocks();
  });

  it("마운트 시 inset 0을 게시하고 언마운트 시 정리한다", () => {
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      writable: true,
      value: 844,
    });
    const viewport = {
      height: 844,
      offsetTop: 0,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      writable: true,
      value: viewport,
    });
    const raf = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback: FrameRequestCallback) => {
        callback(0);
        return 0;
      });

    const { unmount } = renderHook(() => useVisualKeyboardInset());

    expect(document.documentElement.style.getPropertyValue("--app-keyboard-inset")).toBe(
      "0px",
    );
    expect(document.documentElement.dataset.keyboardOpen).toBeUndefined();

    unmount();
    expect(document.documentElement.style.getPropertyValue("--app-keyboard-inset")).toBe("");
    expect(document.documentElement.dataset.keyboardOpen).toBeUndefined();
    raf.mockRestore();
  });

  it("visualViewport resize에서 키보드 높이를 게시한다", () => {
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      writable: true,
      value: 844,
    });
    const listeners = new Map<string, () => void>();
    const viewport = {
      height: 844,
      offsetTop: 0,
      addEventListener: vi.fn((type: string, listener: () => void) => {
        listeners.set(type, listener);
      }),
      removeEventListener: vi.fn(),
    };
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      writable: true,
      value: viewport,
    });
    let rafCallback: FrameRequestCallback | undefined;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      rafCallback = callback;
      return 1;
    });

    renderHook(() => useVisualKeyboardInset());
    act(() => {
      rafCallback?.(0);
    });
    expect(document.documentElement.style.getPropertyValue("--app-keyboard-inset")).toBe(
      "0px",
    );

    act(() => {
      viewport.height = 544;
      listeners.get("resize")?.();
      rafCallback?.(0);
    });
    expect(document.documentElement.style.getPropertyValue("--app-keyboard-inset")).toBe(
      "300px",
    );
    expect(document.documentElement.dataset.keyboardOpen).toBe("true");
  });
});
