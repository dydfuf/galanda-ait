import { Result, Schema } from "effect";
import { describe, expect, it } from "vitest";

import {
  canonicalizeExploreThemeIds,
  ExploreThemeIdsSchema,
  getExploreThemeLabel,
} from "../explore-theme.ts";

describe("Explore theme taxonomy (RAON-271)", () => {
  const decode = Schema.decodeUnknownResult(ExploreThemeIdsSchema);

  it("stable ID만 허용하고 label/arbitrary value를 거부한다", () => {
    expect(Result.isSuccess(decode(["food", "nature"]))).toBe(true);
    expect(Result.isFailure(decode(["미식"]))).toBe(true);
    expect(Result.isFailure(decode(["custom-theme"]))).toBe(true);
  });

  it("중복 없이 최대 3개만 허용한다", () => {
    expect(Result.isFailure(decode(["food", "food"]))).toBe(true);
    expect(
      Result.isFailure(decode(["food", "nature", "culture", "family"]))
    ).toBe(true);
  });

  it("입력 순서와 무관하게 taxonomy 순서로 canonicalize하고 서버 label을 제공한다", () => {
    expect(canonicalizeExploreThemeIds(["nature", "food"])).toEqual([
      "food",
      "nature",
    ]);
    expect(getExploreThemeLabel("food")).toBe("미식");
  });
});
