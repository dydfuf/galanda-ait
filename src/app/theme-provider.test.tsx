// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  THEME_STORAGE_KEY,
  ThemeProvider,
  useTheme,
} from "./theme-provider.tsx";

let mediaMatches = false;
let mediaListeners = new Set<(event: MediaQueryListEvent) => void>();

const installMatchMedia = (matches: boolean): void => {
  mediaMatches = matches;
  mediaListeners = new Set();
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn((query: string): MediaQueryList => ({
      matches: mediaMatches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: (
        _type: string,
        listener: EventListenerOrEventListenerObject,
      ) => {
        if (typeof listener === "function") {
          mediaListeners.add(listener as (event: MediaQueryListEvent) => void);
        }
      },
      removeEventListener: (
        _type: string,
        listener: EventListenerOrEventListenerObject,
      ) => {
        if (typeof listener === "function") {
          mediaListeners.delete(listener as (event: MediaQueryListEvent) => void);
        }
      },
      dispatchEvent: vi.fn(() => true),
    })),
  });
};

const emitSystemTheme = (matches: boolean): void => {
  mediaMatches = matches;
  act(() => {
    for (const listener of mediaListeners) {
      listener({ matches } as MediaQueryListEvent);
    }
  });
};

function ThemeProbe() {
  const { theme, preference, setPreference } = useTheme();
  return (
    <div>
      <output aria-label="현재 테마">{theme}</output>
      <output aria-label="테마 설정">{preference}</output>
      <button
        type="button"
        onClick={() => setPreference(theme === "dark" ? "light" : "dark")}
      >
        테마 전환
      </button>
      <button type="button" onClick={() => setPreference("system")}>
        시스템 설정 사용
      </button>
    </div>
  );
}

const renderTheme = () =>
  render(
    <ThemeProvider>
      <ThemeProbe />
    </ThemeProvider>,
  );

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.classList.remove("dark");
  document.documentElement.style.colorScheme = "";
  installMatchMedia(false);
});

afterEach(() => {
  document.documentElement.classList.remove("dark");
  document.documentElement.style.colorScheme = "";
});

describe("ThemeProvider", () => {
  it("저장된 dark 설정을 시스템 light보다 우선해 root에 적용한다", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
    renderTheme();

    expect(screen.getByRole("status", { name: "현재 테마" })).toHaveTextContent("dark");
    expect(document.documentElement).toHaveClass("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });

  it("저장 설정이 없으면 시스템 테마 변경을 즉시 따른다", () => {
    installMatchMedia(true);
    renderTheme();
    expect(document.documentElement).toHaveClass("dark");

    emitSystemTheme(false);
    expect(screen.getByRole("status", { name: "현재 테마" })).toHaveTextContent("light");
    expect(document.documentElement).not.toHaveClass("dark");
  });

  it("사용자 전환을 즉시 적용하고 versioned key에 저장한다", () => {
    renderTheme();
    fireEvent.click(screen.getByRole("button", { name: "테마 전환" }));

    expect(document.documentElement).toHaveClass("dark");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });

  it("시스템 설정을 선택하면 현재 OS 색상을 적용하고 system 값을 저장한다", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "light");
    installMatchMedia(true);
    renderTheme();
    expect(document.documentElement).not.toHaveClass("dark");

    fireEvent.click(screen.getByRole("button", { name: "시스템 설정 사용" }));

    expect(screen.getByRole("status", { name: "테마 설정" })).toHaveTextContent("system");
    expect(document.documentElement).toHaveClass("dark");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("system");
  });

  it("다른 탭에서 설정이 바뀌면 storage event를 반영한다", () => {
    renderTheme();
    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: THEME_STORAGE_KEY,
          newValue: "dark",
        }),
      );
    });

    expect(document.documentElement).toHaveClass("dark");
    expect(screen.getByRole("status", { name: "현재 테마" })).toHaveTextContent("dark");
  });
});
