import { and, eq, sql } from "drizzle-orm";
import { Effect, Layer, Schema } from "effect";
import {
  NotFoundError,
  RepositoryError,
  RevisionConflictError,
} from "../../../core/domain/errors.ts";
import {
  ConfirmedItinerarySchema,
  type ConfirmedItinerary,
} from "../../../core/domain/confirmed-itinerary.ts";
import {
  ItineraryIdSchema,
  ParticipantIdSchema,
  RevisionSchema,
  type TripId,
} from "../../../core/domain/ids.ts";
import { ConfirmedItineraryRepository } from "../../../core/ports/confirmed-itinerary-repository.ts";
import { Database } from "./database.ts";
import {
  confirmedItineraries,
  itineraryAcknowledgements,
  itineraryRevisions,
  type ConfirmedItineraryRow,
} from "./schema/confirmed-itinerary.ts";
import { tripRooms } from "./schema/trip-room.ts";
import { tripActivityEvents } from "./schema/trip-activity.ts";

const databaseEffect = <A>(operation: string, run: () => PromiseLike<A>) =>
  Effect.tryPromise({
    try: run,
    catch: (cause) =>
      new RepositoryError({
        operation,
        message:
          cause instanceof Error
            ? cause.message
            : "데이터베이스 요청에 실패했습니다.",
      }),
  });

const decodeItinerary = (
  row: ConfirmedItineraryRow & {
    snapshot: unknown;
    changes: unknown;
    changedBy: string;
    changedAt: Date;
  }
): Effect.Effect<ConfirmedItinerary, RepositoryError> =>
  Schema.decodeUnknownEffect(ConfirmedItinerarySchema)({
    ...row,
    createdAt: row.createdAt.toISOString(),
    changedAt: row.changedAt.toISOString(),
  }).pipe(
    Effect.mapError(
      () =>
        new RepositoryError({
          operation: "confirmedItinerary.decode",
          message: "저장된 확정 일정 데이터 형식이 올바르지 않습니다.",
        })
    )
  );

