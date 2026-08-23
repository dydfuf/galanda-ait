import { describe, expect, it } from "vitest";
import { safeReturnTo } from "./auth.ts";

describe("safeReturnTo", () => {
  it("keeps internal paths and rejects external redirects", () => {
    expect(safeReturnTo("/invites/token?from=login")).toBe("/invites/token?from=login");
    expect(safeReturnTo("https://evil.example")).toBe("/trips");
    expect(safeReturnTo("//evil.example")).toBe("/trips");
    expect(safeReturnTo("/\\evil.example")).toBe("/trips");
  });
});
