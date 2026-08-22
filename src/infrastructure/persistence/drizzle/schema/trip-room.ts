import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/** One PostgreSQL row stores one TripRoom aggregate until RAON-170/196 settle its persistence split. */
export const tripRooms = pgTable("trip_rooms", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  destination: text("destination").notNull(),
  revision: integer("revision").notNull().default(1),
  members: jsonb("members").notNull().default([]),
  plans: jsonb("plans").notNull().default([]),
  confirmedPlanId: text("confirmed_plan_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type TripRoomRow = typeof tripRooms.$inferSelect;
export type NewTripRoomRow = typeof tripRooms.$inferInsert;
