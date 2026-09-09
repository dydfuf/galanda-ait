// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { GlobalAppShell } from "./global-app-shell.tsx";
import { Button } from "@/components/ui/button.tsx";

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <GlobalAppShell>
        <div>child content</div>
      </GlobalAppShell>
    </MemoryRouter>,
  );

describe("GlobalAppShell (RAON-248)", () => {
  it("4개 목적지를 native link로 logical order로 렌더링하고 children을 보여준다", () => {
    renderAt("/home");

    const nav = screen.getByRole("navigation", { name: "주요 화면" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      "/home",
      "/explore",
      "/trips",
      "/me",
    ]);
    expect(links.map((a) => a.textContent)).toEqual(["홈", "탐색", "내 여행", "마이"]);
    expect(screen.getByText("child content")).toBeVisible();
  });

  it("active 목적지를 semantic aria-current=page로 표시한다(색만으로 구분하지 않음)", () => {
    renderAt("/explore");
    const nav = screen.getByRole("navigation", { name: "주요 화면" });
    const current = within(nav)
      .getAllByRole("link")
      .filter((a) => a.getAttribute("aria-current") === "page");
    expect(current).toHaveLength(1);
    expect(current[0]!.getAttribute("href")).toBe("/explore");
  });

  it("/me/saved 에서는 '마이'가 active다", () => {
    renderAt("/me/saved");
    const nav = screen.getByRole("navigation", { name: "주요 화면" });
    const current = within(nav)
      .getAllByRole("link")
      .filter((a) => a.getAttribute("aria-current") === "page");
    expect(current).toHaveLength(1);
    expect(current[0]!.getAttribute("href")).toBe("/me");
  });

  it.each([
    ["/home", "홈"],
    ["/explore", "탐색"],
    ["/trips", "내 여행"],
    ["/me", "마이"],
    ["/me/saved", "마이"],
  ])("%s에서는 %s 아이콘만 채우고 나머지는 라인으로 표시한다", (path, label) => {
    renderAt(path);
    const nav = screen.getByRole("navigation", { name: "주요 화면" });
    const selected = within(nav).getByRole("link", { name: label });

    expect(selected).toHaveAttribute("aria-current", "page");
    for (const link of within(nav).getAllByRole("link")) {
      expect(link.querySelector("svg")).toHaveAttribute(
        "fill",
        link === selected ? "currentColor" : "none",
      );
    }
  });

  it("탭 이동 시 이전 아이콘은 라인으로 돌아가고 새 목적지만 채운다", () => {
    renderAt("/home");
    const nav = screen.getByRole("navigation", { name: "주요 화면" });

    for (const label of ["탐색", "내 여행", "마이", "홈"]) {
      const selected = within(nav).getByRole("link", { name: label });
      fireEvent.click(selected);

      expect(selected).toHaveAttribute("aria-current", "page");
      for (const link of within(nav).getAllByRole("link")) {
        expect(link.querySelector("svg")).toHaveAttribute(
          "fill",
          link === selected ? "currentColor" : "none",
        );
        if (link !== selected) {
          expect(link).not.toHaveAttribute("aria-current");
        }
      }
    }
  });

  it("nav는 정확히 하나의 landmark label을 가지고 icon은 aria-hidden이며 link accessible name이 노출된다", () => {
    renderAt("/home");
    const nav = screen.getByRole("navigation", { name: "주요 화면" });
    const icons = nav.querySelectorAll("svg");
    expect(icons).toHaveLength(4);
    for (const icon of icons) {
      expect(icon).toHaveAttribute("aria-hidden", "true");
      expect(icon).toHaveAttribute("focusable", "false");
      expect(icon).toHaveAttribute("viewBox", "0 0 24 24");
    }
    expect(within(nav).getByRole("link", { name: "홈" })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "탐색" })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "내 여행" })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "마이" })).toBeInTheDocument();
  });

  it("각 link는 44px hit target과 focus-visible ring을 유지한다", () => {
    renderAt("/home");
    const nav = screen.getByRole("navigation", { name: "주요 화면" });
    for (const link of within(nav).getAllByRole("link")) {
      expect(link.className).toContain("min-h-(--touch-target-min)");
      expect(link.className).toContain("focus-visible:outline-ring");
    }
  });

  it("Global 목적지가 아니어도(shell을 그리는 route가 아님) active가 없다", () => {
    renderAt("/login");
    const nav = screen.getByRole("navigation", { name: "주요 화면" });
    const current = within(nav)
      .getAllByRole("link")
      .filter((a) => a.getAttribute("aria-current") === "page");
    expect(current).toHaveLength(0);
    for (const icon of nav.querySelectorAll("svg")) {
      expect(icon).toHaveAttribute("fill", "none");
    }
  });

  it.each(["/trips", "/trips/"])(
    "%s 목록에서는 상단 wrapper와 bottom nav가 content surface를 공유한다",
    (path) => {
      const { container } = renderAt(path);
      const shell = container.querySelector<HTMLElement>(
        '[data-slot="global-app-shell"]',
      );
      const nav = screen.getByRole("navigation", { name: "주요 화면" });

      expect(shell?.firstElementChild).toHaveAttribute(
        "data-galanda-surface",
        "content",
      );
      expect(nav).toHaveAttribute("data-galanda-surface", "content");
    },
  );

  it.each(["/home", "/explore", "/me", "/me/saved"])(
    "%s에서는 기존 bottom chrome surface를 유지한다",
    (path) => {
      const { container } = renderAt(path);
      const shell = container.querySelector<HTMLElement>(
        '[data-slot="global-app-shell"]',
      );
      const nav = screen.getByRole("navigation", { name: "주요 화면" });

      expect(shell?.firstElementChild).not.toHaveAttribute(
        "data-galanda-surface",
      );
      expect(nav).toHaveAttribute("data-galanda-surface", "chrome");
    },
  );

  it("본문 행동과 별개로 nav 높이와 safe-area를 한 번만 확보한다", () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/home"]}>
        <GlobalAppShell>
          <main>
            <Button>새 여행 만들기</Button>
          </main>
        </GlobalAppShell>
      </MemoryRouter>,
    );

    const shell = container.querySelector<HTMLElement>(
      '[data-slot="global-app-shell"]',
    );
    const nav = screen.getByRole("navigation", { name: "주요 화면" });

    expect(shell).toHaveStyle({
      "--global-nav-height": "calc(64px + var(--safe-bottom))",
    });
    expect(shell?.firstElementChild?.className).toContain(
      "pb-[var(--global-nav-height)]",
    );
    expect(screen.getByRole("main")).toContainElement(
      screen.getByRole("button", { name: "새 여행 만들기" }),
    );
    expect(nav).toHaveAttribute("data-galanda-surface", "chrome");
    expect(nav.className).toContain("fixed");
    expect(nav.className).toContain("inset-x-0");
    expect(nav.className).toContain("bottom-0");
    expect(nav.className).not.toContain("shadow-chrome");
    expect(nav.className).not.toContain("border-t");
    expect(nav.className).toContain("pb-[var(--safe-bottom)]");
    expect(nav.className).not.toContain("pointer-events-none");
    const navList = nav.querySelector("ul");
    expect(navList?.className).toContain("h-16");
    expect(navList?.className).toContain("w-full");
    expect(navList?.className).toContain("max-w-(--content-max-width)");
    expect(navList?.className).not.toContain("mb-2");
    expect(navList?.className).not.toContain("rounded-[28px]");
  });
});
