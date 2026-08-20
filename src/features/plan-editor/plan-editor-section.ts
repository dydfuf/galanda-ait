export const PLAN_EDITOR_SECTIONS = ["basic", "route", "accommodation", "transport"] as const;
export type PlanEditorSection = (typeof PLAN_EDITOR_SECTIONS)[number];

export function isPlanEditorSection(value: string | undefined): value is PlanEditorSection {
  return PLAN_EDITOR_SECTIONS.some((section) => section === value);
}
