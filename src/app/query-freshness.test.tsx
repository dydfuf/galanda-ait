// @vitest-environment jsdom
import type { PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider, focusManager, onlineManager } from "@tanstack/react-query";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ParticipantIdSchema, RevisionSchema, TripIdSchema } from "../core/domain/ids.ts";

vi.mock("./api-client.ts", () => ({ getTrip: vi.fn(), getTripItinerary: vi.fn() }));
vi.mock("../hooks/useSession.ts", () => ({ useSessionQuery: vi.fn() }));
import { getTrip, getTripItinerary } from "./api-client.ts";
import { useSessionQuery } from "../hooks/useSession.ts";
import { useTripRoomRawQuery } from "../features/plan-detail/queries.ts";
import { itineraryKeys, useItineraryQuery } from "../features/itinerary/queries.ts";

let client: QueryClient;
let revision = 1;
const session = (id: string) => ({
  isSuccess: true, data: { participantId: ParticipantIdSchema.make(id) },
}) as ReturnType<typeof useSessionQuery>;
function Wrapper({ children }: PropsWithChildren) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
const tick = (ms = 1) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

beforeEach(() => {
  vi.useFakeTimers();
  focusManager.setFocused(true);
  onlineManager.setOnline(true);
  revision = 1;
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  vi.mocked(useSessionQuery).mockReturnValue(session("host"));
  vi.mocked(getTrip).mockReset().mockImplementation(async () => ({
    id: TripIdSchema.make("trip"), title: "여행", destination: "제주",
    revision: RevisionSchema.make(revision), members: [], plans: [],
  }));
  vi.mocked(getTripItinerary).mockReset().mockImplementation(async () => ({
    status: revision === 1 ? "UNCONFIRMED" : "MISSING",
  }));
});
afterEach(() => {
  cleanup();
  client.clear();
  focusManager.setFocused(undefined);
  onlineManager.setOnline(true);
  vi.useRealTimers();
});

describe("협업 읽기와 편집 freshness", () => {
  it.each(["room", "itinerary"] as const)("%s 읽기는 30초 갱신, background 중단, focus/reconnect 복구", async (surface) => {
    const fetcher = surface === "room" ? getTrip : getTripItinerary;
    const { result } = renderHook(() => surface === "room"
      ? useTripRoomRawQuery("trip") : useItineraryQuery("trip"), { wrapper: Wrapper });
    await tick();
    expect(fetcher).toHaveBeenCalledTimes(1);
    revision = 2;
    await tick(30_000);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(result.current.data).toMatchObject(surface === "room" ? { revision: 2 } : { status: "MISSING" });
    act(() => focusManager.setFocused(false));
    await tick(60_000);
    expect(fetcher).toHaveBeenCalledTimes(2);
    act(() => focusManager.setFocused(true));
    await tick();
    expect(fetcher).toHaveBeenCalledTimes(3);
    act(() => onlineManager.setOnline(false));
    await tick(30_000);
    expect(fetcher).toHaveBeenCalledTimes(3);
    act(() => onlineManager.setOnline(true));
    await tick();
    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it.each(["room", "itinerary"] as const)("%s 편집은 자동 갱신 없이 명시적 충돌 복구 조회만 수행", async (surface) => {
    const fetcher = surface === "room" ? getTrip : getTripItinerary;
    const { result } = renderHook(() => surface === "room"
      ? useTripRoomRawQuery("trip", { editing: true })
      : useItineraryQuery("trip", { editing: true }), { wrapper: Wrapper });
    await tick();
    expect(result.current.data).toMatchObject(surface === "room" ? { revision: 1 } : { status: "UNCONFIRMED" });
    revision = 2;
    await tick(60_000);
    act(() => { focusManager.setFocused(false); onlineManager.setOnline(false); });
    act(() => { focusManager.setFocused(true); onlineManager.setOnline(true); });
    await tick();
    expect(fetcher).toHaveBeenCalledTimes(1);
    await act(async () => { await result.current.refetch(); });
    await tick();
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(result.current.data).toMatchObject(surface === "room" ? { revision: 2 } : { status: "MISSING" });
  });

  it("viewer가 바뀌면 이전 일정 권한과 확인 상태를 재사용하지 않는다", async () => {
    const { result, rerender } = renderHook(() => useItineraryQuery("trip"), { wrapper: Wrapper });
    await tick();
    expect(client.getQueryData(itineraryKeys.detail("trip", "host"))).toEqual({ status: "UNCONFIRMED" });
    vi.mocked(useSessionQuery).mockReturnValue(session("member"));
    vi.mocked(getTripItinerary).mockImplementation(() => new Promise(() => {}));
    rerender();
    expect(result.current.data).toBeUndefined();
    expect(result.current.isPending).toBe(true);
    expect(client.getQueryData(itineraryKeys.detail("trip", "host"))).toEqual({ status: "UNCONFIRMED" });
  });
});
