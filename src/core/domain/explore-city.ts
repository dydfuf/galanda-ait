import { Schema } from "effect";

/** Explore route city stable identifier. Existing IDs must never change meaning. */
export const ExploreCityIdSchema = Schema.Literals([
  "seoul",
  "busan",
  "jeju",
  "tokyo",
  "osaka",
  "kyoto",
  "nagoya",
  "hakone",
  "yokohama",
]);
export type ExploreCityId = typeof ExploreCityIdSchema.Type;

export interface ExploreCityDefinition {
  readonly id: ExploreCityId;
  readonly label: string;
  readonly aliases: ReadonlyArray<string>;
}

/** Server-owned v1 taxonomy. Labels and aliases are not client-provided data. */
export const EXPLORE_CITY_TAXONOMY = [
  { id: "seoul", label: "서울", aliases: ["서울", "서울시", "seoul"] },
  { id: "busan", label: "부산", aliases: ["부산", "부산시", "busan"] },
  { id: "jeju", label: "제주", aliases: ["제주", "제주도", "제주시", "jeju"] },
  { id: "tokyo", label: "도쿄", aliases: ["도쿄", "동경", "tokyo"] },
  { id: "osaka", label: "오사카", aliases: ["오사카", "osaka"] },
  { id: "kyoto", label: "교토", aliases: ["교토", "kyoto"] },
  { id: "nagoya", label: "나고야", aliases: ["나고야", "nagoya"] },
  { id: "hakone", label: "하코네", aliases: ["하코네", "hakone"] },
  { id: "yokohama", label: "요코하마", aliases: ["요코하마", "yokohama"] },
] as const satisfies ReadonlyArray<ExploreCityDefinition>;

/** NFKC + whitespace + locale-independent lowercase normalization. */
export const normalizeExploreCity = (value: string): string =>
  value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLowerCase();

const aliasToCityId = new Map<string, ExploreCityId>();
for (const { id, aliases } of EXPLORE_CITY_TAXONOMY) {
  for (const alias of aliases) {
    const normalized = normalizeExploreCity(alias);
    const previous = aliasToCityId.get(normalized);
    if (previous && previous !== id) {
      throw new Error(`Explore city alias collision: ${alias}`);
    }
    aliasToCityId.set(normalized, id);
  }
}
const knownCityIds: ReadonlySet<string> = new Set(
  EXPLORE_CITY_TAXONOMY.map(({ id }) => id)
);

/** Exact alias match only. Unknown or ambiguous text stays unmapped. */
export const getExploreCityId = (value: string): ExploreCityId | undefined =>
  aliasToCityId.get(normalizeExploreCity(value));

/** Deduplicates known route cities; unknown route text is excluded. */
export const canonicalizeExploreCityIds = (
  cities: ReadonlyArray<string>
): ReadonlyArray<ExploreCityId> => {
  const ids = new Set<ExploreCityId>();
  for (const city of cities) {
    const cityId = getExploreCityId(city);
    if (cityId) ids.add(cityId);
  }
  return [...ids];
};

export const isExploreCityId = (value: unknown): value is ExploreCityId =>
  typeof value === "string" && knownCityIds.has(value);

export const getExploreCityLabel = (cityId: ExploreCityId): string =>
  EXPLORE_CITY_TAXONOMY.find(({ id }) => id === cityId)?.label ?? cityId;
