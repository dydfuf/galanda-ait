import type { ItineraryItemPatch } from "../../core/domain/confirmed-itinerary.ts";

export type ItineraryEditorField = "date" | "endDate" | "fromCity" | "toCity";

export interface ItineraryEditorValidationError {
  readonly itemId: string;
  readonly fields: ReadonlyArray<ItineraryEditorField>;
  readonly message: string;
}

export interface ItineraryEditorValidation {
  readonly isValid: boolean;
  readonly errors: ReadonlyArray<ItineraryEditorValidationError>;
  readonly firstError?: string;
}

/**
 * 기존 editor가 저장 전에 차단하던 날짜 범위와 이동 경로 입력만 설명 가능한 오류로 변환해요.
 * 숙소명과 이동 수단의 필수 여부는 source snapshot 상태에 따라 달라지므로 서버 domain validation이 소유해요.
 */
export const getItineraryEditorValidation = (
  patches: ReadonlyArray<ItineraryItemPatch>,
): ItineraryEditorValidation => {
  const errors: ItineraryEditorValidationError[] = [];

  for (const patch of patches) {
    if (patch.type === "STAY" && patch.date >= patch.endDate) {
      errors.push({
        itemId: patch.itemId,
        fields: ["date", "endDate"],
        message: "체크아웃 날짜는 체크인 날짜보다 늦어야 합니다.",
      });
      continue;
    }

    if (patch.type === "TRANSPORT") {
      const hasFromCity = Boolean(patch.fromCity.trim());
      const hasToCity = Boolean(patch.toCity.trim());
      if (!hasFromCity || !hasToCity) {
        errors.push({
          itemId: patch.itemId,
          fields: [
            ...(!hasFromCity ? (["fromCity"] as const) : []),
            ...(!hasToCity ? (["toCity"] as const) : []),
          ],
          message:
            !hasFromCity && !hasToCity
              ? "이동 출발지와 도착지를 입력해주세요."
              : !hasFromCity
                ? "이동 출발지를 입력해주세요."
                : "이동 도착지를 입력해주세요.",
        });
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    firstError: errors[0]?.message,
  };
};

export const rebaseItineraryPatches = (
  base: ReadonlyArray<ItineraryItemPatch>,
  local: ReadonlyArray<ItineraryItemPatch>,
  latest: ReadonlyArray<ItineraryItemPatch>,
): ItineraryItemPatch[] =>
  latest.map((latestPatch) => {
    const basePatch = base.find(({ itemId }) => itemId === latestPatch.itemId);
    const localPatch = local.find(
      ({ itemId }) => itemId === latestPatch.itemId,
    );
    if (
      !basePatch ||
      !localPatch ||
      basePatch.type !== latestPatch.type ||
      localPatch.type !== latestPatch.type
    ) {
      return latestPatch;
    }
    return Object.fromEntries(
      Object.entries(latestPatch).map(([key, latestValue]) => [
        key,
        JSON.stringify(localPatch[key as keyof typeof localPatch]) ===
        JSON.stringify(basePatch[key as keyof typeof basePatch])
          ? latestValue
          : localPatch[key as keyof typeof localPatch],
      ]),
    ) as ItineraryItemPatch;
  });

export const getChangedItineraryPatches = (
  base: ReadonlyArray<ItineraryItemPatch>,
  current: ReadonlyArray<ItineraryItemPatch>,
): ItineraryItemPatch[] =>
  current.filter((patch) => {
    const basePatch = base.find(({ itemId }) => itemId === patch.itemId);
    return JSON.stringify(patch) !== JSON.stringify(basePatch);
  });
