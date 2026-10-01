import { execFileSync } from "node:child_process";
import type { Plugin } from "vite";

export interface BuildIdentity {
  readonly commit: string | null;
  readonly state: "clean" | "dirty" | "unknown";
}

export function readBuildIdentity(root: string): BuildIdentity {
  const git = (...args: string[]) =>
    execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();

  try {
    // An unpacked project inside another checkout must not inherit its identity.
    if (git("rev-parse", "--show-prefix") !== "") {
      return { commit: null, state: "unknown" };
    }
    const commit = git("rev-parse", "--verify", "HEAD");
    if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(commit)) {
      return { commit: null, state: "unknown" };
    }
    const dirty = git("status", "--porcelain=v1", "--untracked-files=normal");
    return { commit, state: dirty ? "dirty" : "clean" };
  } catch {
    // Source archives and hosts without Git cannot claim an exact commit.
    return { commit: null, state: "unknown" };
  }
}

export function buildIdentityPlugin(root: string): Plugin {
  return {
    name: "galanda-build-identity",
    apply: "build",
    transformIndexHtml() {
      const identity = readBuildIdentity(root);
      return [
        {
          tag: "meta",
          attrs: { name: "galanda-build-commit", content: identity.commit ?? "unknown" },
          injectTo: "head",
        },
        {
          tag: "meta",
          attrs: { name: "galanda-build-state", content: identity.state },
          injectTo: "head",
        },
      ];
    },
  };
}
