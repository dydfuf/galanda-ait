import { sql } from "drizzle-orm";
import {
  check,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import type {
  ConfirmedItinerarySnapshot,
  ItineraryChange,
} from "../../../../core/domain/confirmed-itinerary.ts";
import { participants } from "./participant.ts";
import { tripRooms } from "./trip-room.ts";

export const confirmedItineraries = pgTable(
  "confirmed_itineraries",
  {
    id: text("id").primaryKey(),
    tripId: text("trip_id")
      .notNull()
      .unique()
      .references(() => tripRooms.id, { onDelete: "cascade" }),
    sourcePlanId: text("source_plan_id").notNull(),
    sourcePlanRevision: integer("source_plan_revision").notNull(),
    currentRevision: integer("current_revision").notNull().default(1),
    createdBy: text("created_by")
      .notNull()
      .references(() => participants.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "confirmed_itineraries_source_revision_positive",
      sql`${table.sourcePlanRevision} >= 1`
    ),
    check(
      "confirmed_itineraries_current_revision_positive",
      sql`${table.currentRevision} >= 1`
    ),
  ]
);

export const itineraryRevisions = pgTable(
  "itinerary_revisions",
  {
    itineraryId: text("itinerary_id")
      .notNull()
      .references(() => confirmedItineraries.id, { onDelete: "cascade" }),
    revision: integer("revision").notNull(),
    snapshot: jsonb("snapshot").$type<ConfirmedItinerarySnapshot>().notNull(),
    changes: jsonb("changes")
      .$type<ReadonlyArray<ItineraryChange>>()
      .notNull()
      .default([]),
    changedBy: text("changed_by")
      .notNull()
      .references(() => participants.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.itineraryId, table.revision] }),
    check("itinerary_revisions_revision_positive", sql`${table.revision} >= 1`),
  ]
);

export const itineraryAcknowledgements = pgTable(
  "itinerary_acknowledgements",
  {
    itineraryId: text("itinerary_id")
      .notNull()
      .references(() => confirmedItineraries.id, { onDelete: "cascade" }),
    participantId: text("participant_id")
      .notNull()
      .references(() => participants.id, { onDelete: "cascade" }),
    acknowledgedRevision: integer("acknowledged_revision").notNull(),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.itineraryId, table.participantId] }),
    check(
      "itinerary_acknowledgements_revision_positive",
      sql`${table.acknowledgedRevision} >= 1`
    ),
  ]
);

export type ConfirmedItineraryRow = typeof confirmedItineraries.$inferSelect;
