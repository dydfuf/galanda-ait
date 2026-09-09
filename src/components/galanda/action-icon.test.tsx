// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ActionIcon, type ActionIconName } from "./action-icon.tsx";

const names = ["create-trip", "companions", "invite", "complete"] as const satisfies readonly ActionIconName[];

const shapes = (svg: Element) =>
  Array.from(svg.children, (shape) => ({
    tag: shape.localName,
    attributes: Object.fromEntries(
      Array.from(shape.attributes, (attribute) => [attribute.name, attribute.value]),
    ),
  }));

describe("ActionIcon", () => {
  // 디자인 원본과 앱 렌더러의 drift를 잡으며 형상을 테스트에 복사하지 않는다.
  it.each(names)("%s의 형상과 색상 계약이 원본 SVG와 일치한다", (name) => {
    const source = new DOMParser().parseFromString(
      readFileSync(resolve("public/assets/galanda/actions", `${name}-outline.svg`), "utf8"),
      "image/svg+xml",
    ).documentElement;
    const { container } = render(<ActionIcon name={name} />);
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

  it("생성 링크의 한글 이름과 목적지를 그대로 노출한다", () => {
    render(
      <a href="/trips/new">
        <ActionIcon name="create-trip" size={20} />
        새 여행 만들기
      </a>,
    );

    expect(screen.getByRole("link", { name: "새 여행 만들기" })).toHaveAttribute(
      "href", "/trips/new",
    );
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
