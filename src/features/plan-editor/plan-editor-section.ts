export const PLAN_EDITOR_SECTIONS = ["basic", "route", "accommodation", "transport"] as const;
export type PlanEditorSection = (typeof PLAN_EDITOR_SECTIONS)[number];

export const PLAN_EDITOR_SECTION_PRESENTATION = {
  basic: {
    summaryTitle: "기본 정보",
    sectionHeading: "기본 정보 입력",
  },
  route: {
    summaryTitle: "여행 경로",
    sectionHeading: "날짜와 도시 체류 배분",
  },
  accommodation: {
    summaryTitle: "숙소",
    sectionHeading: "숙소 체류 구간",
  },
  transport: {
    summaryTitle: "교통",
    sectionHeading: "이동 교통편",
  },
} as const satisfies Record<
  PlanEditorSection,
  { readonly summaryTitle: string; readonly sectionHeading: string }
>;

export function isPlanEditorSection(value: string | undefined): value is PlanEditorSection {
  return PLAN_EDITOR_SECTIONS.some((section) => section === value);
}
