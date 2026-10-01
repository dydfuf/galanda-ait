import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type ObservabilityConfig = {
  logs?: { invocation_logs?: boolean };
  traces?: { enabled?: boolean };
};

type WranglerConfig = {
  version_metadata?: { binding: string };
  observability?: ObservabilityConfig;
  env?: { staging?: { observability?: ObservabilityConfig; version_metadata?: { binding: string } } };
};

const config = JSON.parse(
  readFileSync("wrangler.jsonc", "utf8")
) as WranglerConfig;

describe("Wrangler observability config", () => {
  it("binds platform version metadata in default and staging environments", () => {
    expect(config.version_metadata?.binding).toBe("CF_VERSION_METADATA");
    expect(config.env?.staging?.version_metadata?.binding).toBe("CF_VERSION_METADATA");
  });
  it("disables URL-bearing invocation logs and automatic traces", () => {
    for (const observability of [
      config.observability,
      config.env?.staging?.observability,
    ]) {
      expect(observability?.logs?.invocation_logs).toBe(false);
      expect(observability?.traces?.enabled).toBe(false);
    }
  });
});
