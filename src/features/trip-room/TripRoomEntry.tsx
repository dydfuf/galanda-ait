import { css } from "@emotion/react";
import { useParams, Navigate } from "react-router-dom";
import { decodeRouteParams, TripParamsSchema } from "../../app/routes/route-params.ts";
import { RouteErrorFallback } from "../common/RouteErrorFallback.tsx";
import { Result } from "effect";
import { useTripRoomDetailQuery } from "../plan-detail/queries.ts";

const loadingContainerStyle = css`
  padding: 48px;
  text-align: center;
`;

const loadingTextStyle = css`
  color: var(--adaptiveGrey600, #6b7684);
  font-size: 15px;
`;

export function TripRoomEntry() {
  const params = useParams();

  const validated = decodeRouteParams(TripParamsSchema, params);
  const tripId = Result.isSuccess(validated) ? validated.success.tripId : "";

  const { data: room, isLoading, isError } = useTripRoomDetailQuery(tripId);

  if (Result.isFailure(validated)) {
    return <RouteErrorFallback message="유효하지 않은 여행방 식별자입니다." />;
  }

  if (isLoading) {
    return (
      <div css={loadingContainerStyle}>
        <p css={loadingTextStyle}>여행 정보를 확인하는 중...</p>
      </div>
    );
  }

  if (isError || !room) {
    return <Navigate to={`/trips/${tripId}/plans`} replace />;
  }

  const destinationPath = room.confirmedPlanId
    ? `/trips/${tripId}/itinerary`
    : `/trips/${tripId}/plans`;

  return <Navigate to={destinationPath} replace />;
}
