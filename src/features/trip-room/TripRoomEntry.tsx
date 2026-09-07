import { useParams, Navigate } from "react-router-dom";
import { PageState } from "@/components/galanda/page-state.tsx";
import { decodeRouteParams, TripParamsSchema } from "../../app/routes/route-params.ts";
import { RouteErrorFallback } from "../common/RouteErrorFallback.tsx";
import { Result } from "effect";
import { useTripRoomDetailQuery } from "../plan-detail/queries.ts";

export function TripRoomEntry() {
  const params = useParams();

  const validated = decodeRouteParams(TripParamsSchema, params);
  const tripId = Result.isSuccess(validated) ? validated.success.tripId : "";

  const { data: room, isLoading, isError } = useTripRoomDetailQuery(tripId);

  if (Result.isFailure(validated)) {
    return <RouteErrorFallback message="유효하지 않은 여행방 식별자입니다." />;
  }

  if (isLoading) {
    return <PageState status="loading" message="여행 정보를 확인하는 중이에요." />;
  }

  if (isError || !room) {
    return <Navigate to={`/trips/${tripId}/plans`} replace />;
  }

  const destinationPath = room.confirmedPlanId
    ? `/trips/${tripId}/itinerary`
    : `/trips/${tripId}/plans`;

  return <Navigate to={destinationPath} replace />;
}
