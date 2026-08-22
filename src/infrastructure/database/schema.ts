import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * 여행방 aggregate 한 건이 한 행에 대응한다.
 *
 * - `members`, `plans`는 도메인 JSON 문서로 저장한다(아직 repository를 이관하지 않음).
 * - `revision`은 낙관적 동시성 제어(CAS)를 위한 컬럼이다.
 *   모든 갱신은 `UPDATE ... WHERE id = $1 AND revision = $2` 형태의 단일 문장으로
 *   원자적으로 처리되며, 별도의 클라이언트 트랜잭션이 필요하지 않다.
 */
export const tripRooms = pgTable("trip_rooms", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  destination: text("destination").notNull(),
  revision: integer("revision").notNull().default(1),
  members: jsonb("members").notNull().default([]),
  plans: jsonb("plans").notNull().default([]),
  confirmedPlanId: text("confirmed_plan_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type TripRoomRow = typeof tripRooms.$inferSelect;
export type NewTripRoomRow = typeof tripRooms.$inferInsert;
