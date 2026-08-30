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

describe("MePage", () => {
  it("세션을 불러오는 동안 loading 상태를 유지한다", () => {
    mockSession.mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
      error: null,
      refetch: vi.fn<() => void>(),
    } as unknown as ReturnType<typeof useSessionQuery>);

    renderPage();

    expect(screen.getByText("내 정보를 불러오는 중이에요.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "마이" })).not.toBeInTheDocument();
  });

  it("세션 조회 오류를 보여주고 다시 시도한다", () => {
    const refetch = vi.fn<() => void>();
    mockSession.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      error: new Error("session failed"),
      refetch,
    } as unknown as ReturnType<typeof useSessionQuery>);

    renderPage();

    expect(screen.getByText("내 정보를 확인할 수 없어요")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("실제 세션 프로필과 grouped menu를 보여주고 화면 설정을 연다", async () => {
    renderPage();

    expect(screen.getByRole("heading", { level: 1, name: "마이" })).toBeInTheDocument();

    const profile = screen.getByRole("region", { name: "내 프로필" });
    expect(profile.firstElementChild).toHaveClass("bg-primary-muted");
    expect(within(profile).getByRole("heading", { level: 2, name: "Raon" })).toBeInTheDocument();
    expect(within(profile).getByText("R")).toHaveAttribute("aria-hidden", "true");

    const menu = screen.getByRole("navigation", { name: "마이 메뉴" });
    expect(within(menu).getByRole("link", { name: "저장한 여행 일정" })).toHaveAttribute(
      "href",
      "/me/saved",
    );

    const settingsMenu = within(menu).getByRole("button", { name: /화면 설정/ });
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
