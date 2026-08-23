import { relations, sql } from "drizzle-orm";
import {
  check,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "./auth.ts";

export const participants = pgTable(
  "participant",
  {
    id: text("id").primaryKey(),
    authUserId: text("auth_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("participant_auth_user_id_uidx").on(table.authUserId),
  ]
);

export const participantAliases = pgTable(
  "participant_alias",
  {
    aliasParticipantId: text("alias_participant_id")
      .primaryKey()
      .references(() => participants.id, { onDelete: "cascade" }),
    canonicalParticipantId: text("canonical_participant_id")
      .notNull()
      .references(() => participants.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("participant_alias_canonical_idx").on(table.canonicalParticipantId),
    check(
      "participant_alias_not_self",
      sql`${table.aliasParticipantId} <> ${table.canonicalParticipantId}`
    ),
  ]
);

export const participantRelations = relations(participants, ({ one, many }) => ({
  authUser: one(user, {
    fields: [participants.authUserId],
    references: [user.id],
  }),
  aliases: many(participantAliases),
}));

export const participantAliasRelations = relations(
  participantAliases,
  ({ one }) => ({
    alias: one(participants, {
      fields: [participantAliases.aliasParticipantId],
      references: [participants.id],
      relationName: "participantAlias",
    }),
    canonical: one(participants, {
      fields: [participantAliases.canonicalParticipantId],
      references: [participants.id],
      relationName: "canonicalParticipant",
    }),
  })
);
