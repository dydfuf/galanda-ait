import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  integer,
  pgSequence,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { participants } from "./participant.ts";
import { tripRooms } from "./trip-room.ts";

export const tripActivitySequence = pgSequence("trip_activity_sequence");

export const tripActivityEvents = pgTable(
  "trip_activity_events",
  {
    sequence: bigint("sequence", { mode: "bigint" })
      .primaryKey()
      .default(sql`nextval('trip_activity_sequence')`),
    tripId: text("trip_id")
      .notNull()
      .references(() => tripRooms.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    actorParticipantId: text("actor_participant_id")
      .notNull()
      .references(() => participants.id),
    actorDisplayName: text("actor_display_name"),
    subjectPlanId: text("subject_plan_id"),
    subjectTitle: text("subject_title"),
    roomRevision: integer("room_revision"),
    itineraryRevision: integer("itinerary_revision"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("trip_activity_events_trip_seq_idx").on(table.tripId, table.sequence),
    index("trip_activity_events_trip_actor_seq_idx").on(
      table.tripId,
      table.actorParticipantId,
      table.sequence
    ),
    check(
      "trip_activity_events_event_type_check",
      sql`${table.eventType} IN (
        'PLAN_CREATED',
        'PLAN_UPDATED',
        'PLAN_DELETED',
        'OPINION_SUBMITTED',
        'OPINION_UPDATED',
        'PLAN_CONFIRMED',
        'ITINERARY_REVISED'
      )`
    ),
  ]
);

export const tripActivityReads = pgTable(
  "trip_activity_reads",
  {
    tripId: text("trip_id")
      .notNull()
      .references(() => tripRooms.id, { onDelete: "cascade" }),
    participantId: text("participant_id")
      .notNull()
      .references(() => participants.id, { onDelete: "cascade" }),
    lastSeenSequence: bigint("last_seen_sequence", { mode: "bigint" }).notNull(),
    seenAt: timestamp("seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.tripId, table.participantId] }),
    index("trip_activity_reads_participant_trip_idx").on(
      table.participantId,
      table.tripId
    ),
  ]
);

export type TripActivityEventRow = typeof tripActivityEvents.$inferSelect;
export type NewTripActivityEventRow = typeof tripActivityEvents.$inferInsert;
export type TripActivityReadRow = typeof tripActivityReads.$inferSelect;
export type NewTripActivityReadRow = typeof tripActivityReads.$inferInsert;
