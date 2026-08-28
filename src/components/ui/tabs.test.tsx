// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Tabs, TabsList, TabsTrigger } from "./tabs.tsx";

describe("Tabs", () => {
  it("keeps default filter tabs opaque without opting into chrome tokens", () => {
    render(
      <Tabs defaultValue="ongoing">
        <TabsList aria-label="여행 목록 필터">
          <TabsTrigger value="ongoing">진행 중인 여행</TabsTrigger>
          <TabsTrigger value="past">지난 여행</TabsTrigger>
        </TabsList>
      </Tabs>,
    );

    const tabList = screen.getByRole("tablist", { name: "여행 목록 필터" });
    expect(tabList).toHaveAttribute("data-variant", "default");
    expect(tabList).not.toHaveAttribute("data-galanda-surface");
    expect(tabList.className).toContain("bg-muted");
  });

  it("opts only the chrome variant into the common chrome surface", () => {
    render(
      <Tabs defaultValue="plans">
        <TabsList variant="chrome" aria-label="여행방 화면">
          <TabsTrigger value="plans">계획</TabsTrigger>
          <TabsTrigger value="itinerary">일정</TabsTrigger>
        </TabsList>
      </Tabs>,
    );

    const tabList = screen.getByRole("tablist", { name: "여행방 화면" });
    expect(tabList).toHaveAttribute("data-variant", "chrome");
    expect(tabList).toHaveAttribute("data-galanda-surface", "chrome");
    expect(tabList.className).not.toContain("bg-muted");
    expect(screen.getByRole("tab", { name: "계획" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "일정" })).toHaveAttribute("aria-selected", "false");
  });

  it("provides a 44px target and lets long labels reflow", () => {
    render(
      <Tabs defaultValue="long">
        <TabsList aria-label="긴 탭">
          <TabsTrigger value="long">공백 없이아주긴여행방탭이름</TabsTrigger>
        </TabsList>
      </Tabs>,
    );

    const tab = screen.getByRole("tab", { name: "공백 없이아주긴여행방탭이름" });
    expect(tab.className).toContain("min-h-(--touch-target-min)");
    expect(tab.className).toContain("min-w-0");
    expect(tab.className).toContain("whitespace-normal");
    expect(tab.className).toContain("[overflow-wrap:anywhere]");
  });
});
