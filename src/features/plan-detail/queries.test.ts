import { describe, expect, it } from "vitest";
import { TRIP_ROOM_FRESHNESS } from "./queries.ts";
import { QueryClient } from "@tanstack/react-query";
import { tripRoomKeys, tripOverviewKeys } from "../plan-home/queries.ts";

describe("Trip Room freshness", () => {
  it("방 mutation 무효화는 HOME overview도 함께 갱신한다", async () => {
    const client = new QueryClient();
    const key = [...tripOverviewKeys.list(), "member"];
    client.setQueryData(key, []);
    await client.invalidateQueries({ queryKey: tripRoomKeys.all });
    expect(client.getQueryState(key)?.isInvalidated).toBe(true);
    client.clear();
  });
  it("uses the collaboration refresh contract", () => {
    expect(TRIP_ROOM_FRESHNESS).toEqual({
      staleTime: 10_000,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    });
  });
});
