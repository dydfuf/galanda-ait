import { Schema } from "effect";
import type { Revision, TripId } from "../core/domain/ids.ts";
import { TripRoomSchema, type UserSession } from "../core/domain/room.ts";
import type { UpdateRoomParams } from "../core/ports/trip-room-repository.ts";
import type { CreateRoomInput } from "../core/usecases/create-room.ts";
import { normalizeBetterAuthSession } from "../infrastructure/auth/better-auth/session.ts";

const BetterAuthSessionSchema = Schema.NullOr(
  Schema.Struct({
    user: Schema.Struct({
      id: Schema.String,
      name: Schema.optional(Schema.NullOr(Schema.String)),
      email: Schema.optional(Schema.NullOr(Schema.String)),
    }),
  })
);

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

export const getCurrentSession = async (
  signal?: AbortSignal
): Promise<UserSession | null> => {
  const session = await requestJson(
    "/api/auth/get-session",
    BetterAuthSessionSchema,
    { signal }
  );
  return session ? normalizeBetterAuthSession(session) : null;
};

export const getTrips = (signal?: AbortSignal) =>
  requestJson("/api/trips", Schema.Array(TripRoomSchema), { signal });

export const getTrip = (tripId: TripId, signal?: AbortSignal) =>
  requestJson(`/api/trips/${encodeURIComponent(tripId)}`, TripRoomSchema, {
    signal,
  });

export const createTrip = (input: CreateRoomInput) =>
  requestJson("/api/trips", TripRoomSchema, {
    method: "POST",
    body: JSON.stringify(input),
  });

export const updateTrip = (
  tripId: TripId,
  input: UpdateRoomParams & { readonly expectedRevision: Revision }
) =>
  requestJson(`/api/trips/${encodeURIComponent(tripId)}`, TripRoomSchema, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
