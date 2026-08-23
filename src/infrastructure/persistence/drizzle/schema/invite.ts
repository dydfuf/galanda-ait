import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { participants } from "./participant.ts";
import { tripRooms } from "./trip-room.ts";

export const tripInvites = pgTable(
  "trip_invite",
  {
    tripId: text("trip_id")
      .primaryKey()
      .references(() => tripRooms.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    issuedByParticipantId: text("issued_by_participant_id")
      .notNull()
      .references(() => participants.id, { onDelete: "cascade" }),
    inviterName: text("inviter_name").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("trip_invite_token_hash_uidx").on(table.tokenHash),
    index("trip_invite_expires_at_idx").on(table.expiresAt),
  ]
);
