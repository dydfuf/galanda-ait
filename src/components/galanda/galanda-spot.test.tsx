// @vitest-environment jsdom
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";

import { GalandaSpot, type GalandaSpotName } from "./galanda-spot.tsx";

const names: readonly GalandaSpotName[] = [
  "empty-trips", "create-trip", "empty-saved",
  "invite-companions", "compare-plans", "confirm-plan",
  "empty-explore", "empty-search",
];
const assetPath = (name: GalandaSpotName) =>
  join(process.cwd(), `public/assets/galanda/spots-3d/${name}.webp`);

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  document.documentElement.classList.remove("dark");
});

describe("GalandaSpot display contract", () => {
  it.each(names)("reserves 128px and keeps %s decorative", (name) => {
    const { container, queryByRole } = render(<GalandaSpot name={name} />);
    const wrapper = container.querySelector('[data-slot="galanda-spot"]');
    expect(wrapper).toHaveAttribute("aria-hidden", "true");
    expect(wrapper).toHaveAttribute("data-spot", name);
    expect(wrapper).toHaveClass("size-32", "shrink-0");
    const images = container.querySelectorAll("img");
    expect(images).toHaveLength(1);
    expect(images[0]).toHaveAttribute("src", `${import.meta.env.BASE_URL}assets/galanda/spots-3d/${name}.webp`);
    expect(images[0]).toHaveAttribute("alt", "");
    expect(images[0]).toHaveAttribute("width", "128");
    expect(images[0]).toHaveAttribute("height", "128");
    expect(images[0]).toHaveAttribute("decoding", "async");
    expect(images[0]).toHaveClass("block", "size-32", "object-contain");
    expect(queryByRole("img")).not.toBeInTheDocument();
    expect(queryByRole("button")).not.toBeInTheDocument();
  });

  it("uses the same transparent render across theme changes without filters or duplicate requests", () => {
    const { container, rerender } = render(<GalandaSpot name="empty-trips" />);
    const image = container.querySelector("img");
    const src = image?.getAttribute("src");
    document.documentElement.classList.add("dark");
    rerender(<GalandaSpot name="empty-trips" />);
    expect(container.querySelectorAll("img")).toHaveLength(1);
    expect(container.querySelector("img")).toBe(image);
    expect(image).toHaveAttribute("src", src);
    expect(image?.className).not.toMatch(/brightness|drop-shadow|dark:/);
  });

  it.each(["empty-trips", "empty-explore", "empty-search"] as const)("preserves Vite's non-root asset base for %s", (name) => {
    vi.stubEnv("BASE_URL", "/preview/");
    const { container } = render(<GalandaSpot name={name} />);
    expect(container.querySelector("img")).toHaveAttribute("src", `/preview/assets/galanda/spots-3d/${name}.webp`);
  });
});

describe("Blender render delivery contract", () => {
  it.each(names)("ships %s as a static 384px alpha WebP within its size budget", (name) => {
    const image = readFileSync(assetPath(name));
    expect(image.toString("ascii", 0, 4)).toBe("RIFF");
    expect(image.toString("ascii", 8, 12)).toBe("WEBP");
    expect(image.readUInt32LE(4) + 8).toBe(image.length);
    // Extended WebP header: alpha flag, no animation, fixed canvas dimensions.
    expect(image.toString("ascii", 12, 16)).toBe("VP8X");
    expect(image[20]! & 0x10).toBe(0x10);
    expect(image[20]! & 0x02).toBe(0);
    expect(image.readUIntLE(24, 3) + 1).toBe(384);
    expect(image.readUIntLE(27, 3) + 1).toBe(384);
    expect(image.length).toBeLessThan(80_000);
  });

  it("keeps the complete illustration set under 400KB", () => {
    expect(names.reduce((total, name) => total + statSync(assetPath(name)).size, 0)).toBeLessThan(400_000);
  });

  it("includes WebP in offline precaching", () => {
    const config = readFileSync(join(process.cwd(), "vite.config.ts"), "utf8");
    expect(config).toMatch(/globPatterns:.*webp/);
  });
});
