import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { TripRoom } from "../../core/domain/room.ts";
import { getTrips } from "../../app/api-client.ts";
import {
  toTripRoomViewModel,
  type TripRoomViewModel,
} from "./plan-home-view-model.ts";

import { useSessionQuery } from "../../hooks/useSession.ts";

export const tripRoomKeys = {
  all: ["trip-rooms"] as const,
  list: (): readonly ["trip-rooms", "list"] => [...tripRoomKeys.all, "list"] as const,
  detail: (id: string, viewerId?: string): readonly ["trip-rooms", "detail", string, string] =>
    [...tripRoomKeys.all, "detail", id, viewerId ?? "anonymous"] as const,
};

/**
 * 참여 중인 여행방 목록 query.
 *
 * `options.enabled`는 기본값 `true`이며 session 준비 여부와 AND로 결합된다. 기존
 * 소비자는 인자 없이 호출하므로 동작이 바뀌지 않는다. Explore import 대상 선택
 * 처럼 drawer가 열릴 때만 private trip query를 발사하고 싶은 화면은 `enabled:
 * false`로 지연했다가 열릴 때 `true`로 활성화한다.
 */
export const useTripRoomsQuery = (
  options: { readonly enabled?: boolean } = {}
): UseQueryResult<ReadonlyArray<TripRoomViewModel>, Error> => {
  const { data: session, isSuccess: isSessionReady } = useSessionQuery();
  const enabled = options.enabled ?? true;

  return useQuery<ReadonlyArray<TripRoom>, Error, ReadonlyArray<TripRoomViewModel>>({
    queryKey: [...tripRoomKeys.list(), session?.participantId ?? "anonymous"],
    queryFn: ({ signal }): Promise<ReadonlyArray<TripRoom>> =>
      getTrips(signal),
    select: (rooms: ReadonlyArray<TripRoom>): ReadonlyArray<TripRoomViewModel> =>
      rooms.map((r) => toTripRoomViewModel(r, session?.participantIds)),
    enabled: enabled && isSessionReady,
  });
};
