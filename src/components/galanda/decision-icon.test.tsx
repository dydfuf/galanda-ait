// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DecisionIcon } from "./decision-icon.tsx";

const cases = [
  { name: "compare", variant: "outline" },
  { name: "bookmark", variant: "outline" },
  { name: "bookmark", variant: "filled" },
  { name: "import-plan", variant: "outline" },
  { name: "share", variant: "outline" },
] as const;

const shapes = (svg: Element) =>
  Array.from(svg.children, (shape) => ({
    tag: shape.localName,
    attributes: Object.fromEntries(
      Array.from(shape.attributes, (attribute) => [attribute.name, attribute.value]),
    ),
  }));

describe("DecisionIcon", () => {
  // 형상을 복사한 fixture가 아니라 승인된 SVG 파일과 실제 렌더러를 비교한다.
  it.each(cases)("$name/$variant의 형상과 색상이 원본 SVG와 일치한다", (icon) => {
    const source = new DOMParser().parseFromString(
      readFileSync(resolve("public/assets/galanda/decision", `${icon.name}-${icon.variant}.svg`), "utf8"),
      "image/svg+xml",
    ).documentElement;
    const { container } = render(<DecisionIcon {...icon} />);
    const actual = container.querySelector("svg")!;

    expect(source.localName).toBe("svg");
    expect(shapes(actual)).toEqual(shapes(source));
    for (const attribute of [
      "width", "height", "viewBox", "fill", "stroke",
      "stroke-width", "stroke-linecap", "stroke-linejoin",
    ]) {
      expect(actual.getAttribute(attribute)).toBe(source.getAttribute(attribute));
    }
    expect(actual).toHaveAttribute("aria-hidden", "true");
    expect(actual).toHaveAttribute("focusable", "false");
    expect(actual).not.toHaveAttribute("tabindex");
  });

  it("공유 아이콘이 아이콘 전용 버튼의 한글 이름이나 포커스를 중복하지 않는다", () => {
    render(
      <button type="button" aria-label="여행 초대 링크 공유">
        <DecisionIcon name="share" size={20} />
      </button>,
    );

    expect(screen.getByRole("button", { name: "여행 초대 링크 공유" })).toBeEnabled();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
