// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "@/app/theme-provider.tsx";
import { DevDesignPage } from "./DevDesignPage.tsx";

function renderPage() {
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <DevDesignPage />
      </ThemeProvider>
    </MemoryRouter>,
  );
}

describe("DevDesignPage", () => {
  it("카탈로그 목차와 핵심 섹션을 렌더한다", () => {
    renderPage();

    expect(
      screen.getByRole("navigation", { name: "디자인 카탈로그 목차" }),
    ).toBeInTheDocument();
    for (const section of [
      "tokens",
      "typography",
      "buttons",
      "badges",
      "forms",
      "selection",
      "lists",
      "feedback",
      "overlays",
      "shell",
    ]) {
      expect(document.getElementById(section)).not.toBeNull();
    }
  });

  it("주요 primitive와 shell 미리보기를 보여준다", () => {
    renderPage();

    // Buttons
    expect(screen.getByRole("button", { name: "XL · 주요 CTA" })).toBeInTheDocument();
    // Badges
    expect(screen.getByText("확정안")).toBeInTheDocument();
    // Forms
    expect(screen.getByLabelText("여행 제목")).toBeInTheDocument();
    expect(screen.getByText("닉네임은 2자 이상 입력해 주세요.")).toBeInTheDocument();
    // Selection
    expect(screen.getByRole("tab", { name: "여행안" })).toBeInTheDocument();
    // Feedback
    expect(screen.getByText("여행 정보를 불러오는 중이에요.")).toBeInTheDocument();
    // Overlays
    expect(screen.getByRole("button", { name: "여행안 삭제 열기" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bottom sheet 열기" })).toBeInTheDocument();
    // Shell & patterns
    expect(
      screen.getAllByRole("navigation", { name: "여행 만들기 진행 단계" }),
    ).toHaveLength(3);
    expect(screen.getByRole("button", { name: "고정 CTA 미리보기 켜기" })).toBeInTheDocument();
  });

  it("DEV 안내 문구를 보여준다", () => {
    renderPage();

    expect(screen.getByText("DEV")).toBeInTheDocument();
    expect(
      screen.getByText(/프로덕션 빌드에는 포함되지 않아요/),
    ).toBeInTheDocument();
  });
});
