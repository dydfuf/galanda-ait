import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { Effect, Layer } from "effect";
import { RepositoryError } from "../../../core/domain/errors.ts";
import { TripIdSchema } from "../../../core/domain/ids.ts";
import {
  InviteRepository,
  type InviteRecord,
} from "../../../core/ports/invite-repository.ts";
import { Database } from "./database.ts";
import { tripInvites } from "./schema/invite.ts";

const repositoryEffect = <A>(
  operation: string,
  run: () => PromiseLike<A>
): Effect.Effect<A, RepositoryError> =>
  Effect.tryPromise({
    try: run,
    catch: () =>
      new RepositoryError({
        operation,
        message: "초대 저장소 요청에 실패했습니다.",
      }),
  });

const hashToken = (token: string): Promise<string> =>
  crypto.subtle
    .digest("SHA-256", new TextEncoder().encode(token))
    .then((digest) =>
      [...new Uint8Array(digest)]
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("")
    );

const toRecord = (row: {
  readonly tripId: string;
  readonly inviterName: string;
}): InviteRecord => ({
  tripId: TripIdSchema.make(row.tripId),
  inviterName: row.inviterName,
});

export const InviteRepositoryLive: Layer.Layer<
  InviteRepository,
  never,
  Database
> = Layer.effect(
  InviteRepository,
  Effect.gen(function* () {
    const { db } = yield* Database;

    return {
      issue: (params) =>
        Effect.gen(function* () {
          const tokenHash = yield* repositoryEffect("issueInvite.hash", () =>
            hashToken(params.token)
          );
          yield* repositoryEffect("issueInvite", async () => {
            await db
              .insert(tripInvites)
              .values({
                tripId: params.tripId,
                tokenHash,
                issuedByParticipantId: params.issuedByParticipantId,
                inviterName: params.inviterName,
                expiresAt: new Date(params.expiresAt),
              })
              .onConflictDoUpdate({
                target: tripInvites.tripId,
                set: {
                  tokenHash,
                  issuedByParticipantId: params.issuedByParticipantId,
                  inviterName: params.inviterName,
                  expiresAt: new Date(params.expiresAt),
                  revokedAt: null,
                  updatedAt: sql`now()`,
                },
              });
          });
        }),

      findValid: (token, now) =>
        Effect.gen(function* () {
          const tokenHash = yield* repositoryEffect("findInvite.hash", () =>
            hashToken(token)
          );
          const [row] = yield* repositoryEffect("findInvite", () =>
            db
              .select({
                tripId: tripInvites.tripId,
                inviterName: tripInvites.inviterName,
              })
              .from(tripInvites)
              .where(
                and(
                  eq(tripInvites.tokenHash, tokenHash),
                  isNull(tripInvites.revokedAt),
                  gt(tripInvites.expiresAt, now)
                )
              )
              .limit(1)
          );
          return row ? toRecord(row) : undefined;
        }),

      revoke: (tripId) =>
        repositoryEffect("revokeInvite", async () => {
          await db
            .update(tripInvites)
            .set({ revokedAt: sql`now()`, updatedAt: sql`now()` })
            .where(
              and(
                eq(tripInvites.tripId, tripId),
                isNull(tripInvites.revokedAt)
              )
            );
        }),
    };
  })
);
