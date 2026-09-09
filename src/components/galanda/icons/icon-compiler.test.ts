import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const root = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">';
const parseInNode = (body: string): boolean => JSON.parse(execFileSync(process.execPath, [
  "--input-type=module", "-e",
  `import { readFileSync } from 'node:fs';
   import { parseSvg } from './scripts/generate-icons.mjs';
   try { parseSvg(readFileSync(0, 'utf8')); console.log('true'); }
   catch { console.log('false'); }`,
], { input: `${root}${body}</svg>`, encoding: "utf8" })) as boolean;

describe("static icon compiler", () => {
  it("accepts flat geometry", () => {
    expect(parseInNode('<path d="M3 12h18"/>')).toBe(true);
  });
  it.each([
    '<script/>', '<image href="https://example.invalid/a.svg"/>',
    '<path d="M3 12h18" onclick="run()"/>', '<path d="M3 12h18" stroke="#000000"/>',
    '<path d="M3 12h18" stroke-width="3"/>', '<path d="M3 12h18" fill="url(#paint)"/>',
    '<g><path d="M3 12h18"/></g>', '<path d="M3 12h18" d="M0 0"/>',
  ])("rejects unsupported SVG rather than silently dropping it: %s", (body) => {
    expect(parseInNode(body)).toBe(false);
  });
});
