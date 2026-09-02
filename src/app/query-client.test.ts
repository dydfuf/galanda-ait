import { describe, expect, it } from "vitest";
import { queryClient } from "./query-client.ts";

describe("query client mutation policy", () => {
  it("runs mutations immediately so the API guard can reject offline writes", () => {
    expect(queryClient.getDefaultOptions().mutations).toMatchObject({
      networkMode: "always",
      retry: false,
    });
  });
});
