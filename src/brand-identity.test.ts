import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const file = (path: string) => readFileSync(join(process.cwd(), path));
const text = (path: string) => file(path).toString("utf8");

const pngDimensions = (path: string) => {
  const source = file(path);
  expect(source.subarray(0, 8)).toEqual(
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  );
  expect(source.subarray(12, 16).toString("ascii")).toBe("IHDR");
  return {
    width: source.readUInt32BE(16),
    height: source.readUInt32BE(20),
  };
};

const sha256 = (path: string) =>
  createHash("sha256").update(file(path)).digest("hex");

describe("갈라고 brand identity", () => {
  it("uses 갈라고 consistently in user-facing Web/PWA metadata", () => {
    const html = text("index.html");
    const vite = text("vite.config.ts");

    expect(html).toContain('<meta name="application-name" content="갈라고" />');
    expect(html).toContain(
      '<meta name="apple-mobile-web-app-title" content="갈라고" />',
    );
    expect(html).toContain(
      "<title>갈라고 - 친구들과 함께하는 여행 일정 조율</title>",
    );
    expect(html).toContain('<meta name="theme-color" content="#3182F6" />');
    expect(html).not.toContain("갈란다");

    expect(vite).toContain("const BRAND_DISPLAY_NAME = '갈라고'");
    expect(vite).toContain(
      "const BRAND_DESCRIPTION = '갈라고 - 친구들과 함께하는 여행 일정 조율'",
    );
    expect(vite).toContain("const BRAND_PRIMARY_COLOR = '#3182F6'");
    expect(vite).not.toContain("갈란다");
  });

  it("keeps deployed galanda identifiers stable while sharing the brand primary", () => {
    const ait = text("apps-in-toss.config.ts");
    const html = text("index.html");

    expect(ait).toContain("appName: 'galanda'");
    expect(ait).toContain("primaryColor: '#3182F6'");
    expect(html).toContain('localStorage.getItem("galanda_theme_v1")');
  });

  it("keeps the master SVG mark flat, static, and theme-independent", () => {
    const mark = text("public/assets/galanda/brand/mark.svg");
    const appIcon = text("public/assets/galanda/brand/app-icon.svg");
    const favicon = text("public/favicon.svg");

    for (const source of [mark, appIcon, favicon]) {
      expect(source).toContain('viewBox="0 0 512 512"');
      expect(source).not.toMatch(
        /<(?:filter|linearGradient|radialGradient|image|script|animate|animateTransform|foreignObject)\b/,
      );
      expect(source).not.toMatch(/\b(?:href|xlink:href|style|on[a-z]+)=/i);
    }

    expect(mark).toContain("#3182F6");
    expect(appIcon).toContain('<rect width="512" height="512" fill="#3182F6"/>');
    expect(appIcon).toContain('stroke="white" stroke-width="48"');
    expect(favicon).toContain('width="48" height="48"');
    expect(favicon).toContain('rx="112" fill="#3182F6"');
  });

  it.each([
    ["public/pwa/icon-192.png", 192, "686d445bd37380525c6e2217445147667dded5f2ed71756f70815b6fb048c01b"],
    ["public/pwa/icon-512.png", 512, "4093ca4dbf1ae53b907cb8425a75629b268c908e07ef0697fe256646ac21c931"],
    ["public/pwa/icon-maskable-512.png", 512, "4093ca4dbf1ae53b907cb8425a75629b268c908e07ef0697fe256646ac21c931"],
    ["public/pwa/apple-touch-icon.png", 180, "9c46c4f4740c26b5b23d4df7bdf198b196bda674ddae4e841a376819315f655c"],
  ] as const)("keeps %s at the approved size and visual snapshot", (path, size, digest) => {
    expect(pngDimensions(path)).toEqual({ width: size, height: size });
    expect(sha256(path)).toBe(digest);
  });
});
