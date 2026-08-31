import { describe, expect, it } from "vitest";
import {
  canonicalizeExploreCityIds,
  EXPLORE_CITY_TAXONOMY,
  getExploreCityId,
  getExploreCityLabel,
  isExploreCityId,
  normalizeExploreCity,
} from "../explore-city.ts";

describe("Explore city taxonomy", () => {
  it("normalizes NFKC, whitespace, and case before exact alias matching", () => {
    expect(normalizeExploreCity("  ＯＳＡＫＡ\t")).toBe("osaka");
    expect(getExploreCityId("  ＯＳＡＫＡ\t")).toBe("osaka");
    expect(getExploreCityId("오사카 여행")).toBeUndefined();
  });

  it("maps every declared alias to its stable ID and exposes its label", () => {
    for (const city of EXPLORE_CITY_TAXONOMY) {
      for (const alias of city.aliases) {
        expect(getExploreCityId(alias)).toBe(city.id);
      }
      expect(getExploreCityLabel(city.id)).toBe(city.label);
    }
  });

  it("recognizes stable IDs without accepting aliases", () => {
    expect(isExploreCityId("osaka")).toBe(true);
    expect(isExploreCityId("오사카")).toBe(false);
    expect(isExploreCityId("서울")).toBe(false);
  });

  it("fails the taxonomy contract if normalized aliases or IDs collide", () => {
    const ids = EXPLORE_CITY_TAXONOMY.map(({ id }) => id);
    const aliases = EXPLORE_CITY_TAXONOMY.flatMap(({ aliases }) =>
      aliases.map(normalizeExploreCity)
    );
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(aliases).size).toBe(aliases.length);
  });

  it("deduplicates known route cities and excludes unknown text", () => {
    expect(
      canonicalizeExploreCityIds([
        "오사카",
        " Osaka ",
        "교토",
        "알 수 없는 도시",
        "오사카",
      ])
    ).toEqual(["osaka", "kyoto"]);
  });
});
