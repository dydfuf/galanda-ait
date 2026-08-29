import { index, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";
import { explorePlanListings } from "./explore-plan.ts";
import { participants } from "./participant.ts";

/**
 * Explore save 영속 테이블 (RAON-254 / Goal 14 DISC-6).
 *
 * 한 row는 "어떤 참여자가 어떤 listing을 언제 저장했는가"만 담는다. listing
 * snapshot을 복사하지 않고 `listing_id` reference + `saved_at`만 저장한다
 * (reference-only). saved-list를 표시할 때는 항상 현재 listing을 read-through한다.
 *
 * ## Uniqueness / idempotency
 *
 * `(participant_id, listing_id)` composite **primary key**로 사용자별 유일성을
 * 강제한다(surrogate id 없음 — relation 자체가 identity다). save는
 * `ON CONFLICT DO NOTHING`으로 idempotent하게 동작하고, 동시 요청(race)에서도
 * PK uniqueness가 중복 row를 막는다.
 *
 * ## Privacy / cascade
 *
 * - `participant_id`는 서버 전용 actor 참조다(public DTO 미노출). 참여자 삭제 시
 *   `on delete cascade`로 save도 정리한다.
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
    savedAt: timestamp("saved_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // 사용자별 유일성 = 관계 자체. 같은 참여자는 같은 listing을 최대 한 번만 저장한다.
    primaryKey({
      name: "explore_plan_saves_participant_listing_pk",
      columns: [table.participantId, table.listingId],
    }),
    // saved-list keyset pagination: participant filter + (saved_at DESC, listing_id DESC).
    // keyset order와 index column 순서를 정확히 일치시킨다.
    index("explore_plan_saves_participant_saved_idx").on(
      table.participantId,
      table.savedAt.desc(),
      table.listingId.desc()
    ),
    // cascade delete 및 relist 재노출 판정용 listing reverse lookup.
    index("explore_plan_saves_listing_idx").on(table.listingId),
  ]
);

export type ExplorePlanSaveRow = typeof explorePlanSaves.$inferSelect;
export type NewExplorePlanSaveRow = typeof explorePlanSaves.$inferInsert;
