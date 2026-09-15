import { sql } from "drizzle-orm";
import { check, index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import type { PlaceCard } from "../../../../core/domain/trip-resource.ts";
import { participants } from "./participant.ts";
import { tripRooms } from "./trip-room.ts";

export const tripResources = pgTable("trip_resources", {
  id: uuid("id").primaryKey().defaultRandom(),
  tripId: text("trip_id").notNull().references(() => tripRooms.id, { onDelete: "cascade" }),
  createdBy: text("created_by").notNull().references(() => participants.id),
  createdByName: text("created_by_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  revision: integer("revision").notNull().default(1),
  url: text("url").notNull().default(""),
  note: text("note").notNull().default(""),
  places: jsonb("places").$type<ReadonlyArray<PlaceCard>>(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  linkStatus: text("link_status").notNull().default("NOT_READ"),
}, (table) => [
  index("trip_resources_trip_created_idx").on(table.tripId, table.createdAt.desc(), table.id.desc()),
  check("trip_resources_revision_check", sql`${table.revision} >= 1`),
  check("trip_resources_link_status_check", sql`${table.linkStatus} in ('NOT_READ', 'READ', 'UNAVAILABLE')`),
  check("trip_resources_source_check", sql`length(btrim(${table.url})) > 0 or length(btrim(${table.note})) > 0`),
  check("trip_resources_source_length_check", sql`length(${table.url}) <= 2048 and length(${table.note}) <= 20000`),
  check("trip_resources_places_check", sql`${table.places} is null or (jsonb_typeof(${table.places}) = 'array' and jsonb_array_length(${table.places}) <= 20)`),
]);

export type TripResourceRow = typeof tripResources.$inferSelect;
