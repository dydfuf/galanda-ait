import { readFileSync } from "node:fs";
import path from "node:path";
import { ts } from "ts-morph";
import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();

type ContractFileRole = "view" | "contract" | "presenter" | "pattern";

interface ScopedFile {
  readonly file: string;
  readonly role: ContractFileRole;
}

const scopedFiles: ReadonlyArray<ScopedFile> = [
  { file: "src/features/plan-editor/components/FirstPlanWizardView.tsx", role: "view" },
  { file: "src/features/plan-editor/first-plan-wizard.contract.ts", role: "contract" },
  { file: "src/features/plan-editor/first-plan-wizard.presenter.ts", role: "presenter" },
  { file: "src/components/galanda/wizard-step-page.tsx", role: "pattern" },
  { file: "src/components/galanda/wizard-recipes.ts", role: "pattern" },
];

interface SourceInput {
  readonly file: string;
  readonly source: string;
  readonly role?: ContractFileRole;
}

interface Violation {
  readonly location: string;
  readonly rule: string;
  readonly replacement: string;
}

interface ModuleReference {
  readonly specifier: string;
  readonly index: number;
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

function lineAt(source: string, index: number): number {
  return source.slice(0, index).split("\n").length;
}

function addViolation(
  violations: Violation[],
  file: string,
  source: string,
  rule: string,
  replacement: string,
  index: number,
): void {
  violations.push({
    location: `${file}:${lineAt(source, index)}`,
    rule,
    replacement,
  });
}

function createSourceFile(file: string, source: string): ts.SourceFile {
  return ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

function collectModuleReferences(sourceFile: ts.SourceFile): ReadonlyArray<ModuleReference> {
  const references: ModuleReference[] = [];

  const add = (specifier: ts.StringLiteralLike): void => {
    references.push({
      specifier: specifier.text,
      index: specifier.getStart(sourceFile),
    });
  };

  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteralLike(node.moduleSpecifier)) {
      add(node.moduleSpecifier);
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) {
      add(node.moduleSpecifier);
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      add(node.arguments[0]);
    } else if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "require" &&
      node.arguments[0] &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      add(node.arguments[0]);
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return references;
}

function normalizeModulePath(file: string, specifier: string): string {
  const normalizedFile = file.replaceAll("\\", "/");
  if (specifier.startsWith("@/")) return path.posix.normalize(specifier.slice(2));
  if (!specifier.startsWith(".")) return specifier;
  return path.posix.normalize(path.posix.join(path.posix.dirname(normalizedFile), specifier));
}

function findFirstNode(
  sourceFile: ts.SourceFile,
  predicate: (node: ts.Node) => boolean,
): ts.Node | undefined {
  let match: ts.Node | undefined;

  const visit = (node: ts.Node): void => {
    if (match) return;
    if (predicate(node)) {
      match = node;
      return;
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return match;
}

function indexOfNode(node: ts.Node | undefined, sourceFile: ts.SourceFile): number | undefined {
  return node?.getStart(sourceFile);
}

function isForbiddenHookName(name: string): boolean {
  return (
    name === "usePlanEditorState" ||
    name === "useQuery" ||
    name === "useMutation" ||
    name === "useQueryClient" ||
    /^use[A-Z][A-Za-z0-9]*(?:Queries?|Mutations?)$/.test(name)
  );
}

function getExpressionName(expression: ts.Expression): string | undefined {
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
  return undefined;
}

function importContainsForbiddenHook(node: ts.ImportDeclaration): boolean {
  const clause = node.importClause;
  if (!clause) return false;

  if (clause.name && isForbiddenHookName(clause.name.text)) return true;
  if (!clause.namedBindings || !ts.isNamedImports(clause.namedBindings)) return false;

  return clause.namedBindings.elements.some((element) =>
    isForbiddenHookName(element.name.text) ||
    (element.propertyName !== undefined && isForbiddenHookName(element.propertyName.text)),
  );
}

function findViewRuntimeBoundaryIndex(
  sourceFile: ts.SourceFile,
  references: ReadonlyArray<ModuleReference>,
): number | undefined {
  const candidates: number[] = [];

  for (const reference of references) {
    if (reference.specifier.startsWith("@tanstack/")) candidates.push(reference.index);
  }

  const importedHook = findFirstNode(
    sourceFile,
    (node) => ts.isImportDeclaration(node) && importContainsForbiddenHook(node),
  );
  const calledHook = findFirstNode(
    sourceFile,
    (node) => {
      if (!ts.isCallExpression(node)) return false;
      const name = getExpressionName(node.expression);
      return name !== undefined && isForbiddenHookName(name);
    },
  );
  const directBoundary = findFirstNode(
    sourceFile,
    (node) => {
      if (ts.isCallExpression(node)) {
        const name = getExpressionName(node.expression);
        if (name === "fetch" || name === "localStorage" || name === "sessionStorage") return true;
      }
      if (ts.isPropertyAccessExpression(node)) {
        return ["fetch", "localStorage", "sessionStorage"].includes(node.name.text);
      }
      return (
        ts.isIdentifier(node) &&
        ["localStorage", "sessionStorage"].includes(node.text) &&
        !(ts.isPropertyAccessExpression(node.parent) && node.parent.name === node)
      );
    },
  );

  for (const node of [importedHook, calledHook, directBoundary]) {
    const index = indexOfNode(node, sourceFile);
    if (index !== undefined) candidates.push(index);
  }

  return candidates.length > 0 ? Math.min(...candidates) : undefined;
}

function isPurityRestrictedModule(specifier: string): boolean {
  return (
    specifier === "react" ||
    specifier === "react-dom" ||
    specifier === "react-router-dom" ||
    specifier.startsWith("@tanstack/")
  );
}

function findPurityBoundaryIndex(
  sourceFile: ts.SourceFile,
  references: ReadonlyArray<ModuleReference>,
): number | undefined {
  const candidates = references
    .filter(({ specifier }) => isPurityRestrictedModule(specifier))
    .map(({ index }) => index);

  const directBoundary = findFirstNode(
    sourceFile,
    (node) => {
      if (ts.isCallExpression(node)) {
        const name = getExpressionName(node.expression);
        if (name === "fetch" || name === "useState" || name === "useQuery" || name === "useMutation") {
          return true;
        }
      }
      if (ts.isPropertyAccessExpression(node)) {
        if (["localStorage", "sessionStorage", "document", "window"].includes(node.expression.getText(sourceFile))) {
          return true;
        }
        return ["localStorage", "sessionStorage", "document", "window", "useState"].includes(node.name.text);
      }
      return (
        ts.isIdentifier(node) &&
        ["localStorage", "sessionStorage", "document", "window"].includes(node.text) &&
        !(ts.isPropertyAccessExpression(node.parent) && node.parent.name === node)
      );
    },
  );
  const directIndex = indexOfNode(directBoundary, sourceFile);
  if (directIndex !== undefined) candidates.push(directIndex);

  return candidates.length > 0 ? Math.min(...candidates) : undefined;
}

function isFeatureModule(file: string, specifier: string): boolean {
  return normalizeModulePath(file, specifier).split("/").includes("features");
}

const rawColorPattern = /(?:#[0-9a-f]{3,8}\b|rgba?\s*\(|hsla?\s*\()/i;

function isStyleContext(node: ts.Node, sourceFile: ts.SourceFile): boolean {
  let current: ts.Node | undefined = node.parent;

  while (current) {
    if (ts.isJsxAttribute(current)) {
      return ["className", "style", "color", "fill", "stroke"].includes(current.name.getText(sourceFile));
    }
    if (ts.isPropertyAssignment(current)) {
      const name = current.name.getText(sourceFile).replace(/["']/g, "");
      if (["className", "style", "color", "backgroundColor", "borderColor", "fill", "stroke"].includes(name)) {
        return true;
      }
    }
    if (ts.isVariableDeclaration(current) && ts.isIdentifier(current.name)) {
      if (/(?:color|className|style)$/i.test(current.name.text)) return true;
    }
    if (
      ts.isCallExpression(current) &&
      ts.isIdentifier(current.expression) &&
      ["cn", "cva", "clsx", "twMerge"].includes(current.expression.text)
    ) {
      return true;
    }
    current = current.parent;
  }

  return false;
}

function findRawColorNode(sourceFile: ts.SourceFile): ts.Node | undefined {
  return findFirstNode(
    sourceFile,
    (node) =>
      ts.isStringLiteralLike(node) &&
      rawColorPattern.test(node.text) &&
      isStyleContext(node, sourceFile),
  );
}

function inferRole(file: string): ContractFileRole | undefined {
  if (file.endsWith("FirstPlanWizardView.tsx")) return "view";
  if (file.endsWith("first-plan-wizard.contract.ts")) return "contract";
  if (file.endsWith("first-plan-wizard.presenter.ts")) return "presenter";
  if (file.includes("src/components/galanda/wizard-")) return "pattern";
  return undefined;
}

function findViolations({ file, source, role: explicitRole }: SourceInput): Violation[] {
  const clean = stripComments(source);
  const sourceFile = createSourceFile(file, source);
  const references = collectModuleReferences(sourceFile);
  const role = explicitRole ?? inferRole(file);
  const violations: Violation[] = [];

  if (role === "view" && !clean.includes("WizardStepPage")) {
    addViolation(
      violations,
      file,
      source,
      "migrated-view-pattern",
      "Render through WizardStepPage.",
      0,
    );
  }
  if (role === "view" && /(?:BottomAction|PageBody)\b/.test(clean)) {
    const index = clean.search(/(?:BottomAction|PageBody)\b/);
    addViolation(
      violations,
      file,
      source,
      "migrated-view-footer-bypass",
      "Use WizardStepPage; the pattern owns PageBody and BottomAction.",
      index,
    );
  }
  if (role === "view") {
    const index = findViewRuntimeBoundaryIndex(sourceFile, references);
    if (index !== undefined) {
      addViolation(
        violations,
        file,
        source,
        "migrated-view-runtime-boundary",
        "Pass a ViewModel and emit a typed event to the controller.",
        index,
      );
    }
  }
  if (role === "contract" || role === "presenter") {
    const index = findPurityBoundaryIndex(sourceFile, references);
    if (index !== undefined) {
      addViolation(
        violations,
        file,
        source,
        role === "contract" ? "contract-dependency-boundary" : "presenter-purity",
        "Keep the contract/presenter pure; pass a serializable snapshot.",
        index,
      );
    }
  }
  if (role === "pattern") {
    const dependency = references.find(({ specifier }) => isFeatureModule(file, specifier));
    if (dependency) {
      addViolation(
        violations,
        file,
        source,
        "pattern-feature-dependency",
        "Keep Galanda patterns feature-neutral.",
        dependency.index,
      );
    }
  }
  const rawColorNode = findRawColorNode(sourceFile);
  const rawColorIndex = indexOfNode(rawColorNode, sourceFile);
  if (rawColorIndex !== undefined) {
    addViolation(
      violations,
      file,
      source,
      "semantic-color-token",
      "Use a semantic token or an approved asset.",
      rawColorIndex,
    );
  }

  return violations;
}

describe("UI Foundation v2 source contract", () => {
  it("keeps each scoped file within its declared role contract", () => {
    const violations = scopedFiles.flatMap(({ file, role }) =>
      findViolations({
        file,
        role,
        source: readFileSync(path.join(projectRoot, file), "utf8"),
      }),
    );

    expect(violations).toEqual([]);
  });

  it("reports file, rule, and replacement for forbidden imports and styling", () => {
    const violations = findViolations({
      file: "src/features/plan-editor/components/FirstPlanWizardView.tsx",
      source: [
        'import { usePlanEditorState } from "../hooks/usePlanEditorState.ts";',
        'import "https://example.com/#not-a-color";',
        "const color = '#ff00aa';",
        "const Pattern = WizardStepPage;",
        "const body = <BottomAction />;",
      ].join("\n"),
    });

    expect(violations.map(({ rule }) => rule)).toEqual([
      "migrated-view-footer-bypass",
      "migrated-view-runtime-boundary",
      "semantic-color-token",
    ]);
    expect(violations[0]).toMatchObject({
      location: "src/features/plan-editor/components/FirstPlanWizardView.tsx:5",
      replacement: expect.stringContaining("WizardStepPage"),
    });
  });

  it("catches general query and mutation hooks in a View", () => {
    const violations = findViolations({
      file: "src/features/plan-editor/components/FirstPlanWizardView.tsx",
      source: [
        'import { useQuery as useData, useMutation as update } from "./query-hooks.ts";',
        "useData();",
        "update();",
      ].join("\n"),
    });

    expect(violations.map(({ rule }) => rule)).toContain("migrated-view-runtime-boundary");
  });

  it("checks contract dependencies and feature-neutral pattern imports by module path", () => {
    expect(
      findViolations({
        file: "src/features/plan-editor/first-plan-wizard.contract.ts",
        source: ['import { useState } from "react";', "useState();"].join("\n"),
      }).map(({ rule }) => rule),
    ).toContain("contract-dependency-boundary");

    expect(
      findViolations({
        file: "src/components/galanda/wizard-recipes.ts",
        source: [
          'export { value } from "../../features/plan-home/value.ts";',
          'export * from "@/features/plan-home/index.ts";',
          'const load = () => import("../../features/plan-home/page.tsx");',
        ].join("\n"),
      }).map(({ rule }) => rule),
    ).toContain("pattern-feature-dependency");
  });

  it("does not treat comments, URLs, or ordinary copy as raw colors", () => {
    expect(
      findViolations({
        file: "src/features/plan-editor/first-plan-wizard.presenter.ts",
        source: [
          "// #ffffff is an example in a comment",
          'const copy = "https://example.com/#ffffff";',
          'const text = "예약 확인 코드: #abcdef";',
          'const text2 = "색상은 semantic token으로 선택";',
        ].join("\n"),
      }).filter(({ rule }) => rule === "semantic-color-token"),
    ).toEqual([]);
  });
});
