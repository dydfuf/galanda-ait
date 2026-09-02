import { drizzle, type NodePgClient } from "drizzle-orm/node-postgres";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import {
  ParticipantIdSchema,
  TripIdSchema,
} from "../../../core/domain/ids.ts";
import type { DatabaseHandle } from "./database.ts";
import { makeDrizzleTripActivityRepository } from "./trip-activity-repository.ts";
import * as schema from "./schema/index.ts";

const makeDb = (responses: ReadonlyArray<ReadonlyArray<unknown>>) => {
  let callCount = 0;
  const client = {
    query: async () => ({ rows: responses[callCount++] ?? [] }),
  };
  return {
    db: drizzle(client as unknown as NodePgClient, { schema }) as DatabaseHandle,
    get callCount() {
      return callCount;
    },
  };
};

const eventRow = (sequence: number, actor = "member-1") => ({
  sequence: String(sequence),
  trip_id: "trip-1",
  event_type: "PLAN_UPDATED",
  actor_participant_id: actor,
  actor_display_name: "Member",
  subject_plan_id: "plan-1",
  subject_title: "여행안",
  room_revision: 2,
  itinerary_revision: null,
  created_at: new Date("2026-09-02T00:00:00.000Z"),
  latest_sequence: "3",
  last_seen_sequence: "1",
  unread_count: 2,
});

describe("DrizzleTripActivityRepository snapshot queries", () => {
  it("listForTrip은 page와 summary를 한 statement의 snapshot으로 계산한다", async () => {
    const mock = makeDb([[eventRow(3), eventRow(2)]]);
    const repository = makeDrizzleTripActivityRepository(mock.db);

    const result = await Effect.runPromise(
      repository.listForTrip({
        tripId: TripIdSchema.make("trip-1"),
        actorParticipantIds: [ParticipantIdSchema.make("host-1")],
        limit: 1,
      }),
    );

    expect(mock.callCount).toBe(1);
    expect(result.events).toHaveLength(1);
    expect(result.events[0]?.sequence).toBe(3n);
    expect(result.nextBeforeSequence).toBe(3n);
    expect(result.latestSequence).toBe(3n);
    expect(result.lastSeenSequence).toBe(1n);
    expect(result.unreadCount).toBe(2);
  });

  it("getSummariesForTrips은 모든 trip의 unread count/latest를 bulk query로 계산한다", async () => {
    const mock = makeDb([
      [
        {
          trip_id: "trip-1",
          last_seen_sequence: "4",
          unread_count: 1,
          latest_event_type: "PLAN_UPDATED",
          latest_actor_display_name: "Member",
          latest_subject_title: "최신 여행안",
          latest_created_at: new Date("2026-09-02T00:00:00.000Z"),
        },
        {
          trip_id: "trip-2",
          last_seen_sequence: null,
          unread_count: 0,
          latest_event_type: null,
          latest_actor_display_name: null,
          latest_subject_title: null,
          latest_created_at: null,
        },
      ],
    ]);
    const repository = makeDrizzleTripActivityRepository(mock.db);

    const summaries = await Effect.runPromise(
      repository.getSummariesForTrips({
        tripIds: [TripIdSchema.make("trip-1"), TripIdSchema.make("trip-2")],
        actorParticipantIds: [ParticipantIdSchema.make("host-1")],
      }),
    );

    expect(mock.callCount).toBe(1);
    expect(summaries.get(TripIdSchema.make("trip-1"))).toMatchObject({
      unreadCount: 1,
      lastSeenSequence: 4n,
      latestUnreadSummary: {
        type: "PLAN_UPDATED",
        subjectTitle: "최신 여행안",
      },
    });
    expect(summaries.get(TripIdSchema.make("trip-2"))).toMatchObject({
      unreadCount: 0,
      lastSeenSequence: undefined,
      latestUnreadSummary: undefined,
    });
  });
});
