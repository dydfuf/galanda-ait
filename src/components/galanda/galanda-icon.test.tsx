// @vitest-environment jsdom
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ICON_CATALOG } from "./icons/catalog.ts";
import { GalandaIcon, type GalandaIconSelection } from "./galanda-icon.tsx";

const cases = Object.entries(ICON_CATALOG).flatMap(([name, entry]) =>
  Object.entries(entry.variants).map(([variant, path]) => ({ name, variant, path })),
);
const attributes = (element: Element) => Object.fromEntries(
  Array.from(element.attributes, (attribute) => [attribute.name, attribute.value]),
);
const shapes = (svg: Element) => Array.from(svg.children, (shape) => ({ tag: shape.localName, attrs: attributes(shape) }));

describe("Galanda icon source contract", () => {
  it("committed renderer and catalogue are generated from the current SVG sources", () => {
    expect(execFileSync(process.execPath, [resolve("scripts/generate-icons.mjs"), "--check"], { encoding: "utf8" })).toContain("Verified");
  });

  it.each(cases)("$name/$variant matches its original SVG and stays decorative", ({ name, variant, path }) => {
    const source = new DOMParser().parseFromString(readFileSync(resolve("public", `.${path}`), "utf8"), "image/svg+xml").documentElement;
    const selection = { name, variant } as GalandaIconSelection;
    const { container } = render(<GalandaIcon {...selection} />);
    const actual = container.querySelector("svg")!;
    expect(source.localName).toBe("svg");
    expect(shapes(actual)).toEqual(shapes(source));
    for (const [attribute, value] of Object.entries(attributes(source))) expect(actual.getAttribute(attribute)).toBe(value);
    expect(actual).toHaveAttribute("aria-hidden", "true");
    expect(actual).toHaveAttribute("focusable", "false");
    expect(actual).not.toHaveAttribute("tabindex");
    expect(actual.querySelector("image, script, foreignObject, filter, title")).toBeNull();
  });

  it.each([16, 20, 24] as const)("keeps explicit %spx sizing inside buttons", (size) => {
    render(<button type="button" disabled aria-label="검색"><GalandaIcon name="search" size={size} /></button>);
    const button = screen.getByRole("button", { name: "검색" });
    const svg = button.querySelector("svg");
    expect(button).toBeDisabled();
    expect(svg).toHaveAttribute("width", String(size));
    expect(svg).toHaveAttribute("height", String(size));
    expect(svg).toHaveClass({ 16: "size-4", 20: "size-5", 24: "size-6" }[size]);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("retains semantic classes and currentColor when the surrounding theme changes", () => {
    const { container, rerender } = render(<div><GalandaIcon name="bell" className="text-primary" /></div>);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("stroke", "currentColor");
    rerender(<div className="dark"><GalandaIcon name="bell" className="text-primary" /></div>);
    expect(container.querySelector("svg")).toBe(svg);
    expect(svg).toHaveClass("text-primary");
    expect(svg).not.toHaveAttribute("style");
  });
});
