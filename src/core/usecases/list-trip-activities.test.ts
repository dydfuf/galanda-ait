import { describe, expect, it } from "vitest";
import { Effect, Exit, Layer } from "effect";
import { listTripActivities } from "./list-trip-activities.ts";
import { TripActivityRepository } from "../ports/trip-activity-repository.ts";
import { TripRoomRepository } from "../ports/trip-room-repository.ts";
import { SessionService } from "../ports/session.ts";
import { ParticipantIdSchema, RevisionSchema, TripIdSchema } from "../domain/ids.ts";
import { UnauthorizedError } from "../domain/errors.ts";
import type { TripRoom } from "../domain/room.ts";

const memberId = ParticipantIdSchema.make("user-1");
const outsiderId = ParticipantIdSchema.make("outsider-1");
const tripId = TripIdSchema.make("trip-1");

const mockRoom: TripRoom = {
  id: tripId,
  title: "Test Trip",
  destination: "Jeju",
  revision: RevisionSchema.make(1),
  members: [{ id: memberId, name: "Alice", role: "MEMBER" }],
  plans: [],
  confirmedPlanId: undefined,
};

const makeMockRoomRepo = (room: TripRoom = mockRoom) =>
  Layer.succeed(TripRoomRepository, {
    getRoom: (id: unknown) =>
      id === room.id
        ? Effect.succeed(room)
        : Effect.fail({ _tag: "NotFoundError", entity: "TripRoom", id } as any),
  } as any);

const makeMockActivityRepo = (events: any[] = []) =>
  Layer.succeed(TripActivityRepository, {
    listForTrip: ({ limit }: { readonly limit: number }) =>
      Effect.succeed({
        events: events.slice(0, limit),
        hasMore: events.length > limit,
        nextBeforeSequence: undefined,
        latestSequence: events.length > 0 ? events[0].sequence : undefined,
        lastSeenSequence: undefined,
        unreadCount: 0,
      }),
  } as any);

const makeSessionService = (participantId: typeof ParticipantIdSchema.Type | null) =>
  Layer.succeed(SessionService, {
    getCurrentUser: () =>
      participantId
        ? Effect.succeed({
            participantId,
            participantIds: [participantId],
            accountType: "REGISTERED" as const,
            name: "Test User",
            isAuthenticated: true,
          })
        : Effect.fail(new UnauthorizedError({ reason: "로그인이 필요합니다." })),
    getCurrentSession: () =>
      participantId
        ? Effect.succeed({
            participantId,
            participantIds: [participantId],
            accountType: "REGISTERED" as const,
            name: "Test User",
            isAuthenticated: true,
          })
        : Effect.fail(new UnauthorizedError({ reason: "로그인이 필요합니다." })),
  } as any);

describe("listTripActivities use case", () => {
  it("fails with 401 when not authenticated", async () => {
    const layer = Layer.mergeAll(
      makeSessionService(null),
      makeMockRoomRepo(),
      makeMockActivityRepo()
    );
    const exit = await Effect.runPromiseExit(
      listTripActivities({ tripId }).pipe(Effect.provide(layer))
    );
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(JSON.stringify(exit.cause)).toContain("UnauthorizedError");
    }
  });

  it("fails with 403 when user is not a member of the room", async () => {
    const layer = Layer.mergeAll(
      makeSessionService(outsiderId),
      makeMockRoomRepo(),
      makeMockActivityRepo()
    );
    const exit = await Effect.runPromiseExit(
      listTripActivities({ tripId }).pipe(Effect.provide(layer))
    );
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(JSON.stringify(exit.cause)).toContain("ForbiddenError");
    }
  });

  it("returns paginated activity events when user is a member", async () => {
    const events = [
      {
        sequence: 2n,
        tripId,
        type: "PLAN_CREATED",
        actorParticipantId: memberId,
        actorDisplayName: "Alice",
        subjectPlanId: "plan-1",
        subjectTitle: "First Plan",
        roomRevision: 2,
        createdAt: "2026-08-01T00:00:00.000Z",
      },
    ];
    const layer = Layer.mergeAll(
      makeSessionService(memberId),
      makeMockRoomRepo(),
      makeMockActivityRepo(events)
    );
    const exit = await Effect.runPromiseExit(
      listTripActivities({ tripId, limit: 10 }).pipe(Effect.provide(layer))
    );
    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isSuccess(exit)) {
      expect(exit.value.events).toHaveLength(1);
      expect(exit.value.events[0].sequence).toBe(2n);
      expect(exit.value.events[0].type).toBe("PLAN_CREATED");
    }
  });
});
