// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";

import { GalandaSpot, type GalandaSpotName } from "./galanda-spot.tsx";

const refreshed = ["empty-trips", "create-trip", "empty-saved"] as const;
const legacy = ["invite-companions", "compare-plans", "confirm-plan"] as const;
const names: readonly GalandaSpotName[] = [...refreshed, ...legacy];
const themes = ["light", "dark"] as const;
const readSvg = (name: GalandaSpotName, theme: (typeof themes)[number]) =>
  readFileSync(join(process.cwd(), `public/assets/galanda/spots/${name}-${theme}.svg`), "utf8");
const parseSvg = (source: string) => new DOMParser().parseFromString(source, "image/svg+xml");

// Palette changes must not move the illustration when the app theme switches.
const geometry = (source: string) =>
  Array.from(parseSvg(source).querySelectorAll("*")).map((node) => ({
    tag: node.tagName,
    attrs: Array.from(node.attributes)
      .filter(({ name }) => !["fill", "stroke", "stop-color"].includes(name))
      .map(({ name, value }) => [name, value]),
  }));

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe("GalandaSpot display contract", () => {
  it.each(names)("reserves 128px and keeps %s decorative in both themes", (name) => {
    const { container, queryByRole } = render(<GalandaSpot name={name} />);
    const wrapper = container.querySelector('[data-slot="galanda-spot"]');
    expect(wrapper).toHaveAttribute("aria-hidden", "true");
    expect(wrapper).toHaveAttribute("data-spot", name);
    expect(wrapper).toHaveClass("size-32", "shrink-0");
    const images = container.querySelectorAll("img");
    expect(images).toHaveLength(2);
    for (const [index, theme] of themes.entries()) {
      const image = images[index];
      expect(image).toHaveAttribute("src", `${import.meta.env.BASE_URL}assets/galanda/spots/${name}-${theme}.svg`);
      expect(image).toHaveAttribute("alt", "");
      expect(image).toHaveAttribute("width", "128");
      expect(image).toHaveAttribute("height", "128");
      expect(readSvg(name, theme)).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    }
    expect(images[0]).toHaveClass("block", "dark:hidden");
    expect(images[1]).toHaveClass("hidden", "dark:block");
    expect(queryByRole("img")).not.toBeInTheDocument();
    expect(queryByRole("button")).not.toBeInTheDocument();
  });

  it.each(refreshed)("uses %s's own dark palette without an extra brightness filter", (name) => {
    const { container } = render(<GalandaSpot name={name} />);
    expect(container.querySelector('img[src$="-dark.svg"]')).not.toHaveClass("brightness-125");
  });

  it.each(legacy)("preserves the existing contrast treatment of %s", (name) => {
    const { container } = render(<GalandaSpot name={name} />);
    expect(container.querySelector('img[src$="-dark.svg"]')).toHaveClass("brightness-125");
  });

  it("preserves Vite's non-root asset base", () => {
    vi.stubEnv("BASE_URL", "/preview/");
    const { container } = render(<GalandaSpot name="empty-trips" />);
    expect(container.querySelector("img")).toHaveAttribute("src", "/preview/assets/galanda/spots/empty-trips-light.svg");
  });
});

describe("Home spot SVG sources", () => {
  it.each(refreshed)("keeps %s geometry identical across palettes", (name) => {
    const light = readSvg(name, "light");
    const dark = readSvg(name, "dark");
    expect(light).not.toBe(dark);
    expect(geometry(light)).toEqual(geometry(dark));
  });

  it.each(refreshed.flatMap((name) => themes.map((theme) => ({ name, theme }))))(
    "keeps $name/$theme self-contained, static, and within the source size budget",
    ({ name, theme }) => {
      const source = readSvg(name, theme);
      const document = parseSvg(source);
      expect(document.querySelector("parsererror")).toBeNull();
      const root = document.documentElement;
      expect(root.tagName).toBe("svg");
      expect(root.getAttribute("viewBox")).toBe("0 0 240 240");
      expect(root.getAttribute("width")).toBe("240");
      expect(root.getAttribute("height")).toBe("240");
      expect(new TextEncoder().encode(source).length).toBeLessThan(4000);
      expect(root.querySelectorAll("linearGradient").length).toBeGreaterThan(0);
      expect(root.querySelector("script, style, image, foreignObject, filter, text, animate, animateTransform, set")).toBeNull();
      const ids = Array.from(root.querySelectorAll("[id]")).map((node) => node.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const node of [root, ...root.querySelectorAll("*")]) {
        for (const attribute of node.attributes) {
          expect(attribute.name).not.toMatch(/^(on|href|xlink:href|style)/i);
          if (attribute.value.includes("url(")) {
            const local = attribute.value.match(/^url\(#([a-z-]+)\)$/);
            expect(local).not.toBeNull();
            expect(ids).toContain(local?.[1]);
          }
        }
      }
    },
  );
});
