import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const srcRoot = path.join(projectRoot, "src");
const indexCssPath = path.join(srcRoot, "index.css");
const packageJsonPath = path.join(projectRoot, "package.json");

const sourceExtensions = new Set([".css", ".ts", ".tsx"]);
const testFilePattern = /\.(?:test|spec)\.[cm]?[jt]sx?$/;

interface SourceFile {
  readonly absolutePath: string;
  readonly relativePath: string;
  readonly source: string;
}

interface PackageJson {
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly devDependencies?: Readonly<Record<string, string>>;
  readonly optionalDependencies?: Readonly<Record<string, string>>;
  readonly peerDependencies?: Readonly<Record<string, string>>;
}

function collectSourceFiles(directory: string): SourceFile[] {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const absolutePath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        return collectSourceFiles(absolutePath);
      }

      if (!entry.isFile() || !sourceExtensions.has(path.extname(entry.name))) {
        return [];
      }

      const relativePath = path
        .relative(projectRoot, absolutePath)
        .split(path.sep)
        .join("/");
      return [
        {
          absolutePath,
          relativePath,
          source: readFileSync(absolutePath, "utf8"),
        },
      ];
    })
    .sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function extractCssBlock(source: string, marker: string): string {
  const markerIndex = source.indexOf(marker);
  if (markerIndex === -1) {
    throw new Error(`CSS marker not found: ${marker}`);
  }

  const openingBraceIndex = source.indexOf("{", markerIndex + marker.length);
  if (openingBraceIndex === -1) {
    throw new Error(`Opening brace not found after CSS marker: ${marker}`);
  }

  let depth = 0;
  for (let index = openingBraceIndex; index < source.length; index += 1) {
    if (source[index] === "{") {
      depth += 1;
    } else if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(openingBraceIndex + 1, index);
      }
    }
  }

  throw new Error(`Closing brace not found after CSS marker: ${marker}`);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function declarationPattern(property: string, valuePattern = "[^;{}]+") {
  return new RegExp(`${escapeRegExp(property)}\\s*:\\s*${valuePattern}\\s*;`);
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

function lineNumberAt(source: string, index: number): number {
  return source.slice(0, index).split("\n").length;
}

function moduleSpecifiers(file: SourceFile): readonly string[] {
  if (!/\.[cm]?[jt]sx?$/.test(file.absolutePath)) {
    return [];
  }

  const source = stripComments(file.source);
  const specifiers = new Set<string>();
  const moduleReferencePattern =
    /\b(?:from|import\s*\(|require\s*\()\s*["']([^"']+)["']/g;
  const sideEffectImportPattern = /^\s*import\s*["']([^"']+)["']/gm;

  for (const match of source.matchAll(moduleReferencePattern)) {
    specifiers.add(match[1]);
  }
  for (const match of source.matchAll(sideEffectImportPattern)) {
    specifiers.add(match[1]);
  }

  return [...specifiers];
}

const allSourceFiles = collectSourceFiles(srcRoot);
const productionSourceFiles = allSourceFiles.filter(
  ({ relativePath }) => !testFilePattern.test(relativePath),
);
const indexCss = readFileSync(indexCssPath, "utf8");
const packageJson = JSON.parse(
  readFileSync(packageJsonPath, "utf8"),
) as PackageJson;

const moduleUses = productionSourceFiles.flatMap((file) =>
  moduleSpecifiers(file).map((specifier) => ({
    file: file.relativePath,
    specifier,
  })),
);

const requiredRootTokens = [
  "--background",
  "--surface-content",
  "--surface-raised",
  "--surface-chrome",
  "--surface-chrome-opaque",
  "--surface-chrome-glass",
  "--surface-overlay",
  "--surface-overlay-opaque",
  "--surface-overlay-glass",
  "--border-chrome",
  "--border-overlay",
  "--elevation-chrome",
  "--elevation-overlay",
  "--blur-chrome",
  "--blur-overlay",
  "--saturation-chrome",
  "--chrome-backdrop-filter",
  "--overlay-backdrop-filter",
  "--motion-duration-instant",
  "--motion-duration-fast",
  "--motion-duration-standard",
  "--motion-duration-overlay",
  "--motion-ease-standard",
  "--motion-ease-decelerate",
  "--touch-target-min",
  "--content-max-width",
] as const;

const requiredThemeAliases = {
  "--color-surface-content": "--surface-content",
  "--color-surface-raised": "--surface-raised",
  "--color-surface-chrome": "--surface-chrome",
  "--color-surface-chrome-opaque": "--surface-chrome-opaque",
  "--color-surface-overlay": "--surface-overlay",
  "--color-surface-overlay-opaque": "--surface-overlay-opaque",
  "--color-border-chrome": "--border-chrome",
  "--color-border-overlay": "--border-overlay",
  "--shadow-chrome": "--elevation-chrome",
  "--shadow-overlay": "--elevation-overlay",
  "--blur-galanda-chrome": "--blur-chrome",
  "--blur-galanda-overlay": "--blur-overlay",
  "--ease-standard": "--motion-ease-standard",
  "--ease-decelerate": "--motion-ease-decelerate",
  "--spacing-touch-target": "--touch-target-min",
  "--container-content": "--content-max-width",
  "--default-transition-duration": "--motion-duration-standard",
  "--default-transition-timing-function": "--motion-ease-standard",
} as const;

const allowedBackdropSourceFiles = new Set([
  "src/components/galanda/bottom-action.tsx",
  "src/components/galanda/page-header.tsx",
  "src/components/ui/alert-dialog.tsx",
  "src/components/ui/drawer.tsx",
  "src/components/ui/sonner.tsx",
]);

const approvedUiRuntimeDependencies = [
  "@base-ui/react",
  "@emotion/react",
  "@tailwindcss/vite",
  "class-variance-authority",
  "clsx",
  "lucide-react",
  "shadcn",
  "sonner",
  "tailwind-merge",
  "tailwindcss",
  "tw-animate-css",
] as const;

function isUiOrRuntimeAssetDependency(name: string): boolean {
  return (
    /^(?:@base-ui|@chakra-ui|@emotion|@fontsource|@fortawesome|@headlessui|@heroicons|@iconify|@mantine|@mui|@radix-ui|@tailwindcss)\//.test(
      name,
    ) ||
    /^@toss\/tds(?:-|\/|$)/.test(name) ||
    /^(?:antd|bootstrap|class-variance-authority|clsx|daisyui|flowbite|framer-motion|lottie-react|lucide-react|material-ui|motion|react-icons|shadcn|sonner|styled-components|tailwind-merge|tailwindcss|three|tw-animate-css)$/.test(
      name,
    )
  );
}

describe("UI refresh foundation source contract", () => {
  it("defines the required semantic tokens and Tailwind aliases", () => {
    const rootBlock = extractCssBlock(indexCss, ":root");
    const themeBlock = extractCssBlock(indexCss, "@theme inline");

    for (const token of requiredRootTokens) {
      expect(rootBlock, `Missing root semantic token ${token}`).toMatch(
        declarationPattern(token),
      );
    }

    for (const [alias, token] of Object.entries(requiredThemeAliases)) {
      expect(
        themeBlock,
        `Missing @theme inline alias ${alias} -> ${token}`,
      ).toMatch(declarationPattern(alias, `var\\(${escapeRegExp(token)}\\)`));
    }
  });

  it("keeps root background and glass surfaces opaque before progressive enhancement", () => {
    const rootBlock = extractCssBlock(indexCss, ":root");
    const supportsBlock = extractCssBlock(indexCss, "@supports");

    expect(
      productionSourceFiles.map(({ source }) => source).join("\n"),
    ).not.toContain("--adaptiveBackground");
    expect(indexCss).toMatch(
      /html,\s*body,\s*#root\s*\{[^}]*background-color:\s*var\(--background\)\s*;/s,
    );

    expect(rootBlock).toMatch(
      declarationPattern(
        "--surface-chrome",
        "var\\(--surface-chrome-opaque\\)",
      ),
    );
    expect(rootBlock).toMatch(
      declarationPattern(
        "--surface-overlay",
        "var\\(--surface-overlay-opaque\\)",
      ),
    );
    expect(rootBlock).toMatch(
      declarationPattern("--chrome-backdrop-filter", "none"),
    );
    expect(rootBlock).toMatch(
      declarationPattern("--overlay-backdrop-filter", "none"),
    );

    expect(indexCss).toMatch(
      /@supports\s*\(backdrop-filter:\s*blur\(1px\)\)\s*or\s*\(-webkit-backdrop-filter:\s*blur\(1px\)\)/,
    );
    expect(indexCss.indexOf("@supports")).toBeGreaterThan(
      indexCss.indexOf(":root"),
    );
    expect(supportsBlock).toMatch(
      declarationPattern("--surface-chrome", "var\\(--surface-chrome-glass\\)"),
    );
    expect(supportsBlock).toMatch(
      declarationPattern(
        "--surface-overlay",
        "var\\(--surface-overlay-glass\\)",
      ),
    );
    expect(supportsBlock).toMatch(
      declarationPattern(
        "--chrome-backdrop-filter",
        "blur\\(var\\(--blur-chrome\\)\\)\\s+saturate\\(var\\(--saturation-chrome\\)\\)",
      ),
    );
    expect(supportsBlock).toMatch(
      declarationPattern(
        "--overlay-backdrop-filter",
        "blur\\(var\\(--blur-overlay\\)\\)\\s+saturate\\(var\\(--saturation-chrome\\)\\)",
      ),
    );
  });

  it("provides a reduced-motion override without removing static state presentation", () => {
    const reducedMotionBlock = extractCssBlock(
      indexCss,
      "@media (prefers-reduced-motion: reduce)",
    );

    for (const token of [
      "--motion-duration-fast",
      "--motion-duration-standard",
      "--motion-duration-overlay",
    ]) {
      expect(
        reducedMotionBlock,
        `Missing reduced-motion override for ${token}`,
      ).toMatch(
        declarationPattern(token, "var\\(--motion-duration-instant\\)"),
      );
    }

    expect(reducedMotionBlock).toMatch(
      /scroll-behavior:\s*auto\s*!important\s*;/,
    );
    expect(reducedMotionBlock).toMatch(
      declarationPattern(
        "animation-duration",
        "var\\(--motion-duration-instant\\)\\s*!important",
      ),
    );
    expect(reducedMotionBlock).toMatch(
      declarationPattern(
        "transition-duration",
        "var\\(--motion-duration-instant\\)\\s*!important",
      ),
    );
    expect(reducedMotionBlock).toMatch(
      /\[data-slot="spinner"\],\s*\.animate-spin\s*\{[^}]*animation:\s*none\s*!important/s,
    );
    expect(reducedMotionBlock).toMatch(
      /\[data-slot="spinner"\],\s*\.animate-spin\s*\{[^}]*transform:\s*none\s*!important/s,
    );
  });

  it("caps every source-owned UI duration at 300ms", () => {
    const violations: string[] = [];

    for (const file of productionSourceFiles) {
      const source = stripComments(file.source);

      for (const match of source.matchAll(/(\d*\.?\d+)(ms|s)\b/g)) {
        const milliseconds = Number(match[1]) * (match[2] === "s" ? 1_000 : 1);
        if (milliseconds > 300) {
          violations.push(
            `${file.relativePath}:${lineNumberAt(source, match.index)} (${match[0]} = ${milliseconds}ms)`,
          );
        }
      }

      for (const match of source.matchAll(/(?:^|[^\w-])duration-(\d+)\b/g)) {
        const milliseconds = Number(match[1]);
        if (milliseconds > 300) {
          violations.push(
            `${file.relativePath}:${lineNumberAt(source, match.index)} (duration-${match[1]})`,
          );
        }
      }
    }

    expect(
      violations,
      `UI durations above 300ms:\n${violations.join("\n")}`,
    ).toEqual([]);
  });
});

describe("UI refresh architecture source contract", () => {
  it("limits backdrop filters to the global chrome/overlay selectors and owned components", () => {
    const rawBackdropDeclaration = /^\s*(?:-webkit-)?backdrop-filter\s*:/gm;
    const chromeBlock = extractCssBlock(
      indexCss,
      '[data-galanda-surface="chrome"]',
    );
    const overlayBlock = extractCssBlock(
      indexCss,
      '[data-galanda-surface="overlay"]',
    );

    expect(chromeBlock.match(rawBackdropDeclaration)).toHaveLength(2);
    expect(overlayBlock.match(rawBackdropDeclaration)).toHaveLength(2);
    expect(indexCss.match(rawBackdropDeclaration)).toHaveLength(4);

    const sourceViolations = productionSourceFiles
      .filter(({ relativePath }) => relativePath !== "src/index.css")
      .filter(({ source }) => {
        const withoutComments = stripComments(source);
        return (
          /\b(?:supports-)?backdrop-blur(?:-[^\s"'`]*)?/.test(
            withoutComments,
          ) ||
          /\bsupports-backdrop-filter\b/.test(withoutComments) ||
          /(?<![-\w])(?:-webkit-)?backdrop-filter\s*:/.test(withoutComments)
        );
      })
      .map(({ relativePath }) => relativePath)
      .filter((relativePath) => !allowedBackdropSourceFiles.has(relativePath));

    expect(
      sourceViolations,
      `Backdrop filter escaped Common Chrome/UI Overlay boundaries:\n${sourceViolations.join("\n")}`,
    ).toEqual([]);
  });

  it("keeps Base UI and Apps in Toss SDK imports behind their owned boundaries", () => {
    const baseUiViolations = moduleUses
      .filter(
        ({ specifier }) =>
          specifier === "@base-ui/react" ||
          specifier.startsWith("@base-ui/react/"),
      )
      .filter(({ file }) => !file.startsWith("src/components/ui/"));
    const appsInTossViolations = moduleUses
      .filter(({ specifier }) => specifier.startsWith("@apps-in-toss/"))
      .filter(({ file }) => !file.startsWith("src/platform/ait/"));

    expect(
      baseUiViolations,
      "Base UI imports must stay in src/components/ui",
    ).toEqual([]);
    expect(
      appsInTossViolations,
      "Apps in Toss SDK imports must stay in src/platform/ait",
    ).toEqual([]);
  });

  it("keeps TDS imports and dependencies out of the UI foundation", () => {
    const tdsImports = moduleUses.filter(({ specifier }) =>
      /^@toss\/tds(?:-|\/|$)/.test(specifier),
    );
    const dependencySections = [
      packageJson.dependencies ?? {},
      packageJson.devDependencies ?? {},
      packageJson.optionalDependencies ?? {},
      packageJson.peerDependencies ?? {},
    ];
    const tdsDependencies = dependencySections
      .flatMap((dependencies) => Object.keys(dependencies))
      .filter((name) => /^@toss\/tds(?:-|\/|$)/.test(name));

    expect(tdsImports).toEqual([]);
    expect(tdsDependencies).toEqual([]);
  });

  it("uses only the approved UI runtime stack and no third-party runtime assets", () => {
    const runtimeDependencies = packageJson.dependencies ?? {};
    const uiRuntimeDependencies = Object.keys(runtimeDependencies)
      .filter(isUiOrRuntimeAssetDependency)
      .sort();

    expect(uiRuntimeDependencies).toEqual(
      [...approvedUiRuntimeDependencies].sort(),
    );

    const remoteAssetPattern =
      /(?:@import\s+(?:url\(\s*)?["']?\s*(?:https?:)?\/\/|url\(\s*["']?\s*(?:https?:)?\/\/|<(?:img|link|script|source)\b[^>]*(?:src|href)\s*=\s*["'`]\s*(?:https?:)?\/\/)/i;
    const uiImplementationFiles = productionSourceFiles.filter(
      ({ relativePath }) =>
        relativePath === "src/index.css" ||
        relativePath.startsWith("src/app/") ||
        relativePath.startsWith("src/components/") ||
        relativePath.startsWith("src/features/"),
    );
    const remoteAssetViolations = uiImplementationFiles
      .filter(({ source }) => remoteAssetPattern.test(stripComments(source)))
      .map(({ relativePath }) => relativePath);

    expect(
      remoteAssetViolations,
      `Third-party runtime asset requests found:\n${remoteAssetViolations.join("\n")}`,
    ).toEqual([]);
  });
});
