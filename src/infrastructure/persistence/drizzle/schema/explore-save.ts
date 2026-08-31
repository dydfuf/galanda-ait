import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { explorePlanListings } from "./explore-plan.ts";
import { participants } from "./participant.ts";

/**
 * Explore save 영속 테이블 (RAON-254 / Goal 14 DISC-6).
 *
 * 한 row는 한 번의 save interval을 담는다. listing snapshot을 복사하지 않고
 * `listing_id` reference + interval만 저장한다(reference-only). saved-list를
 * 표시할 때는 항상 현재 listing을 read-through한다.
 *
 * ## Uniqueness / idempotency
 *
 * `(participant_id, listing_id, save_cycle)`로 interval history를 보존하고,
 * `unsaved_at IS NULL` partial unique index로 현재 active row만 사용자별 하나를
 * 허용한다. save cycle은 unsave 이후 재저장 시 증가한다.
 *
 * ## Privacy / cascade
 *
 * - `participant_id`는 서버 전용 actor 참조다(public DTO 미노출). 참여자 삭제 시
 *   `on delete cascade`로 save history도 정리한다.
 * - `listing_id`는 `explore_plan_listings.id`를 참조하며 listing 물리 삭제 시
 *   `on delete cascade`로 save가 함께 삭제된다(deleted listing은 saved-list에서
 *   사라진다). UNLISTED(게시 중단)는 row를 지우지 않고 read-through 시 숨긴다.
 */
export const explorePlanSaves = pgTable(
  "explore_plan_saves",
  {
    participantId: text("participant_id")
      .notNull()
      .references(() => participants.id, { onDelete: "cascade" }),
    listingId: text("listing_id")
      .notNull()
      .references(() => explorePlanListings.id, { onDelete: "cascade" }),
    saveCycle: integer("save_cycle").notNull().default(1),
    savedAt: timestamp("saved_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    unsavedAt: timestamp("unsaved_at", { withTimezone: true }),
  },
  (table) => [
    primaryKey({
      name: "explore_plan_saves_participant_listing_pk",
      columns: [table.participantId, table.listingId, table.saveCycle],
    }),
    check(
      "explore_plan_saves_save_cycle_check",
      sql`${table.saveCycle} >= 1`
    ),
    check(
      "explore_plan_saves_interval_check",
      sql`${table.unsavedAt} is null or ${table.unsavedAt} >= ${table.savedAt}`
    ),
    uniqueIndex("explore_plan_saves_active_uidx")
      .on(table.participantId, table.listingId)
      .where(sql`${table.unsavedAt} is null`),
    // active personal list: participant + saved interval order.
    index("explore_plan_saves_participant_saved_idx")
      .on(table.participantId, table.savedAt.desc(), table.listingId.desc())
      .where(sql`${table.unsavedAt} is null`),
    // listing aggregate/history lookup for anchored rank reconstruction.
    index("explore_plan_saves_listing_history_idx").on(
      table.listingId,
      table.participantId,
      table.savedAt,
      table.unsavedAt
    ),
    // reverse lookup and cascade support.
    index("explore_plan_saves_listing_idx").on(table.listingId),
  ]
);

export type ExplorePlanSaveRow = typeof explorePlanSaves.$inferSelect;
export type NewExplorePlanSaveRow = typeof explorePlanSaves.$inferInsert;