export const ConfirmedItineraryRepositoryLive = Layer.effect(
  ConfirmedItineraryRepository,
  Effect.gen(function* () {
    const { db } = yield* Database;

    return {
      confirm: ({ room, expectedRoomRevision, itinerary, activity }) =>
        Effect.gen(function* () {
          const result = yield* databaseEffect("confirmItinerary", () =>
            db.transaction(async (tx) => {
              const [updated] = await tx
                .update(tripRooms)
                .set({
                  title: room.title,
                  destination: room.destination,
                  members: room.members,
                  plans: room.plans,
                  confirmedPlanId: room.confirmedPlanId ?? null,
                  revision: sql`${tripRooms.revision} + 1`,
                  updatedAt: sql`now()`,
                })
                .where(
                  and(
                    eq(tripRooms.id, room.id),
                    eq(tripRooms.revision, expectedRoomRevision)
                  )
                )
                .returning({ revision: tripRooms.revision });

              if (!updated) {
                const [current] = await tx
                  .select({ revision: tripRooms.revision })
                  .from(tripRooms)
                  .where(eq(tripRooms.id, room.id))
                  .limit(1);
                return current
                  ? ({ _tag: "Conflict", revision: current.revision } as const)
                  : ({ _tag: "NotFound" } as const);
              }

              await tx.insert(confirmedItineraries).values({
                id: itinerary.id,
                tripId: itinerary.tripId,
                sourcePlanId: itinerary.sourcePlanId,
                sourcePlanRevision: itinerary.sourcePlanRevision,
                currentRevision: itinerary.currentRevision,
                createdBy: itinerary.createdBy,
                createdAt: new Date(itinerary.createdAt),
              });
              await tx.insert(itineraryRevisions).values({
                itineraryId: itinerary.id,
                revision: itinerary.currentRevision,
                snapshot: itinerary.snapshot,
                changes: [],
                changedBy: itinerary.createdBy,
                createdAt: new Date(itinerary.createdAt),
              });
              await tx.insert(tripActivityEvents).values({
                tripId: room.id,
                eventType: activity.event.type,
                actorParticipantId: activity.actorParticipantId,
                actorDisplayName: activity.actorDisplayName ?? null,
                subjectPlanId: activity.event.subjectPlanId ?? null,
                subjectTitle: activity.event.subjectTitle ?? null,
                roomRevision: activity.event.roomRevision ?? updated.revision,
                itineraryRevision: activity.event.itineraryRevision ?? itinerary.currentRevision,
              });
              return { _tag: "Confirmed", itinerary } as const;
            })
          );

          if (result._tag === "NotFound") {
            return yield* Effect.fail(
              new NotFoundError({ entity: "TripRoom", id: room.id })
            );
          }
          if (result._tag === "Conflict") {
            return yield* Effect.fail(
              new RevisionConflictError({
                message: "다른 사용자가 이미 방 정보를 수정했습니다.",
                expectedRevision: expectedRoomRevision,
                actualRevision: RevisionSchema.make(result.revision),
              })
            );
          }
          return result.itinerary;
        }),

      findByTripId: (tripId: TripId) =>
        Effect.gen(function* () {
          const [row] = yield* databaseEffect("findItinerary", () =>
            db
              .select({
                id: confirmedItineraries.id,
                tripId: confirmedItineraries.tripId,
                sourcePlanId: confirmedItineraries.sourcePlanId,
                sourcePlanRevision: confirmedItineraries.sourcePlanRevision,
                currentRevision: confirmedItineraries.currentRevision,
                createdBy: confirmedItineraries.createdBy,
                createdAt: confirmedItineraries.createdAt,
                snapshot: itineraryRevisions.snapshot,
                changes: itineraryRevisions.changes,
                changedBy: itineraryRevisions.changedBy,
                changedAt: itineraryRevisions.createdAt,
              })
              .from(confirmedItineraries)
              .innerJoin(
                itineraryRevisions,
                and(
                  eq(itineraryRevisions.itineraryId, confirmedItineraries.id),
                  eq(
                    itineraryRevisions.revision,
                    confirmedItineraries.currentRevision
                  )
                )
              )
              .where(eq(confirmedItineraries.tripId, tripId))
              .limit(1)
          );
          return row ? yield* decodeItinerary(row) : undefined;
        }),

      revise: ({ itinerary, expectedRevision, activity }) =>
        Effect.gen(function* () {
          const result = yield* databaseEffect("reviseItinerary", () =>
            db.transaction(async (tx) => {
              const [updated] = await tx
                .update(confirmedItineraries)
                .set({ currentRevision: itinerary.currentRevision })
                .where(
                  and(
                    eq(confirmedItineraries.id, itinerary.id),
                    eq(confirmedItineraries.currentRevision, expectedRevision)
                  )
                )
                .returning({ revision: confirmedItineraries.currentRevision });
              if (!updated) {
                const [current] = await tx
                  .select({ revision: confirmedItineraries.currentRevision })
                  .from(confirmedItineraries)
                  .where(eq(confirmedItineraries.id, itinerary.id))
                  .limit(1);
                return current
                  ? ({ _tag: "Conflict", revision: current.revision } as const)
                  : ({ _tag: "NotFound" } as const);
              }
              await tx.insert(itineraryRevisions).values({
                itineraryId: itinerary.id,
                revision: itinerary.currentRevision,
                snapshot: itinerary.snapshot,
                changes: itinerary.changes ?? [],
                changedBy: itinerary.changedBy ?? itinerary.createdBy,
                createdAt: new Date(itinerary.changedAt ?? itinerary.createdAt),
              });
              await tx.insert(tripActivityEvents).values({
                tripId: itinerary.tripId,
                eventType: activity.event.type,
                actorParticipantId: activity.actorParticipantId,
                actorDisplayName: activity.actorDisplayName ?? null,
                subjectPlanId: activity.event.subjectPlanId ?? null,
                subjectTitle: activity.event.subjectTitle ?? null,
                roomRevision: activity.event.roomRevision ?? null,
                itineraryRevision: activity.event.itineraryRevision ?? itinerary.currentRevision,
              });
              return { _tag: "Revised", itinerary } as const;
            })
          );
          if (result._tag === "NotFound") {
            return yield* Effect.fail(
              new NotFoundError({ entity: "ConfirmedItinerary", id: itinerary.id })
            );
          }
          if (result._tag === "Conflict") {
            return yield* Effect.fail(
              new RevisionConflictError({
                message: "다른 사용자가 이미 확정 일정을 수정했습니다.",
                expectedRevision,
                actualRevision: RevisionSchema.make(result.revision),
              })
            );
          }
          return result.itinerary;
        }),

      acknowledge: ({
        itineraryId,
        participantId,
        expectedRevision,
        acknowledgedAt,
      }) =>
        Effect.gen(function* () {
          const result = yield* databaseEffect("acknowledgeItinerary", () =>
            db.transaction(async (tx) => {
              const [current] = await tx
                .select({ revision: confirmedItineraries.currentRevision })
                .from(confirmedItineraries)
                .where(eq(confirmedItineraries.id, itineraryId))
                .limit(1)
                .for("update");
              if (!current) return { _tag: "NotFound" } as const;
              if (current.revision !== expectedRevision) {
                return { _tag: "Conflict", revision: current.revision } as const;
              }
              const [row] = await tx
                .insert(itineraryAcknowledgements)
                .values({
                  itineraryId,
                  participantId,
                  acknowledgedRevision: expectedRevision,
                  acknowledgedAt: new Date(acknowledgedAt),
                })
                .onConflictDoUpdate({
                  target: [
                    itineraryAcknowledgements.itineraryId,
                    itineraryAcknowledgements.participantId,
                  ],
                  set: {
                    acknowledgedRevision: expectedRevision,
                    acknowledgedAt: new Date(acknowledgedAt),
                  },
                })
                .returning();
              if (!row) throw new Error("확인 상태 저장 결과가 없습니다.");
              return { _tag: "Acknowledged", row } as const;
            })
          );
          if (result._tag === "NotFound") {
            return yield* Effect.fail(
              new NotFoundError({ entity: "ConfirmedItinerary", id: itineraryId })
            );
          }
          if (result._tag === "Conflict") {
            return yield* Effect.fail(
              new RevisionConflictError({
                message: "최신 일정 revision을 다시 확인해주세요.",
                expectedRevision,
                actualRevision: RevisionSchema.make(result.revision),
              })
            );
          }
          return {
            participantId: ParticipantIdSchema.make(result.row.participantId),
            acknowledgedRevision: RevisionSchema.make(
              result.row.acknowledgedRevision
            ),
            acknowledgedAt: result.row.acknowledgedAt.toISOString(),
          };
        }),

      getAcknowledgements: (itineraryId) =>
        databaseEffect("getItineraryAcknowledgements", async () => {
          const rows = await db
            .select()
            .from(itineraryAcknowledgements)
            .where(
              eq(
                itineraryAcknowledgements.itineraryId,
                ItineraryIdSchema.make(itineraryId)
              )
            );
          return rows.map((row) => ({
            participantId: ParticipantIdSchema.make(row.participantId),
            acknowledgedRevision: RevisionSchema.make(row.acknowledgedRevision),
            acknowledgedAt: row.acknowledgedAt.toISOString(),
          }));
        }),
    };
  })
);
