// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../hooks/useSession.ts", () => ({
  useSessionQuery: vi.fn(),
}));

import { THEME_STORAGE_KEY, ThemeProvider } from "../../app/theme-provider.tsx";
import { useSessionQuery } from "../../hooks/useSession.ts";
import { MePage } from "./MePage.tsx";

const mockSession = vi.mocked(useSessionQuery);

const renderPage = () =>
  render(
    <ThemeProvider>
      <MemoryRouter>
        <MePage />
      </MemoryRouter>
    </ThemeProvider>,
  );

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.classList.remove("dark");
  document.documentElement.style.colorScheme = "";
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn((query: string): MediaQueryList => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(() => true),
    })),
  });
  mockSession.mockReturnValue({
    data: {
      participantId: "participant-me",
      participantIds: ["participant-me"],
      accountType: "REGISTERED",
      name: "Raon",
      isAuthenticated: true,
    },
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useSessionQuery>);
});

describe("MePage theme setting", () => {
  it("화면 설정 메뉴 행을 누르면 색상 선택 바텀시트를 연다", async () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "마이" })).toBeInTheDocument();
    expect(screen.getByText("Raon님으로 이용 중이에요.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "저장한 여행 일정" })).toHaveAttribute(
      "href",
      "/me/saved",
    );

    const settingsMenu = screen.getByRole("button", { name: /화면 설정/ });
    expect(within(settingsMenu).getByText("시스템")).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: "색상 선택" })).not.toBeInTheDocument();

    fireEvent.click(settingsMenu);

    const sheet = await screen.findByRole("dialog", { name: "화면 설정" });
    expect(
      within(sheet).getByText("앱 화면에 사용할 색상을 선택하세요."),
    ).toBeInTheDocument();
    expect(within(sheet).getByRole("radiogroup", { name: "색상 선택" })).toBeInTheDocument();
    expect(within(sheet).getByRole("radio", { name: "시스템" })).toBeChecked();
    expect(within(sheet).getByRole("radio", { name: "라이트" })).not.toBeChecked();
    expect(within(sheet).getByRole("radio", { name: "다크" })).not.toBeChecked();
  });

  it("다크 색상을 선택하면 적용·저장하고 메뉴의 현재 값을 갱신한다", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /화면 설정/ }));
    const sheet = await screen.findByRole("dialog", { name: "화면 설정" });

    fireEvent.click(within(sheet).getByRole("radio", { name: "다크" }));

    expect(document.documentElement).toHaveClass("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "화면 설정" })).not.toBeInTheDocument();
    });

    const settingsMenu = screen.getByRole("button", { name: /화면 설정/ });
    expect(within(settingsMenu).getByText("다크")).toBeInTheDocument();

    fireEvent.click(settingsMenu);
    const reopenedSheet = await screen.findByRole("dialog", { name: "화면 설정" });
    expect(within(reopenedSheet).getByRole("radio", { name: "다크" })).toBeChecked();
  });
});
