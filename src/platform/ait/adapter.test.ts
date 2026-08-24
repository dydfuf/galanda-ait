import { describe, expect, it } from "vitest";
import { toContentTopInset } from "./adapter.ts";

describe("Apps in Toss content inset", () => {
  it("uses a fallback only when the initial host inset is unavailable", () => {
    expect(toContentTopInset(54, 40)).toBe(54);
    expect(toContentTopInset(0, 54)).toBe(54);
    expect(toContentTopInset(Number.NaN, 54)).toBe(54);
    expect(toContentTopInset(0)).toBe(0);
  });
});
