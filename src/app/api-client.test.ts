import { afterEach, describe, expect, it } from "vitest";
import {
  RevisionSchema,
  TripIdSchema,
  UserIdSchema,
} from "../core/domain/ids.ts";
import type { TripRoom } from "../core/domain/room.ts";
import {
  ApiClientError,
  createTrip,
  getCurrentSession,
  getTrip,
  getTrips,
  updateTrip,
} from "./api-client.ts";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("API client", () => {
  it("Better Auth session과 Trip 응답을 decode하고 same-origin cookie를 사용한다", async () => {
    const room: TripRoom = {
      id: TripIdSchema.make("trip-1"),
      title: "오사카 여행",
      destination: "오사카",
      revision: RevisionSchema.make(1),
      members: [
        { id: UserIdSchema.make("user-1"), name: "User", role: "HOST" },
      ],
      plans: [],
      confirmedPlanId: undefined,
    };
    const responses = [
      jsonResponse({
        session: { id: "session-1" },
        user: { id: "user-1", name: "User", email: "user@example.com" },
      }),
      jsonResponse([room]),
      jsonResponse(room, 201),
      jsonResponse({ ...room, revision: 2 }),
    ];
    const calls: Array<{ readonly input: RequestInfo | URL; readonly init?: RequestInit }> = [];
    globalThis.fetch = async (input, init) => {
      calls.push({ input, init });
      return responses.shift() ?? jsonResponse(null, 500);
    };

    await expect(getCurrentSession()).resolves.toMatchObject({
      userId: "user-1",
      name: "User",
      isAuthenticated: true,
    });
    await expect(getTrips()).resolves.toEqual([room]);
    await expect(createTrip({ title: room.title })).resolves.toEqual(room);
    await expect(
      updateTrip(room.id, {
        title: "교토와 오사카",
        expectedRevision: room.revision,
      })
    ).resolves.toMatchObject({ revision: 2 });
    expect(calls.map(({ input }) => input)).toEqual([
      "/api/auth/get-session",
      "/api/trips",
      "/api/trips",
      "/api/trips/trip-1",
    ]);
    expect(calls.every(({ init }) => init?.credentials === "same-origin")).toBe(
      true
    );
    expect(calls[2].init?.headers).toEqual({
      "content-type": "application/json",
    });
    expect(calls[3].init?.method).toBe("PATCH");
  });

  it("API error contract를 사용자 메시지와 revision details로 보존한다", async () => {
    globalThis.fetch = async () =>
      jsonResponse(
        {
          error: {
            code: "REVISION_CONFLICT",
            message: "다른 사용자가 이미 수정했습니다.",
            requestId: "req-1",
            details: { expectedRevision: 3, actualRevision: 4 },
          },
        },
        409
      );

    const error = await getTrip(TripIdSchema.make("trip-1")).catch(
      (cause: unknown) => cause
    );

    expect(error).toBeInstanceOf(ApiClientError);
    expect(error).toMatchObject({
      status: 409,
      code: "REVISION_CONFLICT",
      message: "다른 사용자가 이미 수정했습니다.",
      requestId: "req-1",
      details: { expectedRevision: 3, actualRevision: 4 },
    });
  });
});
