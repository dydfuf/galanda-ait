import { eq } from "drizzle-orm";
import {
  ParticipantIdSchema,
  type ParticipantId,
} from "../../../core/domain/ids.ts";
import type { DatabaseHandle } from "../../persistence/drizzle/database.ts";
import {
  participantAliases,
  participants,
} from "../../persistence/drizzle/schema/participant.ts";

export interface ParticipantIdentity {
  readonly participantId: ParticipantId;
  readonly participantIds: ReadonlyArray<ParticipantId>;
}

const toIdentity = (
  canonicalId: string,
  aliases: ReadonlyArray<{ readonly aliasParticipantId: string }>
): ParticipantIdentity => {
  const participantId = ParticipantIdSchema.make(canonicalId);
  return {
    participantId,
    participantIds: [
      participantId,
      ...aliases.map(({ aliasParticipantId }) =>
        ParticipantIdSchema.make(aliasParticipantId)
      ),
    ],
  };
};

export const ensureParticipantIdentity = async (
  db: DatabaseHandle,
  authUserId: string
): Promise<ParticipantIdentity> => {
  let [participant] = await db
    .select({ id: participants.id })
    .from(participants)
    .where(eq(participants.authUserId, authUserId))
    .limit(1);

  if (!participant) {
    await db
      .insert(participants)
      .values({ id: authUserId, authUserId })
      .onConflictDoNothing();
    [participant] = await db
      .select({ id: participants.id })
      .from(participants)
      .where(eq(participants.authUserId, authUserId))
      .limit(1);
  }

  if (!participant) {
    throw new Error("Participant mapping could not be created");
  }

  const aliases = await db
    .select({ aliasParticipantId: participantAliases.aliasParticipantId })
    .from(participantAliases)
    .where(eq(participantAliases.canonicalParticipantId, participant.id));

  return toIdentity(participant.id, aliases);
};

export const linkAnonymousParticipant = async (
  db: DatabaseHandle,
  anonymousAuthUserId: string,
  registeredAuthUserId: string
): Promise<void> => {
  await db.transaction(async (tx) => {
    let [anonymousParticipant] = await tx
      .select({ id: participants.id })
      .from(participants)
      .where(eq(participants.authUserId, anonymousAuthUserId))
      .limit(1);

    if (!anonymousParticipant) {
      await tx
        .insert(participants)
        .values({
          id: anonymousAuthUserId,
          authUserId: anonymousAuthUserId,
        })
        .onConflictDoNothing();
      [anonymousParticipant] = await tx
        .select({ id: participants.id })
        .from(participants)
        .where(eq(participants.authUserId, anonymousAuthUserId))
        .limit(1);
    }

    if (!anonymousParticipant) {
      throw new Error("Anonymous participant mapping is missing");
    }

    const [registeredParticipant] = await tx
      .select({ id: participants.id })
      .from(participants)
      .where(eq(participants.authUserId, registeredAuthUserId))
      .limit(1);

    if (
      registeredParticipant &&
      registeredParticipant.id !== anonymousParticipant.id
    ) {
      await tx
        .update(participants)
        .set({ authUserId: null })
        .where(eq(participants.id, registeredParticipant.id));
      await tx
        .update(participantAliases)
        .set({ canonicalParticipantId: anonymousParticipant.id })
        .where(
          eq(
            participantAliases.canonicalParticipantId,
            registeredParticipant.id
          )
        );
      await tx
        .insert(participantAliases)
        .values({
          aliasParticipantId: registeredParticipant.id,
          canonicalParticipantId: anonymousParticipant.id,
        })
        .onConflictDoUpdate({
          target: participantAliases.aliasParticipantId,
          set: { canonicalParticipantId: anonymousParticipant.id },
        });
    }

    await tx
      .update(participants)
      .set({ authUserId: registeredAuthUserId })
      .where(eq(participants.id, anonymousParticipant.id));
  });
};
