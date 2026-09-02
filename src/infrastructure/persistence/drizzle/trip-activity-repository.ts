import { and, desc, eq, gt, inArray, notInArray, sql } from "drizzle-orm";
import { Effect, Layer } from "effect";
import {
  ParticipantIdSchema,
  PlanIdSchema,
  RevisionSchema,
  TripIdSchema,
  type TripId,
} from "../../../core/domain/ids.ts";
import {
  TripActivityRepository,
} from "../../../core/ports/trip-activity-repository.ts";
import {
  InvalidActivityCursorError,
  type TripActivityEvent,
  type TripActivitySummary,
  type TripActivityType,
} from "../../../core/domain/trip-activity.ts";
import { RepositoryError } from "../../../core/domain/errors.ts";
import type { DatabaseHandle } from "./database.ts";
import {
  tripActivityEvents,
  tripActivityReads,
} from "./schema/trip-activity.ts";

const databaseEffect = <A>(
  operation: string,
  run: () => Promise<A>
): Effect.Effect<A, RepositoryError> =>
  Effect.tryPromise({
    try: run,
    catch: (cause) =>
      new RepositoryError({
        operation,
        message:
          cause instanceof Error ? cause.message : "데이터베이스 작업 실패",
      }),
  });

type ActivityListRow = {
  readonly sequence: string | number | bigint | null;
  readonly trip_id: string | null;
  readonly event_type: string | null;
  readonly actor_participant_id: string | null;
  readonly actor_display_name: string | null;
  readonly subject_plan_id: string | null;
  readonly subject_title: string | null;
  readonly room_revision: string | number | null;
  readonly itinerary_revision: string | number | null;
  readonly created_at: Date | string | null;
  readonly latest_sequence: string | number | bigint | null;
  readonly last_seen_sequence: string | number | bigint | null;
  readonly unread_count: string | number | null;
};

type ActivitySummaryRow = {
  readonly trip_id: string;
  readonly last_seen_sequence: string | number | bigint | null;
  readonly unread_count: string | number;
  readonly latest_event_type: string | null;
  readonly latest_actor_display_name: string | null;
  readonly latest_subject_title: string | null;
  readonly latest_created_at: Date | string | null;
};

const sqlList = (values: ReadonlyArray<string>) =>
  sql.join(values.map((value) => sql`${value}`), sql`, `);

const toOptionalBigInt = (
  value: string | number | bigint | null | undefined
): bigint | undefined => (value === null || value === undefined ? undefined : BigInt(value));

const toIsoString = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : value;

const toActivityEvent = (
  row: ActivityListRow,
  actorParticipantIds: ReadonlyArray<string>
): TripActivityEvent => ({
  sequence: BigInt(row.sequence!),
  tripId: TripIdSchema.make(row.trip_id!),
  type: row.event_type as TripActivityType,
  actorParticipantId: ParticipantIdSchema.make(row.actor_participant_id!),
  actorDisplayName: row.actor_display_name ?? undefined,
  isOwn: actorParticipantIds.includes(row.actor_participant_id!),
  subjectPlanId: row.subject_plan_id
    ? PlanIdSchema.make(row.subject_plan_id)
    : undefined,
  subjectTitle: row.subject_title ?? undefined,
  roomRevision:
    row.room_revision !== null && row.room_revision !== undefined
      ? RevisionSchema.make(Number(row.room_revision))
      : undefined,
  itineraryRevision:
    row.itinerary_revision !== null && row.itinerary_revision !== undefined
      ? Number(row.itinerary_revision)
      : undefined,
  createdAt: row.created_at ? toIsoString(row.created_at) : "",
});

