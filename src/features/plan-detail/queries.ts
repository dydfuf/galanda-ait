import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { TripIdSchema } from "../../core/domain/ids.ts";
import type { TripRoom } from "../../core/domain/room.ts";
import { getTrip } from "../../app/api-client.ts";
import {
  toPlanDetailViewModel,
  type PlanDetailViewModel,
} from "./plan-detail-view-model.ts";
import { tripRoomKeys } from "../plan-home/queries.ts";

import { useSessionQuery } from "../../hooks/useSession.ts";
import { COLLABORATION_READ_FRESHNESS, EDITOR_BASELINE_FRESHNESS } from "../../app/query-freshness.ts";

export const useTripRoomDetailQuery = (
  roomId: string
): UseQueryResult<PlanDetailViewModel, Error> => {
  const { data: session, isSuccess: isSessionReady } = useSessionQuery();

  return useQuery<TripRoom, Error, PlanDetailViewModel>({
    queryKey: tripRoomKeys.detail(roomId, session?.participantId),
    queryFn: ({ signal }): Promise<TripRoom> =>
      getTrip(TripIdSchema.make(roomId), signal),
    select: (room: TripRoom): PlanDetailViewModel =>
      toPlanDetailViewModel(room, session?.participantIds),
    ...COLLABORATION_READ_FRESHNESS,
    enabled: Boolean(roomId) && isSessionReady,
  });
};

export const useTripRoomRawQuery = (
  roomId: string,
  options: { readonly editing?: boolean } = {},
): UseQueryResult<TripRoom, Error> => {
  const { data: session, isSuccess: isSessionReady } = useSessionQuery();

  return useQuery<TripRoom, Error>({
    queryKey: tripRoomKeys.detail(roomId, session?.participantId),
    queryFn: ({ signal }): Promise<TripRoom> =>
      getTrip(TripIdSchema.make(roomId), signal),
    ...(options.editing ? EDITOR_BASELINE_FRESHNESS : COLLABORATION_READ_FRESHNESS),
    enabled: Boolean(roomId) && isSessionReady,
  });
};
