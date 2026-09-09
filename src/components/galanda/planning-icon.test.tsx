// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PlanningIcon, type PlanningIconName } from "./planning-icon.tsx";

const names = ["calendar", "route", "stay", "ticket"] as const satisfies readonly PlanningIconName[];

const shapes = (svg: Element) =>
  Array.from(svg.children, (shape) => ({
    tag: shape.localName,
    attributes: Object.fromEntries(
      Array.from(shape.attributes, (attribute) => [attribute.name, attribute.value]),
    ),
  }));

describe("PlanningIcon", () => {
  // 별도로 보관하는 디자인 원본과 앱 렌더러의 drift를 잡는다.
  it.each(names)("%s의 형상과 색상 계약이 원본 SVG와 일치한다", (name) => {
    const source = new DOMParser().parseFromString(
      readFileSync(resolve("public/assets/galanda/planning", `${name}-outline.svg`), "utf8"),
      "image/svg+xml",
    ).documentElement;
    const { container } = render(<PlanningIcon name={name} />);
    const actual = container.querySelector("svg")!;

    expect(source.localName).toBe("svg");
    expect(shapes(actual)).toEqual(shapes(source));
    for (const attribute of [
      "width", "height", "viewBox", "fill", "stroke",
      "stroke-width", "stroke-linecap", "stroke-linejoin",
    ]) {
      expect(actual.getAttribute(attribute)).toBe(source.getAttribute(attribute));
    }
  });

  it("아이콘이 링크의 한글 이름을 중복하거나 별도 포커스 대상을 만들지 않는다", () => {
    render(
      <a href="#booking">
        <PlanningIcon name="ticket" size={20} />
        예약 정보 보기
      </a>,
    );

    const link = screen.getByRole("link", { name: "예약 정보 보기" });
    const icon = link.querySelector("svg");
    expect(icon).toHaveAttribute("aria-hidden", "true");
    expect(icon).toHaveAttribute("focusable", "false");
    expect(icon).not.toHaveAttribute("tabindex");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
