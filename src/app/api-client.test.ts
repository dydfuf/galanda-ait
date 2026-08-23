import { afterEach, describe, expect, it } from "vitest";
import {
  InviteTokenSchema,
  PlanIdSchema,
  RevisionSchema,
  TripIdSchema,
  UserIdSchema,
} from "../core/domain/ids.ts";
import type { TripRoom } from "../core/domain/room.ts";
import {
  ApiClientError,
  confirmTripPlan,
  createTrip,
  createTripPlan,
  deleteTripPlan,
  getCurrentSession,
  getInviteSummary,
  getTrip,
  getTrips,
  issueTripInvite,
  joinInvite,
  submitTripPlanOpinion,
  updateTrip,
  updateTripPlan,
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
        participantId: "user-1",
        participantIds: ["user-1"],
        accountType: "REGISTERED",
        name: "User",
        isAuthenticated: true,
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
      participantId: "user-1",
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
      "/api/session",
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

  it("plan/opinion/confirm mutation을 allowlisted HTTP DTO로 전송한다", async () => {
    const tripId = TripIdSchema.make("trip-1");
    const planId = PlanIdSchema.make("plan-1");
    const revision = RevisionSchema.make(3);
    const room: TripRoom = {
      id: tripId,
      title: "오사카 여행",
      destination: "오사카",
      revision,
      members: [
        { id: UserIdSchema.make("user-1"), name: "User", role: "HOST" },
      ],
      plans: [],
      confirmedPlanId: undefined,
    };
    const calls: Array<{ readonly input: RequestInfo | URL; readonly init?: RequestInit }> = [];
    globalThis.fetch = async (input, init) => {
      calls.push({ input, init });
      return jsonResponse(room);
    };
    const plan = {
      id: planId,
      title: "수정안",
      status: "CONFIRMED" as const,
      authorId: UserIdSchema.make("attacker"),
      authorName: "Attacker",
      places: [],
      memberOpinions: [],
      voteCount: 999,
      differenceSummary: "위조 diff",
      clonedFromPlanId: PlanIdSchema.make("forged-source"),
    };

    await createTripPlan(tripId, {
      title: "새 여행안",
      places: [],
      expectedRevision: revision,
    });
    await updateTripPlan(tripId, plan, revision);
    await deleteTripPlan(tripId, planId, revision);
    await submitTripPlanOpinion(
      tripId,
      planId,
      { reaction: "HARD", reason: "너무 멀어요" },
      revision
    );
    await confirmTripPlan(tripId, planId, revision);

    expect(calls.map(({ input, init }) => [init?.method, input])).toEqual([
      ["POST", "/api/trips/trip-1/plans"],
      ["PATCH", "/api/trips/trip-1/plans/plan-1"],
      ["DELETE", "/api/trips/trip-1/plans/plan-1"],
      ["PUT", "/api/trips/trip-1/plans/plan-1/opinion"],
      ["POST", "/api/trips/trip-1/plans/plan-1/confirm"],
    ]);
    expect(JSON.parse(calls[1].init?.body as string)).toEqual({
      title: "수정안",
      places: [],
      expectedRevision: 3,
    });
  });

  it("opaque invite summary·발급·nickname join 계약만 전송한다", async () => {
    const tripId = TripIdSchema.make("trip-1");
    const token = InviteTokenSchema.make(
      "00000000-0000-4000-8000-000000000001"
    );
    const room: TripRoom = {
      id: tripId,
      title: "오사카 여행",
      destination: "오사카",
      revision: RevisionSchema.make(2),
      members: [
        { id: UserIdSchema.make("guest-1"), name: "라온", role: "MEMBER" },
      ],
      plans: [],
      confirmedPlanId: undefined,
    };
    const responses = [
      jsonResponse({
        title: room.title,
        inviterName: "Host",
        participantCount: 1,
        alreadyJoined: false,
      }),
      jsonResponse({ token, expiresAt: "2026-09-01T00:00:00.000Z" }, 201),
      jsonResponse(room),
    ];
    const calls: Array<{ readonly input: RequestInfo | URL; readonly init?: RequestInit }> = [];
    globalThis.fetch = async (input, init) => {
      calls.push({ input, init });
      return responses.shift() ?? jsonResponse(null, 500);
    };

    await getInviteSummary(token);
    await issueTripInvite(tripId);
    await joinInvite(token, "라온");

    expect(calls.map(({ input, init }) => [init?.method, input])).toEqual([
      [undefined, `/api/invites/${token}`],
      ["POST", "/api/trips/trip-1/invites"],
      ["POST", `/api/invites/${token}/join`],
    ]);
    expect(JSON.parse(calls[2].init?.body as string)).toEqual({ nickname: "라온" });
  });
});
