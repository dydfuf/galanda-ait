import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const dirs: string[] = [];
const fixture = (contents: string) => {
  const dir = mkdtempSync(join(tmpdir(), "galanda-config-test-"));
  dirs.push(dir);
  const path = join(dir, "fixture.vars");
  writeFileSync(path, contents, { mode: 0o600 });
  return path;
};
afterEach(() => dirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })));

describe("local/release configuration boundaries", () => {
  it("refuses a remote local-dev database without echoing credentials", () => {
    const path = fixture('DATABASE_URL="postgresql://private-user:sensitive-sentinel@remote.invalid/db"\nBETTER_AUTH_SECRET="synthetic-secret-long-enough-for-tests"');
    const result = spawnSync("bash", ["scripts/dev-local.sh"], {
      env: { ...process.env, GALANDA_DEV_ENV_FILE: path }, encoding: "utf8",
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("loopback");
    expect(result.stderr + result.stdout).not.toContain("sensitive-sentinel");
  });

  it("validates explicit staging secret metadata offline", () => {
    const path = fixture('BETTER_AUTH_SECRET="synthetic-secret-long-enough-for-tests"\nKAKAO_CLIENT_ID="synthetic-client"');
    const result = spawnSync(process.execPath, ["scripts/check-release-env.mjs", "staging", path], { encoding: "utf8" });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Offline release configuration passed");
    expect(result.stdout + result.stderr).not.toContain("synthetic-secret");
  });

  it("does not present an unconfigured production target as ready", () => {
    const result = spawnSync(process.execPath, ["scripts/check-release-env.mjs", "production", fixture("")], { encoding: "utf8" });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("not configured");
  });
});
