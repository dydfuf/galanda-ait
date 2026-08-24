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
import { RevisionSchema, type TripId } from "../../../core/domain/ids.ts";
import { ConfirmedItineraryRepository } from "../../../core/ports/confirmed-itinerary-repository.ts";
import { Database } from "./database.ts";
import {
  confirmedItineraries,
  itineraryRevisions,
  type ConfirmedItineraryRow,
} from "./schema/confirmed-itinerary.ts";
import { tripRooms } from "./schema/trip-room.ts";

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
  row: ConfirmedItineraryRow & { snapshot: unknown }
): Effect.Effect<ConfirmedItinerary, RepositoryError> =>
  Schema.decodeUnknownEffect(ConfirmedItinerarySchema)({
    ...row,
    createdAt: row.createdAt.toISOString(),
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
      confirm: ({ room, expectedRoomRevision, itinerary }) =>
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
                changedBy: itinerary.createdBy,
                createdAt: new Date(itinerary.createdAt),
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
    };
  })
);
