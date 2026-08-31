import { Schema } from "effect";

/** 한 listing에 작성자가 선택할 수 있는 공개 테마 수 상한. */
export const EXPLORE_THEME_MAX_SELECTION = 3;

/**
 * Explore theme stable identifiers (RAON-271).
 *
 * ID는 공개 snapshot/filter/cursor/cache contract이므로 한번 발급한 값을 다른
 * 의미로 재사용하지 않는다. 표시명은 아래 taxonomy에서만 관리하며 client는 ID만
 * 제출한다.
 */
export const ExploreThemeIdSchema = Schema.Literals([
  "food",
  "relaxation",
  "nature",
  "culture",
  "activity",
  "family",
  "city",
  "shopping",
]);
export type ExploreThemeId = typeof ExploreThemeIdSchema.Type;

export interface ExploreThemeDefinition {
  readonly id: ExploreThemeId;
  readonly label: string;
  /** false가 되면 기존 snapshot decode는 유지하되 신규 선택 UI/command에서 제외한다. */
  readonly selectable: boolean;
}

/** server-owned taxonomy source of truth. */
export const EXPLORE_THEME_TAXONOMY = [
  { id: "food", label: "미식", selectable: true },
  { id: "relaxation", label: "휴양", selectable: true },
  { id: "nature", label: "자연", selectable: true },
  { id: "culture", label: "문화·예술", selectable: true },
  { id: "activity", label: "액티비티", selectable: true },
  { id: "family", label: "가족", selectable: true },
  { id: "city", label: "도시", selectable: true },
  { id: "shopping", label: "쇼핑", selectable: true },
] as const satisfies ReadonlyArray<ExploreThemeDefinition>;

export const EXPLORE_SELECTABLE_THEMES = EXPLORE_THEME_TAXONOMY.filter(
  (theme) => theme.selectable
);

const knownThemeIds: ReadonlySet<string> = new Set(
  EXPLORE_THEME_TAXONOMY.map(({ id }) => id)
);
const selectableThemeIds: ReadonlySet<string> = new Set(
  EXPLORE_SELECTABLE_THEMES.map(({ id }) => id)
);

export const isExploreThemeId = (value: unknown): value is ExploreThemeId =>
  typeof value === "string" && knownThemeIds.has(value);

/** HTTP command에서 허용하는 ID-only selection contract. */
export const ExploreThemeIdsSchema = Schema.Array(ExploreThemeIdSchema).check(
  Schema.makeFilter(
    (value) =>
      value.length <= EXPLORE_THEME_MAX_SELECTION &&
      new Set(value).size === value.length &&
      value.every((themeId) => selectableThemeIds.has(themeId)),
    {
      message: `테마는 중복 없이 최대 ${EXPLORE_THEME_MAX_SELECTION}개까지 선택할 수 있습니다.`,
    }
  )
);
export type ExploreThemeIds = typeof ExploreThemeIdsSchema.Type;

/** 입력 순서와 무관하게 taxonomy 순서로 저장해 snapshot을 결정적으로 만든다. */
export const canonicalizeExploreThemeIds = (
  themeIds: ReadonlyArray<ExploreThemeId>
): ReadonlyArray<ExploreThemeId> => {
  const selected = new Set(themeIds);
  return EXPLORE_THEME_TAXONOMY.filter(({ id }) => selected.has(id)).map(
    ({ id }) => id
  );
};

export const getExploreThemeLabel = (themeId: ExploreThemeId): string =>
  EXPLORE_THEME_TAXONOMY.find(({ id }) => id === themeId)?.label ?? themeId;
