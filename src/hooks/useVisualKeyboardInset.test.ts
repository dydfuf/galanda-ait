// @vitest-environment jsdom
import { act, fireEvent, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  resolveKeyboardInset,
  useVisualKeyboardInset,
} from "./useVisualKeyboardInset.ts";

describe("resolveKeyboardInset", () => {
  it("키보드가 닫히면 0을 반환한다", () => {
    expect(resolveKeyboardInset(844, 844, 0)).toBe(0);
  });

  it("visual viewport가 줄어든 만큼 inset을 반환한다", () => {
    expect(resolveKeyboardInset(844, 544, 0)).toBe(300);
  });

  it("pan된 offsetTop만큼 빼고 실제 하단 가림만 반환한다", () => {
    expect(resolveKeyboardInset(844, 544, 120)).toBe(180);
  });

  it("viewport가 더 크면 음수가 아닌 0으로 고정한다", () => {
    expect(resolveKeyboardInset(600, 600, 0)).toBe(0);
  });

  it("비정상 입력에서는 0으로 fallback한다", () => {
    expect(resolveKeyboardInset(Number.NaN, 500, 0)).toBe(0);
    expect(resolveKeyboardInset(800, undefined, 0)).toBe(0);
    expect(resolveKeyboardInset(800, 500, Number.NaN)).toBe(0);
  });
});

function mockViewport(viewport: {
  height: number;
  offsetTop: number;
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
}) {
  Object.defineProperty(window, "visualViewport", {
    configurable: true,
    writable: true,
    value: viewport,
  });
}

describe("useVisualKeyboardInset", () => {
  afterEach(() => {
    document.documentElement.style.removeProperty("--app-keyboard-inset");
    delete document.documentElement.dataset.keyboardOpen;
    document.body.innerHTML = "";
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("마운트 시 inset 0을 게시하고 언마운트 시 정리한다", () => {
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      writable: true,
      value: 844,
    });
    mockViewport({
      height: 844,
      offsetTop: 0,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
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

  it("visualViewport resize에서 offsetTop을 뺀 키보드 높이를 게시한다", () => {
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
    mockViewport(viewport);
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

  it("visualViewport scroll(pan)에서는 offsetTop을 반영해 과대 계산하지 않는다", () => {
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      writable: true,
      value: 844,
    });
    const listeners = new Map<string, () => void>();
    const viewport = {
      height: 544,
      offsetTop: 120,
      addEventListener: vi.fn((type: string, listener: () => void) => {
        listeners.set(type, listener);
      }),
      removeEventListener: vi.fn(),
    };
    mockViewport(viewport);
    let rafCallback: FrameRequestCallback | undefined;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      rafCallback = callback;
      return 1;
    });

    renderHook(() => useVisualKeyboardInset());
    act(() => {
      listeners.get("scroll")?.();
      rafCallback?.(0);
    });
    // 844 - (120 + 544) = 180. offsetTop을 빼지 않으면 300이 된다.
    expect(document.documentElement.style.getPropertyValue("--app-keyboard-inset")).toBe(
      "180px",
    );
    expect(document.documentElement.dataset.keyboardOpen).toBe("true");
  });

  it("실제 BottomAction에 가려진 입력만 끌어올린다", () => {
    vi.useFakeTimers();
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      writable: true,
      value: 844,
    });
    mockViewport({
      height: 544,
      offsetTop: 0,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 0);

    document.body.innerHTML =
      '<div data-slot="bottom-action"></div><input id="target" type="text" />';
    const action = document.querySelector<HTMLElement>(
      '[data-slot="bottom-action"]',
    )!;
    vi.spyOn(action, "getBoundingClientRect").mockReturnValue({
      top: 400,
      bottom: 544,
    } as DOMRect);
    const target = document.getElementById("target")!;
    vi.spyOn(target, "getBoundingClientRect").mockReturnValue({
      top: 100,
      bottom: 130,
    } as DOMRect);
    const scrollIntoView = vi.fn();
    target.scrollIntoView = scrollIntoView;

    renderHook(() => useVisualKeyboardInset());
    act(() => {
      target.focus();
      fireEvent.focusIn(target);
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    // 입력 하단(130)이 action 상단(400)보다 위라서 스크롤하지 않아요.
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("오래된 포커스 timer는 blur된 입력 기준으로 스크롤하지 않는다", () => {
    vi.useFakeTimers();
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      writable: true,
      value: 844,
    });
    mockViewport({
      height: 544,
      offsetTop: 0,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 0);

    document.body.innerHTML =
      '<input id="first" type="text" /><input id="second" type="text" />';
    const first = document.getElementById("first")!;
    const second = document.getElementById("second")!;
    for (const input of [first, second]) {
      vi.spyOn(input, "getBoundingClientRect").mockReturnValue({
        top: 500,
        bottom: 540,
      } as DOMRect);
    }
    const firstScroll = vi.fn();
    const secondScroll = vi.fn();
    first.scrollIntoView = firstScroll;
    second.scrollIntoView = secondScroll;

    renderHook(() => useVisualKeyboardInset());
    act(() => {
      first.focus();
      fireEvent.focusIn(first);
    });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    act(() => {
      second.focus();
      fireEvent.focusIn(second);
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    // 첫 번째 timer는 취소되고, 두 번째 입력 기준으로 한 번만 스크롤해요.
    expect(firstScroll).not.toHaveBeenCalled();
    expect(secondScroll).toHaveBeenCalledTimes(1);
  });

  it("checkbox 같은 비텍스트 input에는 키보드 스크롤을 실행하지 않는다", () => {
    vi.useFakeTimers();
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      writable: true,
      value: 844,
    });
    mockViewport({
      height: 544,
      offsetTop: 0,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 0);

    document.body.innerHTML = '<input id="check" type="checkbox" />';
    const checkbox = document.getElementById("check")!;
    vi.spyOn(checkbox, "getBoundingClientRect").mockReturnValue({
      top: 500,
      bottom: 540,
    } as DOMRect);
    const scrollIntoView = vi.fn();
    checkbox.scrollIntoView = scrollIntoView;

    renderHook(() => useVisualKeyboardInset());
    act(() => {
      checkbox.focus();
      fireEvent.focusIn(checkbox);
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});
