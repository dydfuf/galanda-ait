import { describe, expect, it } from "vitest";
import { Effect, Exit, Layer } from "effect";
import { markTripActivityRead } from "./mark-trip-activity-read.ts";
import { TripActivityRepository } from "../ports/trip-activity-repository.ts";
import { TripRoomRepository } from "../ports/trip-room-repository.ts";
import { SessionService } from "../ports/session.ts";
import { ParticipantIdSchema, RevisionSchema, TripIdSchema } from "../domain/ids.ts";
import { UnauthorizedError } from "../domain/errors.ts";
import { InvalidActivityCursorError } from "../domain/trip-activity.ts";
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

const makeMockActivityRepo = () =>
  Layer.succeed(TripActivityRepository, {
    markRead: ({ tripId: tId, throughSequence }: { readonly tripId: any; readonly throughSequence: bigint }) =>
      Effect.succeed({
        tripId: tId,
        unreadCount: 0,
        latestUnreadSummary: undefined,
        lastSeenSequence: throughSequence,
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

describe("markTripActivityRead use case", () => {
  it("fails with 401 when not authenticated", async () => {
    const layer = Layer.mergeAll(
      makeSessionService(null),
      makeMockRoomRepo(),
      makeMockActivityRepo()
    );
    const exit = await Effect.runPromiseExit(
      markTripActivityRead({ tripId, throughSequence: 10n }).pipe(Effect.provide(layer))
    );
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(JSON.stringify(exit.cause)).toContain("UnauthorizedError");
    }
  });

  it("fails with 403 when user is not a member", async () => {
    const layer = Layer.mergeAll(
      makeSessionService(outsiderId),
      makeMockRoomRepo(),
      makeMockActivityRepo()
    );
    const exit = await Effect.runPromiseExit(
      markTripActivityRead({ tripId, throughSequence: 10n }).pipe(Effect.provide(layer))
    );
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(JSON.stringify(exit.cause)).toContain("ForbiddenError");
    }
  });

  it("updates read cursor and returns summary", async () => {
    const layer = Layer.mergeAll(
      makeSessionService(memberId),
      makeMockRoomRepo(),
      makeMockActivityRepo()
    );
    const exit = await Effect.runPromiseExit(
      markTripActivityRead({ tripId, throughSequence: 42n }).pipe(Effect.provide(layer))
    );
    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isSuccess(exit)) {
      expect(exit.value.lastSeenSequence).toBe(42n);
      expect(exit.value.unreadCount).toBe(0);
    }
  });

  it("propagates InvalidActivityCursorError when cursor does not exist", async () => {
    const layer = Layer.mergeAll(
      makeSessionService(memberId),
      makeMockRoomRepo(),
      Layer.succeed(TripActivityRepository, {
        markRead: () =>
          Effect.fail(
            new InvalidActivityCursorError({
              message: "해당 여행의 활동 순번이 아닙니다.",
              tripId,
              sequence: 999n,
            })
          ),
      } as any)
    );
    const exit = await Effect.runPromiseExit(
      markTripActivityRead({ tripId, throughSequence: 999n }).pipe(Effect.provide(layer))
    );
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(String(exit.cause)).toContain("InvalidActivityCursorError");
    }
  });
});
