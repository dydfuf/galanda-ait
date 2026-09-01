import { describe, expect, it } from "vitest";
import { Effect, Layer } from "effect";
import { listTripOverviews, toTripOverviewDto } from "./list-trip-overviews.ts";
import { TripRoomRepository, type TripOverviewSourceRecord } from "../ports/trip-room-repository.ts";
import { SessionService } from "../ports/session.ts";
import { ParticipantIdSchema, PlanIdSchema, RevisionSchema, TripIdSchema } from "../domain/ids.ts";
import type { TripRoom } from "../domain/room.ts";

const hostId = ParticipantIdSchema.make("host-1");
const memberId = ParticipantIdSchema.make("member-1");

const createMockRoom = (partial: Partial<Omit<TripRoom, "id">> & { id: string }): TripRoom => ({
  id: TripIdSchema.make(partial.id),
  title: partial.title ?? "Test Trip",
  destination: partial.destination ?? "Jeju",
  revision: RevisionSchema.make(partial.revision ?? 1),
  members: partial.members ?? [
    { id: hostId, name: "Host", role: "HOST" },
    { id: memberId, name: "Member", role: "MEMBER" },
  ],
  plans: partial.plans ?? [],
  confirmedPlanId: partial.confirmedPlanId,
});

describe("toTripOverviewDto", () => {
  it("projects confirmed period from currentItinerary routes", () => {
    const room = createMockRoom({
      id: "trip-1",
      confirmedPlanId: PlanIdSchema.make("plan-1"),
    });
    const record: TripOverviewSourceRecord = {
      room,
      roomCreatedAt: "2026-08-01T00:00:00.000Z",
      roomUpdatedAt: "2026-08-05T00:00:00.000Z",
      currentItinerary: {
        id: "itin-1" as any,
        tripId: TripIdSchema.make("trip-1"),
        sourcePlanId: PlanIdSchema.make("plan-1"),
        sourcePlanRevision: 1 as any,
        currentRevision: 1 as any,
        snapshot: {
          planTitle: "Plan 1",
          destination: "Jeju",
          routes: [
            { city: "Jeju", arrivalDate: "2026-09-10", departureDate: "2026-09-15" },
          ],
          items: [] as any,
        },
        createdBy: hostId,
        createdAt: "2026-08-06T00:00:00.000Z",
      },
    };

    const dto = toTripOverviewDto(record, [hostId]);
    expect(dto.isConfirmed).toBe(true);
    expect(dto.confirmedPeriod).toEqual({
      startDate: "2026-09-10",
      endDate: "2026-09-15",
    });
    expect(dto.updatedAt).toBe("2026-08-06T00:00:00.000Z");
  });

  it("projects effective updatedAt from latest itinerary revision changedAt", () => {
    const room = createMockRoom({
      id: "trip-revised",
      confirmedPlanId: PlanIdSchema.make("plan-1"),
    });
    const record: TripOverviewSourceRecord = {
      room,
      roomCreatedAt: "2026-08-01T00:00:00.000Z",
      roomUpdatedAt: "2026-08-05T00:00:00.000Z",
      currentItinerary: {
        id: "itin-1" as any,
        tripId: TripIdSchema.make("trip-revised"),
        sourcePlanId: PlanIdSchema.make("plan-1"),
        sourcePlanRevision: 1 as any,
        currentRevision: 2 as any,
        snapshot: {
          planTitle: "Plan 1 Revised",
          destination: "Jeju",
          routes: [
            { city: "Jeju", arrivalDate: "2026-09-10", departureDate: "2026-09-15" },
          ],
          items: [] as any,
        },
        createdBy: hostId,
        createdAt: "2026-08-06T00:00:00.000Z",
        changedBy: hostId,
        changedAt: "2026-08-15T12:00:00.000Z",
      },
    };

    const dto = toTripOverviewDto(record, [hostId]);
    expect(dto.updatedAt).toBe("2026-08-15T12:00:00.000Z");
  });

  it("calculates opinion participant count uniquely across plans", () => {
    const room = createMockRoom({
      id: "trip-2",
      plans: [
        {
          id: PlanIdSchema.make("plan-1"),
          title: "Plan A",
          status: "VOTING",
          voteCount: 0,
          places: [],
          memberOpinions: [
            { userId: hostId, userName: "Host", reaction: "LIKE" },
            { userId: memberId, userName: "Member", reaction: "OKAY" },
          ],
        },
        {
          id: PlanIdSchema.make("plan-2"),
          title: "Plan B",
          status: "VOTING",
          voteCount: 0,
          places: [],
          memberOpinions: [
            { userId: hostId, userName: "Host", reaction: "LIKE" },
          ],
        },
      ],
    });

    const record: TripOverviewSourceRecord = {
      room,
      roomCreatedAt: "2026-08-01T00:00:00.000Z",
      roomUpdatedAt: "2026-08-02T00:00:00.000Z",
      currentItinerary: null,
    };

    const dto = toTripOverviewDto(record, [hostId]);
    expect(dto.candidateCount).toBe(2);
    expect(dto.opinionParticipantCount).toBe(2);
    expect(dto.hasUnattributedOpinions).toBe(false);
  });

  it("flags unattributed opinions when legacy voteCount exists without memberOpinions", () => {
    const room = createMockRoom({
      id: "trip-3",
      plans: [
        {
          id: PlanIdSchema.make("plan-legacy"),
          title: "Legacy Plan",
          status: "VOTING",
          voteCount: 3,
          places: [],
        },
      ],
    });

    const record: TripOverviewSourceRecord = {
      room,
      roomCreatedAt: "2026-08-01T00:00:00.000Z",
      roomUpdatedAt: "2026-08-02T00:00:00.000Z",
      currentItinerary: null,
    };

    const dto = toTripOverviewDto(record, [hostId]);
    expect(dto.hasUnattributedOpinions).toBe(true);
  });
});

describe("listTripOverviews usecase", () => {
  it("sorts records by updatedAt DESC, createdAt DESC, id ASC", async () => {
    const roomA = createMockRoom({ id: "trip-a", title: "Trip A" });
    const roomB = createMockRoom({ id: "trip-b", title: "Trip B" });

    const records: TripOverviewSourceRecord[] = [
      {
        room: roomA,
        roomCreatedAt: "2026-08-01T00:00:00.000Z",
        roomUpdatedAt: "2026-08-02T00:00:00.000Z",
        currentItinerary: null,
      },
      {
        room: roomB,
        roomCreatedAt: "2026-08-01T00:00:00.000Z",
        roomUpdatedAt: "2026-08-05T00:00:00.000Z",
        currentItinerary: null,
      },
    ];

    const MockTripRepo = Layer.succeed(TripRoomRepository, {
      getRoomOverviewRecords: () => Effect.succeed(records),
    } as any);

    const MockSession = Layer.succeed(SessionService, {
      getCurrentUser: () =>
        Effect.succeed({
          participantId: hostId,
          participantIds: [hostId],
          accountType: "REGISTERED",
          name: "Host",
          isAuthenticated: true,
        }),
      getCurrentSession: () =>
        Effect.succeed({
          participantId: hostId,
          participantIds: [hostId],
          accountType: "REGISTERED",
          name: "Host",
          isAuthenticated: true,
        }),
    } as any);

    const result = await Effect.runPromise(
      listTripOverviews().pipe(
        Effect.provide(Layer.mergeAll(MockTripRepo, MockSession))
      )
    );

    expect(result.items.map((i) => i.id)).toEqual(["trip-b", "trip-a"]);
  });
});
