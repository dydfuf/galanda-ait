import { describe, expect, it } from "vitest";
import { Schema } from "effect";
import {
  ActivitySequenceSchema,
  TripActivityEventDtoSchema,
  TripActivitySummaryDtoSchema,
  TripActivityPageResponseSchema,
  MarkTripActivityReadRequestSchema,
} from "./trip-activity.ts";

describe("trip-activity contracts", () => {
  describe("ActivitySequenceSchema", () => {
    it("accepts valid decimal strings within BIGINT range", () => {
      expect(Schema.is(ActivitySequenceSchema)("1")).toBe(true);
      expect(Schema.is(ActivitySequenceSchema)("42")).toBe(true);
      expect(Schema.is(ActivitySequenceSchema)("9223372036854775807")).toBe(true);
    });

    it("rejects invalid sequence values and overflow", () => {
      expect(Schema.is(ActivitySequenceSchema)("0")).toBe(false);
      expect(Schema.is(ActivitySequenceSchema)("-1")).toBe(false);
      expect(Schema.is(ActivitySequenceSchema)("1.5")).toBe(false);
      expect(Schema.is(ActivitySequenceSchema)("abc")).toBe(false);
      expect(Schema.is(ActivitySequenceSchema)(" 123 ")).toBe(false);
      expect(Schema.is(ActivitySequenceSchema)("")).toBe(false);
      expect(Schema.is(ActivitySequenceSchema)("9223372036854775808")).toBe(false);
      expect(Schema.is(ActivitySequenceSchema)(123 as any)).toBe(false);
    });
  });

  describe("TripActivityEventDtoSchema", () => {
    it("decodes valid event dto", () => {
      const dto = {
        sequence: "1",
        tripId: "trip-1",
        type: "PLAN_CREATED",
        actorParticipantId: "part-1",
        actorDisplayName: "Alice",
        isOwn: true,
        subjectPlanId: "plan-1",
        subjectTitle: "First Plan",
        roomRevision: 2,
        itineraryRevision: null,
        createdAt: "2026-08-01T00:00:00.000Z",
      };
      expect(Schema.is(TripActivityEventDtoSchema)(dto)).toBe(true);
    });

    it("rejects unknown event type", () => {
      const dto = {
        sequence: "1",
        tripId: "trip-1",
        type: "UNKNOWN_EVENT",
        actorParticipantId: "part-1",
        isOwn: false,
        createdAt: "2026-08-01T00:00:00.000Z",
      };
      expect(Schema.is(TripActivityEventDtoSchema)(dto)).toBe(false);
    });
  });

  describe("TripActivitySummaryDtoSchema", () => {
    it("decodes summary with unread count and latest event", () => {
      const summary = {
        tripId: "trip-1",
        unreadCount: 3,
        latestUnreadSummary: {
          type: "PLAN_CREATED",
          actorDisplayName: "Bob",
          subjectTitle: "Jeju Plan",
          createdAt: "2026-08-02T00:00:00.000Z",
        },
        lastSeenSequence: "10",
      };
      expect(Schema.is(TripActivitySummaryDtoSchema)(summary)).toBe(true);
    });

    it("decodes summary when no unread", () => {
      const summary = {
        tripId: "trip-1",
        unreadCount: 0,
        latestUnreadSummary: null,
        lastSeenSequence: null,
      };
      expect(Schema.is(TripActivitySummaryDtoSchema)(summary)).toBe(true);
    });
  });

  describe("TripActivityPageResponseSchema", () => {
    it("validates valid activity page responses", () => {
      const page = {
        items: [],
        hasMore: false,
        nextBeforeSequence: null,
        latestSequence: "10",
        lastSeenSequence: null,
        unreadCount: 0,
      };
      expect(Schema.is(TripActivityPageResponseSchema)(page)).toBe(true);
    });
  });

  describe("MarkTripActivityReadRequestSchema", () => {
    it("validates throughSequence format", () => {
      expect(
        Schema.is(MarkTripActivityReadRequestSchema)({ throughSequence: "100" })
      ).toBe(true);
      expect(
        Schema.is(MarkTripActivityReadRequestSchema)({ throughSequence: "0" })
      ).toBe(false);
    });
  });
});
