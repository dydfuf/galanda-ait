import { Context } from "effect";
import type { InviteToken, ParticipantId, TripId } from "../domain/ids.ts";
import type { TripMember, TripRoom } from "../domain/room.ts";
import type { RepositoryEffect } from "./repository.ts";

export interface InviteRecord {
  readonly tripId: TripId;
  readonly inviterName: string;
}

export interface IssueInviteParams extends InviteRecord {
  readonly token: InviteToken;
  readonly issuedByParticipantId: ParticipantId;
  readonly expiresAt: string;
}

export interface JoinInviteParams {
  readonly token: InviteToken;
  readonly now: Date;
  readonly member: TripMember;
  readonly participantIds: ReadonlyArray<ParticipantId>;
}

export class InviteRepository extends Context.Service<
  InviteRepository,
  {
    readonly issue: (params: IssueInviteParams) => RepositoryEffect<void>;
    readonly findValid: (
      token: InviteToken,
      now: Date
    ) => RepositoryEffect<InviteRecord | undefined>;
    /** Locks the invite and Trip together so revoke and membership creation cannot race. */
    readonly join: (
      params: JoinInviteParams
    ) => RepositoryEffect<TripRoom | undefined>;
    readonly revoke: (tripId: TripId) => RepositoryEffect<void>;
  }
>()("galanda/ports/InviteRepository") {}
