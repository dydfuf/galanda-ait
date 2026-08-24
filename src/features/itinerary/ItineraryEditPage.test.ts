import { describe, expect, it } from "vitest";
import type { ItineraryItemPatch } from "../../core/domain/confirmed-itinerary.ts";
import {
  getChangedItineraryPatches,
  rebaseItineraryPatches,
} from "./itinerary-editor-state.ts";

describe("itinerary conflict recovery", () => {
  it("keeps a local field edit without overwriting another user's field", () => {
    const base: ItineraryItemPatch[] = [{
      type: "STAY",
      itemId: "stay-1",
      date: "2026-09-01",
      endDate: "2026-09-03",
      hotelName: "Hotel A",
      memo: "base memo",
    }];
    const local = [{ ...base[0]!, hotelName: "Hotel Local" }] as ItineraryItemPatch[];
    const latest = [{ ...base[0]!, memo: "remote memo" }] as ItineraryItemPatch[];

    const rebased = rebaseItineraryPatches(base, local, latest);

    expect(rebased[0]).toMatchObject({ hotelName: "Hotel Local", memo: "remote memo" });
    expect(getChangedItineraryPatches(latest, rebased)).toEqual([
      expect.objectContaining({ hotelName: "Hotel Local", memo: "remote memo" }),
    ]);
  });
});
