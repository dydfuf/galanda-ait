import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { ExplorePlanSnapshot } from "../../../../core/domain/explore-plan.ts";
import { participants } from "./participant.ts";

/**
 * Explore 공개 listing 영속 테이블 (RAON-257 / Goal 14 DISC-2).
 *
 * 한 row가 하나의 listing lifecycle envelope + immutable snapshot을 담는다.
 * `listing_revision` 조건부 UPDATE로 concurrent lifecycle 전이를 CAS한다.
 *
 * ## Privacy / boundary
 *
 * - `source_trip_id` / `source_plan_id` / `source_author_participant_id`는
 *   **서버 전용 private reference**다. immutable `snapshot`(공개 projection)과
 *   분리해서 저장하며 public DTO와 동일시하지 않는다.
 * - source trip/plan reference는 의도적으로 FK가 없는 server-only provenance다.
 *   source room 삭제가 listing row를 막거나 cascade 삭제하지 않는다. snapshot은
 *   source를 read-through하지 않는 박제 value이므로, source 삭제 시 listing은
 *   use case layer에서 auto-unlist로 처리하고 row 자체는 보존한다.
 */
export const explorePlanListings = pgTable(
  "explore_plan_listings",
  {
    id: text("id").primaryKey(),
    // --- server-only source references (private, not part of public DTO) ---
    sourceTripId: text("source_trip_id").notNull(),
    sourcePlanId: text("source_plan_id").notNull(),
    sourceAuthorParticipantId: text("source_author_participant_id")
      .notNull()
      .references(() => participants.id, { onDelete: "no action" }),
    // --- immutable public projection ---
    snapshot: jsonb("snapshot").$type<ExplorePlanSnapshot>().notNull(),
    // --- lifecycle ---
    status: text("status").notNull(),
    listingRevision: integer("listing_revision").notNull().default(1),
    sourcePlanRevision: integer("source_plan_revision").notNull(),
    listedAt: timestamp("listed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    unlistedAt: timestamp("unlisted_at", { withTimezone: true }),
  },
  (table) => [
    // 한 source plan은 최대 하나의 listing row를 가진다(relist는 같은 row 재사용).
    uniqueIndex("explore_plan_listings_source_uidx").on(
      table.sourceTripId,
      table.sourcePlanId
    ),
    // LISTED feed keyset pagination: status filter + (listed_at DESC, id DESC).
    index("explore_plan_listings_feed_idx").on(
      table.status,
      table.listedAt.desc(),
      table.id.desc()
    ),
    check(
      "explore_plan_listings_status_check",
      sql`${table.status} in ('LISTED', 'UNLISTED')`
    ),
    check(
      "explore_plan_listings_listing_revision_positive",
      sql`${table.listingRevision} >= 1`
    ),
    check(
      "explore_plan_listings_source_revision_positive",
      sql`${table.sourcePlanRevision} >= 1`
    ),
  ]
);

export type ExplorePlanListingRow = typeof explorePlanListings.$inferSelect;
export type NewExplorePlanListingRow = typeof explorePlanListings.$inferInsert;
