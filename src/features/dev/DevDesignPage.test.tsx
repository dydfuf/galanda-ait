// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "@/app/theme-provider.tsx";
import { DevDesignPage } from "./DevDesignPage.tsx";

function renderPage(entry = "/dev") {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <ThemeProvider>
        <DevDesignPage />
      </ThemeProvider>
    </MemoryRouter>,
  );
}

describe("DevDesignPage", () => {
  it("카탈로그 footer를 위자드로 교체하고 돌아올 때 측정값을 정리한다", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "고정 CTA 미리보기 켜기" }));
    fireEvent.click(screen.getByRole("link", { name: "위자드 단독 미리보기" }));

    expect(document.querySelectorAll('[data-slot="bottom-action"]')).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "저장" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다음" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    expect(screen.getByText("이벤트: next")).toBeInTheDocument();
    expect(screen.getByText("아직 저장되지 않음")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: "카탈로그로 돌아가기" }));
    expect(document.querySelectorAll('[data-slot="bottom-action"]')).toHaveLength(0);
    expect(document.documentElement.style.getPropertyValue("--app-bottom-action-height")).toBe("");
  });

  it("날짜 오류와 저장 실패를 독립된 상태로 직접 재현한다", () => {
    renderPage("/dev?preview=wizard&scenario=invalid-date&draft=ERROR");
    expect(screen.getByText("임시 저장하지 못했어요")).toBeInTheDocument();
    expect(screen.getByText("출발일은 도착일 이후여야 합니다.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다음" })).toBeDisabled();
    fireEvent.change(screen.getByRole("combobox", { name: "화면 상태" }), { target: { value: "offline" } });
    expect(screen.getByRole("button", { name: "다음" })).toBeEnabled();
    expect(screen.getByText("임시 저장하지 못했어요")).toBeInTheDocument();
    expect(screen.getByText(/오프라인 상태에서는 저장할 수 없습니다/)).toBeInTheDocument();
  });
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