export const makeDrizzleTripActivityRepository = (
  db: DatabaseHandle
): typeof TripActivityRepository.Service => ({
  listForTrip: ({ tripId, actorParticipantIds, beforeSequence, limit }) =>
    databaseEffect("tripActivity.listForTrip", async () => {
      const allActorIds = Array.from(new Set(actorParticipantIds));
      const beforeFilter =
        beforeSequence === undefined
          ? sql``
          : sql`AND e.sequence < ${beforeSequence}`;
      const readActorFilter =
        allActorIds.length > 0
          ? sql`AND r.participant_id IN (${sqlList(allActorIds)})`
          : sql`AND FALSE`;
      const ownEventFilter =
        allActorIds.length > 0
          ? sql`AND e.actor_participant_id NOT IN (${sqlList(allActorIds)})`
          : sql``;

      const result = await db.execute<ActivityListRow>(sql`WITH page AS (
          SELECT
            e.sequence,
            e.trip_id,
            e.event_type,
            e.actor_participant_id,
            e.actor_display_name,
            e.subject_plan_id,
            e.subject_title,
            e.room_revision,
            e.itinerary_revision,
            e.created_at
          FROM trip_activity_events e
          WHERE e.trip_id = ${tripId}
            ${beforeFilter}
          ORDER BY e.sequence DESC
          LIMIT ${limit + 1}
        ),
        effective_read AS (
          SELECT MAX(r.last_seen_sequence) AS last_seen_sequence
          FROM trip_activity_reads r
          WHERE r.trip_id = ${tripId}
            ${readActorFilter}
        ),
        metadata AS (
          SELECT
            (
              SELECT MAX(e.sequence)
              FROM trip_activity_events e
              WHERE e.trip_id = ${tripId}
            ) AS latest_sequence,
            r.last_seen_sequence,
            (
              SELECT COUNT(*)::int
              FROM trip_activity_events e
              WHERE e.trip_id = ${tripId}
                AND e.sequence > COALESCE(r.last_seen_sequence, 0)
                ${ownEventFilter}
            ) AS unread_count
          FROM effective_read r
        )
        SELECT
          p.sequence,
          p.trip_id,
          p.event_type,
          p.actor_participant_id,
          p.actor_display_name,
          p.subject_plan_id,
          p.subject_title,
          p.room_revision,
          p.itinerary_revision,
          p.created_at,
          m.latest_sequence,
          m.last_seen_sequence,
          m.unread_count
        FROM metadata m
        LEFT JOIN page p ON TRUE
        ORDER BY p.sequence DESC NULLS LAST
      `);
      const rows = result.rows;

      const metadata = rows[0];
      const pageRows = rows.filter((row) => row.sequence !== null);
      const hasMore = pageRows.length > limit;
      const items = hasMore ? pageRows.slice(0, limit) : pageRows;
      const events = items.map((row) => toActivityEvent(row, allActorIds));

      const nextBeforeSequence =
        hasMore && events.length > 0 ? events.at(-1)?.sequence : undefined;

      return {
        events,
        hasMore,
        nextBeforeSequence,
        latestSequence: toOptionalBigInt(metadata?.latest_sequence),
        lastSeenSequence: toOptionalBigInt(metadata?.last_seen_sequence),
        unreadCount: Number(metadata?.unread_count ?? 0),
      };
    }),

  getSummariesForTrips: ({ tripIds, actorParticipantIds }) =>
    databaseEffect("tripActivity.getSummariesForTrips", async () => {
      if (tripIds.length === 0) {
        return new Map<TripId, TripActivitySummary>();
      }

      const uniqueTripIds = Array.from(new Set(tripIds));
      const readActorFilter =
        actorParticipantIds.length > 0
          ? sql`AND r.participant_id IN (${sqlList(actorParticipantIds)})`
          : sql`AND FALSE`;
      const ownEventFilter =
        actorParticipantIds.length > 0
          ? sql`AND e.actor_participant_id NOT IN (${sqlList(actorParticipantIds)})`
          : sql``;
      const result = await db.execute<ActivitySummaryRow>(sql`WITH requested(trip_id) AS (
          VALUES ${sql.join(uniqueTripIds.map((tripId) => sql`(${tripId})`), sql`, `)}
        ),
        watermarks AS (
          SELECT
            t.trip_id,
            MAX(r.last_seen_sequence) AS last_seen_sequence
          FROM requested t
          LEFT JOIN trip_activity_reads r
            ON r.trip_id = t.trip_id
            ${readActorFilter}
          GROUP BY t.trip_id
        ),
        unread_events AS (
          SELECT
            e.trip_id,
            e.sequence,
            e.event_type,
            e.actor_display_name,
            e.subject_title,
            e.created_at,
            ROW_NUMBER() OVER (
              PARTITION BY e.trip_id
              ORDER BY e.sequence DESC
            ) AS unread_rank
          FROM trip_activity_events e
          INNER JOIN watermarks w ON w.trip_id = e.trip_id
          WHERE e.sequence > COALESCE(w.last_seen_sequence, 0)
            ${ownEventFilter}
        )
        SELECT
          w.trip_id,
          w.last_seen_sequence,
          COUNT(u.sequence)::int AS unread_count,
          MAX(CASE WHEN u.unread_rank = 1 THEN u.event_type END) AS latest_event_type,
          MAX(CASE WHEN u.unread_rank = 1 THEN u.actor_display_name END) AS latest_actor_display_name,
          MAX(CASE WHEN u.unread_rank = 1 THEN u.subject_title END) AS latest_subject_title,
          MAX(CASE WHEN u.unread_rank = 1 THEN u.created_at END) AS latest_created_at
        FROM watermarks w
        LEFT JOIN unread_events u ON u.trip_id = w.trip_id
        GROUP BY w.trip_id, w.last_seen_sequence
      `);

      const summaries = new Map<TripId, TripActivitySummary>();
      for (const row of result.rows) {
        const unreadCount = Number(row.unread_count);
        summaries.set(TripIdSchema.make(row.trip_id), {
          tripId: TripIdSchema.make(row.trip_id),
          unreadCount,
          latestUnreadSummary:
            unreadCount > 0 && row.latest_event_type
              ? {
                  type: row.latest_event_type as TripActivityType,
                  actorDisplayName: row.latest_actor_display_name ?? undefined,
                  subjectTitle: row.latest_subject_title ?? undefined,
                  createdAt: row.latest_created_at
                    ? toIsoString(row.latest_created_at)
                    : "",
                }
              : undefined,
          lastSeenSequence: toOptionalBigInt(row.last_seen_sequence),
        });
      }

      return summaries;
    }),

  markRead: ({ tripId, canonicalParticipantId, actorParticipantIds, throughSequence }) =>
    Effect.tryPromise({
      try: async () => {
        return await db.transaction(async (tx) => {
          // 1. Verify throughSequence event exists in this same trip
          const [event] = await tx
            .select({ sequence: tripActivityEvents.sequence })
            .from(tripActivityEvents)
            .where(
              and(
                eq(tripActivityEvents.tripId, tripId),
                eq(tripActivityEvents.sequence, throughSequence)
              )
            )
            .limit(1);

          if (!event) {
            throw new InvalidActivityCursorError({
              message: `해당 여행방(${tripId})에 존재하지 않는 활동 번호(${throughSequence})입니다.`,
              tripId,
              sequence: throughSequence,
            });
          }

          // 2. Fetch maximum watermark among canonical and alias participant IDs
          const allActorIds = Array.from(
            new Set([...actorParticipantIds, canonicalParticipantId])
          );
          const aliasRows = allActorIds.length > 0
            ? await tx
                .select({ lastSeenSequence: tripActivityReads.lastSeenSequence })
                .from(tripActivityReads)
                .where(
                  and(
                    eq(tripActivityReads.tripId, tripId),
                    inArray(tripActivityReads.participantId, allActorIds as string[])
                  )
                )
            : [];

          let aliasMax = 0n;
          for (const r of aliasRows) {
            const seq = BigInt(r.lastSeenSequence);
            if (seq > aliasMax) aliasMax = seq;
          }

          // 3. Atomic upsert with GREATEST and RETURNING
          const [persisted] = await tx
            .insert(tripActivityReads)
            .values({
              tripId,
              participantId: canonicalParticipantId,
              lastSeenSequence: throughSequence > aliasMax ? throughSequence : aliasMax,
              seenAt: sql`now()`,
            })
            .onConflictDoUpdate({
              target: [tripActivityReads.tripId, tripActivityReads.participantId],
              set: {
                lastSeenSequence: sql`GREATEST(
                  ${tripActivityReads.lastSeenSequence},
                  ${aliasMax},
                  ${throughSequence}
                )`,
                seenAt: sql`now()`,
              },
            })
            .returning({
              lastSeenSequence: tripActivityReads.lastSeenSequence,
            });

          if (!persisted) {
            throw new Error("읽음 커서 저장에 실패했습니다.");
          }

          const persistedSequence = BigInt(persisted.lastSeenSequence);

          // 4. Calculate unread summary based on actual persisted sequence
          const eventConditions = [
            eq(tripActivityEvents.tripId, tripId),
            gt(tripActivityEvents.sequence, persistedSequence),
          ];
          if (allActorIds.length > 0) {
            eventConditions.push(
              notInArray(tripActivityEvents.actorParticipantId, allActorIds as string[])
            );
          }

          const [countResult] = await tx
            .select({ count: sql<number>`count(*)::int` })
            .from(tripActivityEvents)
            .where(and(...eventConditions));

          const unreadCount = Number(countResult?.count ?? 0);

          let latestUnreadSummary: TripActivitySummary["latestUnreadSummary"] = undefined;
          if (unreadCount > 0) {
            const [latest] = await tx
              .select()
              .from(tripActivityEvents)
              .where(and(...eventConditions))
              .orderBy(desc(tripActivityEvents.sequence))
              .limit(1);

            if (latest) {
              latestUnreadSummary = {
                type: latest.eventType as TripActivityType,
                actorDisplayName: latest.actorDisplayName ?? undefined,
                subjectTitle: latest.subjectTitle ?? undefined,
                createdAt: latest.createdAt.toISOString(),
              };
            }
          }

          return {
            tripId,
            unreadCount,
            latestUnreadSummary,
            lastSeenSequence: persistedSequence,
          };
        });
      },
      catch: (cause) => {
        if (cause instanceof InvalidActivityCursorError) {
          return cause;
        }
        return new RepositoryError({
          operation: "tripActivity.markRead",
          message: cause instanceof Error ? cause.message : "데이터베이스 작업 실패",
        });
      },
    }),

  initializeMemberCursor: ({ tripId, participantId }) =>
    databaseEffect("tripActivity.initializeMemberCursor", async () => {
      const boundaryResult = await db.execute<{ join_boundary: string | number | bigint }>(
        sql`SELECT nextval('trip_activity_sequence') AS join_boundary`
      );
      const boundaryRow = boundaryResult.rows[0] as { join_boundary?: string | number | bigint } | undefined;
      const joinBoundary = boundaryRow?.join_boundary !== undefined
        ? BigInt(boundaryRow.join_boundary)
        : 0n;

      if (joinBoundary > 0n) {
        await db
          .insert(tripActivityReads)
          .values({
            tripId,
            participantId,
            lastSeenSequence: joinBoundary,
            seenAt: sql`now()`,
          })
          .onConflictDoNothing();
      }
    }),
});

export const DrizzleTripActivityRepositoryLive = (db: DatabaseHandle) =>
  Layer.succeed(TripActivityRepository, makeDrizzleTripActivityRepository(db));
