import { Schema } from "effect";
import type {
  InviteToken,
  PlanId,
  Revision,
  TripId,
} from "../core/domain/ids.ts";
import {
  IssuedInviteSchema,
  PublicInviteSummarySchema,
} from "../core/domain/invite.ts";
import {
  TripRoomSchema,
  UserSessionSchema,
  type TripPlan,
  type UserSession,
} from "../core/domain/room.ts";
import type { UpdateRoomParams } from "../core/ports/trip-room-repository.ts";
import type { CreateRoomInput } from "../core/usecases/create-room.ts";
import type { CreatePlanCommand } from "../core/usecases/save-plan.ts";
import type { SubmitPlanOpinionInput } from "../core/usecases/submit-opinion.ts";

export class ApiClientError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly requestId?: string;
  readonly details?: unknown;

  constructor(options: {
    readonly status: number;
    readonly message: string;
    readonly code?: string;
    readonly requestId?: string;
    readonly details?: unknown;
  }) {
    super(options.message);
    this.name = "ApiClientError";
    this.status = options.status;
    this.code = options.code;
    this.requestId = options.requestId;
    this.details = options.details;
  }
}

const requestJson = async <S extends Schema.Decoder<any, never>>(
  path: string,
  schema: S,
  init: RequestInit = {}
): Promise<S["Type"]> => {
  const response = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers: init.body ? { "content-type": "application/json" } : init.headers,
  });
  const payload: unknown = await response.json().catch(() => undefined);

  if (!response.ok) {
    const detail =
      payload && typeof payload === "object" && "error" in payload
        ? (payload.error as Record<string, unknown>)
        : undefined;
    throw new ApiClientError({
      status: response.status,
      message:
        typeof detail?.message === "string"
          ? detail.message
          : "요청을 처리하지 못했습니다.",
      code: typeof detail?.code === "string" ? detail.code : undefined,
      requestId:
        typeof detail?.requestId === "string" ? detail.requestId : undefined,
      details: detail?.details,
    });
  }

  try {
    return await Schema.decodeUnknownPromise(schema)(payload);
  } catch (cause) {
    throw new Error("서버 응답 형식이 올바르지 않습니다.", { cause });
  }
};

const tripPath = (tripId: TripId): string =>
  `/api/trips/${encodeURIComponent(tripId)}`;

const planPath = (tripId: TripId, planId: PlanId): string =>
  `${tripPath(tripId)}/plans/${encodeURIComponent(planId)}`;

export const getCurrentSession = async (
  signal?: AbortSignal
): Promise<UserSession | null> => {
  return requestJson("/api/session", Schema.NullOr(UserSessionSchema), {
    signal,
  });
};

export const signInAnonymously = () =>
  requestJson(
    "/api/auth/sign-in/anonymous",
    Schema.Struct({
      token: Schema.String,
      user: Schema.Struct({ id: Schema.String }),
    }),
    { method: "POST" }
  );

export const getTrips = (signal?: AbortSignal) =>
  requestJson("/api/trips", Schema.Array(TripRoomSchema), { signal });

export const getTrip = (tripId: TripId, signal?: AbortSignal) =>
  requestJson(tripPath(tripId), TripRoomSchema, {
    signal,
  });

export const getInviteSummary = (
  inviteToken: InviteToken,
  signal?: AbortSignal
) =>
  requestJson(
    `/api/invites/${encodeURIComponent(inviteToken)}`,
    PublicInviteSummarySchema,
    { signal }
  );

export const issueTripInvite = (tripId: TripId) =>
  requestJson(`${tripPath(tripId)}/invites`, IssuedInviteSchema, {
    method: "POST",
  });

export const joinInvite = (inviteToken: InviteToken, nickname: string) =>
  requestJson(
    `/api/invites/${encodeURIComponent(inviteToken)}/join`,
    TripRoomSchema,
    { method: "POST", body: JSON.stringify({ nickname }) }
  );

export const createTrip = (input: CreateRoomInput) =>
  requestJson("/api/trips", TripRoomSchema, {
    method: "POST",
    body: JSON.stringify(input),
  });

export const updateTrip = (
  tripId: TripId,
  input: UpdateRoomParams & { readonly expectedRevision: Revision }
) =>
  requestJson(tripPath(tripId), TripRoomSchema, {
    method: "PATCH",
    body: JSON.stringify(input),
  });

export const createTripPlan = (
  tripId: TripId,
  input: Omit<CreatePlanCommand, "roomId">
) =>
  requestJson(`${tripPath(tripId)}/plans`, TripRoomSchema, {
    method: "POST",
    body: JSON.stringify(input),
  });

export const updateTripPlan = (
  tripId: TripId,
  plan: TripPlan,
  expectedRevision: Revision
) =>
  requestJson(planPath(tripId, plan.id), TripRoomSchema, {
    method: "PATCH",
    body: JSON.stringify({
      title: plan.title,
      proposalReason: plan.proposalReason,
      baseHeadcount: plan.baseHeadcount,
      routes: plan.routes,
      accommodations: plan.accommodations,
      transports: plan.transports,
      places: plan.places,
      expectedRevision,
    }),
  });

export const deleteTripPlan = (
  tripId: TripId,
  planId: PlanId,
  expectedRevision: Revision
) =>
  requestJson(planPath(tripId, planId), TripRoomSchema, {
    method: "DELETE",
    body: JSON.stringify({ expectedRevision }),
  });

export const submitTripPlanOpinion = (
  tripId: TripId,
  planId: PlanId,
  opinion: SubmitPlanOpinionInput["opinion"],
  expectedRevision: Revision
) =>
  requestJson(`${planPath(tripId, planId)}/opinion`, TripRoomSchema, {
    method: "PUT",
    body: JSON.stringify({ ...opinion, expectedRevision }),
  });

export const confirmTripPlan = (
  tripId: TripId,
  planId: PlanId,
  expectedRevision: Revision
) =>
  requestJson(`${planPath(tripId, planId)}/confirm`, TripRoomSchema, {
    method: "POST",
    body: JSON.stringify({ expectedRevision }),
  });
