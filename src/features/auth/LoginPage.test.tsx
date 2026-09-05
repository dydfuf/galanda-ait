// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPlatform } = vi.hoisted(() => ({
  mockPlatform: {
    name: "web" as "web" | "ait",
    signIn: vi.fn<(returnTo: string) => Promise<void>>(),
  },
}));

vi.mock("@/platform/index.ts", () => ({
  platform: mockPlatform,
}));

import { LoginPage } from "./LoginPage.tsx";

const deferred = <T,>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

const renderPage = (initialEntry = "/login", viewportWidth?: number) =>
  render(
    <div
      data-testid="viewport"
      style={viewportWidth ? { width: `${viewportWidth}px` } : undefined}
    >
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </MemoryRouter>
    </div>,
  );

beforeEach(() => {
  mockPlatform.name = "web";
  mockPlatform.signIn.mockReset();
});

describe("LoginPage entry flow", () => {
  it.each([
    ["web", "카카오로 계속하기"],
    ["ait", "토스로 계속하기"],
  ] as const)("%s 플랫폼의 sign-in label을 accessible name으로 제공한다", (name, label) => {
    mockPlatform.name = name;
    mockPlatform.signIn.mockResolvedValue(undefined);

    renderPage();

    expect(screen.getByRole("heading", { level: 1, name: "함께 갈 여행을 결정해요" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    const steps = screen.getByRole("list", { name: "갈란다에서 여행을 결정하는 방법" });
    expect(steps).toHaveTextContent(/비교.*의견.*확정/);
    expect(steps.compareDocumentPosition(screen.getByRole("button", { name: label })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("sign-in pending 동안 중복 제출을 막고 resolve 전후에 허위 성공 상태를 만들지 않는다", async () => {
    const signIn = deferred<void>();
    mockPlatform.signIn.mockReturnValue(signIn.promise);
    renderPage("/login?returnTo=%2Ftrips%2Ftrip-1");

    const button = screen.getByRole("button", { name: "카카오로 계속하기" });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(mockPlatform.signIn).toHaveBeenCalledTimes(1);
    expect(mockPlatform.signIn).toHaveBeenCalledWith("/trips/trip-1");
    expect(screen.getByRole("button", { name: "연결 중…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "연결 중…" })).toHaveAttribute(
      "aria-busy",
      "true",
    );

    await act(async () => {
      signIn.resolve(undefined);
      await signIn.promise;
    });

    expect(screen.getByRole("button", { name: "연결 중…" })).toBeDisabled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText(/로그인되었습니다|완료되었습니다/)).not.toBeInTheDocument();
  });

  it("sign-in 실패를 alert로 알리고 같은 action을 다시 사용할 수 있게 한다", async () => {
    mockPlatform.signIn.mockRejectedValue(new Error("provider unavailable"));
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "카카오로 계속하기" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "로그인을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "카카오로 계속하기" })).toBeEnabled(),
    );
    expect(screen.getByRole("button", { name: "카카오로 계속하기" })).toHaveAttribute(
      "aria-busy",
      "false",
    );
  });

  it("320px upgrade 화면에서 긴 제목을 보존하고 heading 다음에 primary action을 둔다", () => {
    mockPlatform.signIn.mockResolvedValue(undefined);
    renderPage("/login?reason=upgrade&returnTo=%2Ftrips%2Ftrip-1%2Fplans", 320);

    const heading = screen.getByRole("heading", {
      level: 1,
      name: "계정을 연결해 여행을 만들어 보세요",
    });
    const button = screen.getByRole("button", { name: "카카오로 계속하기" });

    expect(screen.getByTestId("viewport")).toHaveStyle({ width: "320px" });
    expect(heading).toHaveClass("min-w-0", "[overflow-wrap:anywhere]");
    expect(screen.getByText("이메일 없이 소셜 계정으로 간편하게 연결할 수 있어요.")).toBeInTheDocument();
    expect(
      heading.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
