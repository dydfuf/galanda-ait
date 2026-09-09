// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ICON_CATALOG } from "@/components/galanda/icons/catalog.ts";
const setPreference = vi.fn();
vi.mock("@/app/theme-provider.tsx", () => ({ useTheme: () => ({ preference: "system", setPreference }) }));
import { DevIconsPage } from "./DevIconsPage.tsx";

describe("DevIconsPage", () => {
  it("finds Korean names and exports both bookmark variants", () => {
    render(<DevIconsPage />);
    const list = screen.getByRole("list", { name: "아이콘 목록" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(Object.keys(ICON_CATALOG).length);
    fireEvent.change(screen.getByRole("textbox", { name: "아이콘 검색" }), { target: { value: "숙소" } });
    expect(within(list).getAllByRole("listitem")).toHaveLength(1);
    expect(within(list).getByRole("link", { name: "숙소 outline SVG" })).toHaveAttribute("href", "/assets/galanda/planning/stay-outline.svg");
    fireEvent.change(screen.getByRole("textbox", { name: "아이콘 검색" }), { target: { value: "bookmark" } });
    expect(within(list).getAllByRole("link")).toHaveLength(2);
  });
  it("filters categories, changes size, and uses the existing theme provider", () => {
    render(<DevIconsPage />);
    fireEvent.change(screen.getByRole("combobox", { name: "분류" }), { target: { value: "preferences" } });
    const list = screen.getByRole("list", { name: "아이콘 목록" });
    expect(within(list).queryByRole("heading", { name: "숙소" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "16px" }));
    expect(list.querySelector("svg")).toHaveAttribute("width", "16");
    fireEvent.click(screen.getByRole("button", { name: "다크" }));
    expect(setPreference).toHaveBeenCalledWith("dark");
    fireEvent.change(screen.getByRole("textbox", { name: "아이콘 검색" }), { target: { value: "없는아이콘" } });
    expect(screen.getByText("조건에 맞는 아이콘이 없습니다.")).toBeInTheDocument();
  });
});
