import type { ItineraryItemPatch } from "../../core/domain/confirmed-itinerary.ts";

export const rebaseItineraryPatches = (
  base: ReadonlyArray<ItineraryItemPatch>,
  local: ReadonlyArray<ItineraryItemPatch>,
  latest: ReadonlyArray<ItineraryItemPatch>
): ItineraryItemPatch[] =>
  latest.map((latestPatch) => {
    const basePatch = base.find(({ itemId }) => itemId === latestPatch.itemId);
    const localPatch = local.find(({ itemId }) => itemId === latestPatch.itemId);
    if (!basePatch || !localPatch || basePatch.type !== latestPatch.type || localPatch.type !== latestPatch.type) {
      return latestPatch;
    }
    return Object.fromEntries(
      Object.entries(latestPatch).map(([key, latestValue]) => [
        key,
        JSON.stringify(localPatch[key as keyof typeof localPatch]) ===
        JSON.stringify(basePatch[key as keyof typeof basePatch])
          ? latestValue
          : localPatch[key as keyof typeof localPatch],
      ])
    ) as ItineraryItemPatch;
  });

export const getChangedItineraryPatches = (
  base: ReadonlyArray<ItineraryItemPatch>,
  current: ReadonlyArray<ItineraryItemPatch>
): ItineraryItemPatch[] =>
  current.filter((patch) => {
    const basePatch = base.find(({ itemId }) => itemId === patch.itemId);
    return JSON.stringify(patch) !== JSON.stringify(basePatch);
  });
