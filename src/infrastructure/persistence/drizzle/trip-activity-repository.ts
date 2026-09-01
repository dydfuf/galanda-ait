import { and, desc, eq, gt, inArray, lt, notInArray, sql } from "drizzle-orm";
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

export const makeDrizzleTripActivityRepository = (
  db: DatabaseHandle
): typeof TripActivityRepository.Service => ({
  listForTrip: ({ tripId, actorParticipantIds, beforeSequence, limit }) =>
    databaseEffect("tripActivity.listForTrip", async () => {
      const allActorIds = Array.from(new Set(actorParticipantIds));
      const conditions = [eq(tripActivityEvents.tripId, tripId)];
      if (beforeSequence !== undefined) {
        conditions.push(lt(tripActivityEvents.sequence, beforeSequence));
      }

      const rows = await db
        .select()
        .from(tripActivityEvents)
        .where(and(...conditions))
        .orderBy(desc(tripActivityEvents.sequence))
        .limit(limit + 1);

      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;

      const events: TripActivityEvent[] = items.map((row) => ({
        sequence: BigInt(row.sequence),
        tripId: TripIdSchema.make(row.tripId),
        type: row.eventType as TripActivityType,
        actorParticipantId: ParticipantIdSchema.make(row.actorParticipantId),
        actorDisplayName: row.actorDisplayName ?? undefined,
        isOwn: allActorIds.includes(ParticipantIdSchema.make(row.actorParticipantId)),
        subjectPlanId: row.subjectPlanId ? PlanIdSchema.make(row.subjectPlanId) : undefined,
        subjectTitle: row.subjectTitle ?? undefined,
        roomRevision: row.roomRevision !== null ? RevisionSchema.make(row.roomRevision) : undefined,
        itineraryRevision: row.itineraryRevision ?? undefined,
        createdAt: row.createdAt.toISOString(),
      }));

      const nextBeforeSequence =
        hasMore && items.length > 0 ? items[items.length - 1].sequence : undefined;

      // 1. Global latest sequence for the trip
      const [latestRow] = await db
        .select({ sequence: tripActivityEvents.sequence })
        .from(tripActivityEvents)
        .where(eq(tripActivityEvents.tripId, tripId))
        .orderBy(desc(tripActivityEvents.sequence))
        .limit(1);

      const latestSequence =
        latestRow?.sequence !== undefined ? BigInt(latestRow.sequence) : undefined;

      // 2. User effective lastSeenSequence
      const readRows =
        allActorIds.length > 0
          ? await db
              .select({ lastSeenSequence: tripActivityReads.lastSeenSequence })
              .from(tripActivityReads)
              .where(
                and(
                  eq(tripActivityReads.tripId, tripId),
                  inArray(tripActivityReads.participantId, allActorIds as string[])
                )
              )
          : [];

      let lastSeenSequence: bigint | undefined = undefined;
      for (const r of readRows) {
        const seq = BigInt(r.lastSeenSequence);
        if (lastSeenSequence === undefined || seq > lastSeenSequence) {
          lastSeenSequence = seq;
        }
      }

      // 3. User unreadCount (excluding own actions and <= lastSeenSequence)
      const unreadConditions = [eq(tripActivityEvents.tripId, tripId)];
      if (lastSeenSequence !== undefined) {
        unreadConditions.push(gt(tripActivityEvents.sequence, lastSeenSequence));
      }
      if (allActorIds.length > 0) {
        unreadConditions.push(
          notInArray(tripActivityEvents.actorParticipantId, allActorIds as string[])
        );
      }

      const [unreadCountResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(tripActivityEvents)
        .where(and(...unreadConditions));

      const unreadCount = Number(unreadCountResult?.count ?? 0);

      return {
        events,
        hasMore,
        nextBeforeSequence:
          nextBeforeSequence !== undefined ? BigInt(nextBeforeSequence) : undefined,
        latestSequence,
        lastSeenSequence,
        unreadCount,
      };
    }),

  getSummariesForTrips: ({ tripIds, actorParticipantIds }) =>
    databaseEffect("tripActivity.getSummariesForTrips", async () => {
      if (tripIds.length === 0) {
        return new Map<TripId, TripActivitySummary>();
      }

      // 1. Fetch read watermarks for the actor across these trips
      const readRows = actorParticipantIds.length > 0
        ? await db
            .select()
            .from(tripActivityReads)
            .where(
              and(
                inArray(tripActivityReads.tripId, [...tripIds]),
                inArray(tripActivityReads.participantId, [...actorParticipantIds])
              )
            )
        : [];

      const lastSeenByTrip = new Map<string, bigint>();
      for (const row of readRows) {
        const current = lastSeenByTrip.get(row.tripId);
        const seq = BigInt(row.lastSeenSequence);
        if (current === undefined || seq > current) {
          lastSeenByTrip.set(row.tripId, seq);
        }
      }

      const summaries = new Map<TripId, TripActivitySummary>();

      for (const tripId of tripIds) {
        const lastSeen = lastSeenByTrip.get(tripId);
        const conditions = [eq(tripActivityEvents.tripId, tripId)];
        if (lastSeen !== undefined) {
          conditions.push(gt(tripActivityEvents.sequence, lastSeen));
        }
        if (actorParticipantIds.length > 0) {
          conditions.push(
            notInArray(tripActivityEvents.actorParticipantId, [...actorParticipantIds])
          );
        }

        const [countResult] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(tripActivityEvents)
          .where(and(...conditions));

        const unreadCount = Number(countResult?.count ?? 0);

        let latestUnreadSummary: TripActivitySummary["latestUnreadSummary"] = undefined;
        if (unreadCount > 0) {
          const [latest] = await db
            .select()
            .from(tripActivityEvents)
            .where(and(...conditions))
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

        summaries.set(TripIdSchema.make(tripId), {
          tripId: TripIdSchema.make(tripId),
          unreadCount,
          latestUnreadSummary,
          lastSeenSequence: lastSeen,
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
