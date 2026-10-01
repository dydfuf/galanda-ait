import * as childProcess from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { build } from "vite";
import { buildIdentityPlugin, readBuildIdentity } from "../scripts/build-identity.ts";

vi.mock("node:child_process", { spy: true });

describe("public frontend build identity", () => {
  let root: string;
  const git = (...args: string[]) =>
    childProcess.execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "galanda-build-identity-"));
    git("init");
    writeFileSync(join(root, "index.html"), "<!doctype html><html><head></head><body></body></html>");
    writeFileSync(join(root, ".gitignore"), "dist\n.dev.vars\n");
    git("add", ".");
    git("-c", "user.name=Build test", "-c", "user.email=build@example.invalid", "-c", "commit.gpgsign=false", "commit", "-m", "fixture");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(root, { recursive: true, force: true });
  });

  it("identifies the checked-out commit without publishing ignored configuration", () => {
    writeFileSync(join(root, ".dev.vars"), "SYNTHETIC_SECRET=not-public");
    expect(readBuildIdentity(root)).toEqual({ commit: git("rev-parse", "HEAD"), state: "clean" });
  });

  it.each(["tracked", "staged", "untracked"])("marks %s changes as dirty instead of claiming an exact source tree", (kind) => {
    writeFileSync(join(root, kind === "untracked" ? "new-file.ts" : "index.html"), "changed");
    if (kind === "staged") git("add", "index.html");
    expect(readBuildIdentity(root)).toEqual({ commit: git("rev-parse", "HEAD"), state: "dirty" });
  });

  it("explicitly reports unknown when Git metadata is absent", () => {
    rmSync(join(root, ".git"), { recursive: true });
    expect(readBuildIdentity(root)).toEqual({ commit: null, state: "unknown" });
  });

  it("does not mistake an enclosing repository for the project's source", () => {
    const nested = join(root, "archive");
    mkdirSync(nested);
    expect(readBuildIdentity(nested)).toEqual({ commit: null, state: "unknown" });
  });

  it("rejects non-SHA identity output instead of injecting it into HTML", () => {
    vi.mocked(childProcess.execFileSync)
      .mockReturnValueOnce("")
      .mockReturnValueOnce('"><script>alert(1)</script>');
    expect(readBuildIdentity(root)).toEqual({ commit: null, state: "unknown" });
  });

  it.each(["production", "ait"])("embeds only the allowlisted identity in %s HTML", async (mode) => {
    writeFileSync(join(root, ".dev.vars"), "SYNTHETIC_SECRET=not-public");
    await build({
      root,
      mode,
      configFile: false,
      logLevel: "silent",
      plugins: [buildIdentityPlugin(root)],
    });
    const html = readFileSync(join(root, "dist/index.html"), "utf8");
    expect(html).toContain(`<meta name="galanda-build-commit" content="${git("rev-parse", "HEAD")}">`);
    expect(html).toContain('<meta name="galanda-build-state" content="clean">');
    expect(html).not.toContain("not-public");
    expect(html).not.toContain(root);
    expect(readBuildIdentity(root).state).toBe("clean");
  });
});
