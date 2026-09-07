import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();

const scopedFiles = [
  "src/features/plan-editor/components/FirstPlanWizardView.tsx",
  "src/features/plan-editor/first-plan-wizard.contract.ts",
  "src/features/plan-editor/first-plan-wizard.presenter.ts",
  "src/components/galanda/wizard-step-page.tsx",
  "src/components/galanda/wizard-recipes.ts",
] as const;

interface SourceInput {
  readonly file: string;
  readonly source: string;
}

interface Violation {
  readonly location: string;
  readonly rule: string;
  readonly replacement: string;
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

function findViolations({ file, source }: SourceInput): Violation[] {
  const clean = stripComments(source);
  const violations: Violation[] = [];
  const isView = file.endsWith("FirstPlanWizardView.tsx");
  const isPresenter = file.endsWith("first-plan-wizard.presenter.ts");
  const isPattern = file.includes("src/components/galanda/wizard-");

  if (isView && !clean.includes("WizardStepPage")) {
    addViolation(
      violations,
      file,
      source,
      "migrated-view-pattern",
      "Render through WizardStepPage.",
      0,
    );
  }
  if (isView && /(?:BottomAction|PageBody)\b/.test(clean)) {
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
  if (isView && /(?:usePlanEditorState|useTripRoomRawQuery|use[A-Za-z]+Mutation|fetch\s*\(|localStorage|sessionStorage)/.test(clean)) {
    const index = clean.search(/(?:usePlanEditorState|useTripRoomRawQuery|use[A-Za-z]+Mutation|fetch\s*\(|localStorage|sessionStorage)/);
    addViolation(
      violations,
      file,
      source,
      "migrated-view-runtime-boundary",
      "Pass a ViewModel and emit a typed event to the controller.",
      index,
    );
  }
  if (isPresenter && /(?:from\s+["']react|react-router-dom|@tanstack|fetch\s*\(|localStorage|sessionStorage|document\.|window\.)/.test(clean)) {
    const index = clean.search(/(?:from\s+["']react|react-router-dom|@tanstack|fetch\s*\(|localStorage|sessionStorage|document\.|window\.)/);
    addViolation(
      violations,
      file,
      source,
      "presenter-purity",
      "Keep the presenter pure; pass a serializable snapshot.",
      index,
    );
  }
  if (isPattern && /features\/plan-editor/.test(clean)) {
    const index = clean.indexOf("features/plan-editor");
    addViolation(
      violations,
      file,
      source,
      "pattern-feature-dependency",
      "Keep Galanda patterns feature-neutral.",
      index,
    );
  }
  const colorSource = clean.replace(/https?:\/\/[^\s"'`]+/g, "");
  const rawColor = colorSource.search(/(?:#[0-9a-f]{3,8}\b|rgba?\s*\(|hsla?\s*\()/i);
  if (rawColor !== -1) {
    addViolation(
      violations,
      file,
      source,
      "semantic-color-token",
      "Use a semantic token or an approved asset.",
      rawColor,
    );
  }

  return violations;
}

describe("UI Foundation v2 source contract", () => {
  it("keeps the migrated View pure and routes layout through the product pattern", () => {
    const violations = scopedFiles.flatMap((file) =>
      findViolations({
        file,
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

  it("does not treat comments, URLs, or ordinary Korean copy as raw colors", () => {
    expect(
      findViolations({
        file: "src/features/plan-editor/first-plan-wizard.presenter.ts",
        source: [
          "// #ffffff is an example in a comment",
          'const copy = "https://example.com/#ffffff";',
          'const text = "색상은 semantic token으로 선택";',
        ].join("\n"),
      }).filter(({ rule }) => rule === "semantic-color-token"),
    ).toEqual([]);
  });
});
